const mongoose = require("mongoose");
const Disease = require("../models/Disease");
const { check, validationResult } = require("express-validator");
const { cloudinary } = require("../config/cloudinary");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules
exports.createDiseaseValidation = [
  check("name", "Name is required").notEmpty().isLength({ max: 100 }),
  check("description", "Description is required").notEmpty(),
  check("symptoms", "Symptoms must be an array of strings")
    .isArray()
    .notEmpty(),
  check("causes", "Causes information is required").notEmpty(),
  check("diagnosis", "Diagnosis information is required").notEmpty(),
  check("treatments", "Treatment information is required").notEmpty(),
  check("category", "Category must be valid").isIn([
    "Developmental Disorder",
    "Learning Disability",
    "Behavioral Disorder",
    "Speech and Language Disorder",
    "Neurological Disorder",
    "Physical Disability",
    "Other",
  ]),
  check("ageGroup", "Age group must be an array").optional().isArray(),
  check("ageGroup.*", "Age group contains invalid value")
    .optional()
    .isIn([
      "Infant (0-1 year)",
      "Toddler (1-3 years)",
      "Preschool (3-5 years)",
      "School Age (5-12 years)",
      "Adolescent (12-18 years)",
      "Adult (18+ years)",
    ]),
  check("resources", "Resources must be an array").optional().isArray(),
  check("resources.*.title", "Resource title is required")
    .optional()
    .notEmpty(),
  check("resources.*.url", "Resource URL is required")
    .optional()
    .notEmpty()
    .isURL(),
  check("resources.*.type", "Resource type must be valid")
    .optional()
    .isIn(["Website", "PDF", "Video", "Book", "Other"]),
  check("isPublished", "isPublished must be a boolean").optional().isBoolean(),
  check("keywords", "Keywords must be an array").optional().isArray(),
];

exports.updateDiseaseValidation = [
  check("name", "Name is required")
    .optional()
    .notEmpty()
    .isLength({ max: 100 }),
  check("description", "Description is required").optional().notEmpty(),
  check("symptoms", "Symptoms must be an array of strings")
    .optional()
    .isArray()
    .notEmpty(),
  check("causes", "Causes information is required").optional().notEmpty(),
  check("diagnosis", "Diagnosis information is required").optional().notEmpty(),
  check("treatments", "Treatment information is required")
    .optional()
    .notEmpty(),
  check("category", "Category must be valid")
    .optional()
    .isIn([
      "Developmental Disorder",
      "Learning Disability",
      "Behavioral Disorder",
      "Speech and Language Disorder",
      "Neurological Disorder",
      "Physical Disability",
      "Other",
    ]),
  check("ageGroup", "Age group must be an array").optional().isArray(),
  check("ageGroup.*", "Age group contains invalid value")
    .optional()
    .isIn([
      "Infant (0-1 year)",
      "Toddler (1-3 years)",
      "Preschool (3-5 years)",
      "School Age (5-12 years)",
      "Adolescent (12-18 years)",
      "Adult (18+ years)",
    ]),
  check("resources", "Resources must be an array").optional().isArray(),
  check("resources.*.title", "Resource title is required")
    .optional()
    .notEmpty(),
  check("resources.*.url", "Resource URL is required")
    .optional()
    .notEmpty()
    .isURL(),
  check("resources.*.type", "Resource type must be valid")
    .optional()
    .isIn(["Website", "PDF", "Video", "Book", "Other"]),
  check("isPublished", "isPublished must be a boolean").optional().isBoolean(),
  check("keywords", "Keywords must be an array").optional().isArray(),
];

// @desc    Get all diseases
// @route   GET /api/diseases
// @access  Public
exports.getDiseases = async (req, res, next) => {
  try {
    const {
      category,
      ageGroup,
      keyword,
      isPublished,
      sort,
      limit = 20,
      page = 1,
    } = req.query;

    // Build query
    const query = {};

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by age group
    if (ageGroup) {
      query.ageGroup = { $in: [ageGroup] };
    }

    // Filter by keyword (search in name, description, symptoms)
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
        { symptoms: { $in: [new RegExp(keyword, "i")] } },
      ];
    }

    // Filter by publication status (only admins can see unpublished)
    if (req.user && req.user.role === "admin") {
      if (isPublished !== undefined) {
        query.isPublished = isPublished === "true";
      }
    } else {
      query.isPublished = true;
    }

    // Pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = Number(page) * Number(limit);
    const total = await Disease.countDocuments(query);

    // Sorting
    let sortBy = {};
    if (sort) {
      const parts = sort.split(":");
      sortBy[parts[0]] = parts[1] === "desc" ? -1 : 1;
    } else {
      // Default sort by name
      sortBy = { name: 1 };
    }

    // Execute query
    const diseases = await Disease.find(query)
      .sort(sortBy)
      .skip(startIndex)
      .limit(Number(limit))
      .populate({
        path: "createdBy",
        select: "firstName lastName",
      });

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: Number(page) + 1,
        limit: Number(limit),
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: Number(page) - 1,
        limit: Number(limit),
      };
    }

    res.status(200).json({
      success: true,
      count: diseases.length,
      pagination,
      total,
      data: diseases,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single disease
// @route   GET /api/diseases/:id
// @access  Public
exports.getDisease = async (req, res, next) => {
  try {
    // Allow lookup by ID or slug
    const query = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { slug: req.params.id };

    const disease = await Disease.findOne(query).populate({
      path: "createdBy",
      select: "firstName lastName",
    });

    if (!disease) {
      return next(
        new ErrorResponse(
          `Disease not found with id/slug of ${req.params.id}`,
          404
        )
      );
    }

    // If not published and user is not admin, don't show
    if (!disease.isPublished && (!req.user || req.user.role !== "admin")) {
      return next(
        new ErrorResponse(
          `Disease not found with id/slug of ${req.params.id}`,
          404
        )
      );
    }

    res.status(200).json({
      success: true,
      data: disease,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new disease
// @route   POST /api/diseases
// @access  Private/Admin
exports.createDisease = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Add creator to the request body
    req.body.createdBy = req.user.id;

    // Create the disease
    const disease = await Disease.create(req.body);

    res.status(201).json({
      success: true,
      data: disease,
    });
  } catch (err) {
    // Handle duplicate key error
    if (err.code === 11000) {
      return next(
        new ErrorResponse(`A disease with this name already exists`, 400)
      );
    }
    next(err);
  }
};

// @desc    Update disease
// @route   PUT /api/diseases/:id
// @access  Private/Admin
exports.updateDisease = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let disease = await Disease.findById(req.params.id);

    if (!disease) {
      return next(
        new ErrorResponse(`Disease not found with id of ${req.params.id}`, 404)
      );
    }

    // Update the disease
    disease = await Disease.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: disease,
    });
  } catch (err) {
    // Handle duplicate key error
    if (err.code === 11000) {
      return next(
        new ErrorResponse(`A disease with this name already exists`, 400)
      );
    }
    next(err);
  }
};

// @desc    Delete disease
// @route   DELETE /api/diseases/:id
// @access  Private/Admin
exports.deleteDisease = async (req, res, next) => {
  try {
    const disease = await Disease.findById(req.params.id);

    if (!disease) {
      return next(
        new ErrorResponse(`Disease not found with id of ${req.params.id}`, 404)
      );
    }

    // Delete image from Cloudinary if it exists
    if (disease.featuredImage) {
      try {
        // Extract public_id from the URL
        const urlParts = disease.featuredImage.split("/");
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split(".")[0];

        if (publicId) {
          await cloudinary.uploader.destroy(`8senses/diseases/${publicId}`);
        }
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
      }
    }

    // Delete additional images if any
    if (disease.additionalImages && disease.additionalImages.length > 0) {
      try {
        for (const imageUrl of disease.additionalImages) {
          const urlParts = imageUrl.split("/");
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExtension.split(".")[0];

          if (publicId) {
            await cloudinary.uploader.destroy(`8senses/diseases/${publicId}`);
          }
        }
      } catch (error) {
        console.error(
          "Error deleting additional images from Cloudinary:",
          error
        );
      }
    }

    // Delete the disease
    await disease.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get disease categories
// @route   GET /api/diseases/categories
// @access  Public
exports.getDiseaseCategories = async (req, res, next) => {
  try {
    const categories = await Disease.distinct("category");

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (err) {
    next(err);
  }
};
