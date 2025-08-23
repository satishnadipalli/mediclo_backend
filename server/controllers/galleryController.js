const Gallery = require("../models/Gallery");
const { check, validationResult } = require("express-validator");
const { cloudinary } = require("../config/cloudinary");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules
exports.galleryValidation = [
  check("title", "Title is required").notEmpty().isLength({ max: 100 }),
  check("description", "Description is too long")
    .optional()
    .isLength({ max: 500 }),
  check("category", "Category must be valid").isIn([
    "Clinic",
    "Events",
    "Therapy Sessions",
    "Team",
    "Success Stories",
    "Other",
  ]),
  check("featured", "Featured must be a boolean").optional().isBoolean(),
  check("order", "Order must be a number").optional().isNumeric(),
];

// @desc    Get all gallery images
// @route   GET /api/gallery
// @access  Public
exports.getGalleryImages = async (req, res, next) => {
  try {
    const { category, featured, sort, limit = 50 } = req.query;

    // Build query
    const query = {};

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by featured
    if (featured) {
      query.featured = featured === "true";
    }

    // Sorting
    let sortBy = {};
    if (sort) {
      const parts = sort.split(":");
      sortBy[parts[0]] = parts[1] === "desc" ? -1 : 1;
    } else {
      // Default sort by order and createdAt
      sortBy = { order: 1, createdAt: -1 };
    }

    const galleryImages = await Gallery.find(query)
      .sort(sortBy)
      .limit(parseInt(limit, 10))
      .populate({
        path: "uploadedBy",
        select: "firstName lastName",
      });

      console.log("gallery images",galleryImages);
    res.status(200).json({
      success: true,
      count: galleryImages.length,
      data: galleryImages,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single gallery image
// @route   GET /api/gallery/:id
// @access  Public
exports.getGalleryImage = async (req, res, next) => {
  try {
    const galleryImage = await Gallery.findById(req.params.id).populate({
      path: "uploadedBy",
      select: "firstName lastName",
    });

    if (!galleryImage) {
      return next(
        new ErrorResponse(
          `Gallery image not found with id of ${req.params.id}`,
          404
        )
      );
    }

    res.status(200).json({
      success: true,
      data: galleryImage,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new gallery image
// @route   POST /api/gallery
// @access  Private/Admin
exports.createGalleryImage = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Add the user ID to the request body
    req.body.uploadedBy = req.user.id;

    // Create the gallery image
    const galleryImage = await Gallery.create(req.body);

    res.status(201).json({
      success: true,
      data: galleryImage,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update gallery image
// @route   PUT /api/gallery/:id
// @access  Private/Admin
exports.updateGalleryImage = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let galleryImage = await Gallery.findById(req.params.id);

    if (!galleryImage) {
      return next(
        new ErrorResponse(
          `Gallery image not found with id of ${req.params.id}`,
          404
        )
      );
    }

    // Update the gallery image
    galleryImage = await Gallery.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: galleryImage,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete gallery image
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
exports.deleteGalleryImage = async (req, res, next) => {
  try {
    const galleryImage = await Gallery.findById(req.params.id);

    if (!galleryImage) {
      return next(
        new ErrorResponse(
          `Gallery image not found with id of ${req.params.id}`,
          404
        )
      );
    }

    // Delete image from Cloudinary
    if (galleryImage.publicId) {
      try {
        await cloudinary.uploader.destroy(galleryImage.publicId);
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
      }
    }

    // Delete the gallery image from database
    await galleryImage.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get gallery statistics
// @route   GET /api/gallery/stats
// @access  Private/Admin
exports.getGalleryStats = async (req, res, next) => {
  try {
    // Get count by category
    const categoryStats = await Gallery.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get featured count
    const featuredCount = await Gallery.countDocuments({ featured: true });

    // Get total count
    const totalCount = await Gallery.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        totalCount,
        featuredCount,
        categoryStats,
      },
    });
  } catch (err) {
    next(err);
  }
};
