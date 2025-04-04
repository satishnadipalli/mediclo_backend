const Service = require("../models/Service");
const { check, validationResult } = require("express-validator");

// Validation rules
exports.createServiceValidation = [
  check("name", "Service name is required").notEmpty(),
  check("description", "Description is required").notEmpty(),
  check("detailedContent").optional(),
  check("category", "Category must be valid").isIn([
    "Occupational Therapy",
    "Speech Therapy",
    "Physical Therapy",
    "Assessment",
    "Consultation",
    "Other",
  ]),
  check("duration", "Duration must be a positive number").isInt({ min: 1 }),
  check("price", "Price must be a positive number").isFloat({ min: 0 }),
];

exports.updateServiceValidation = [
  check("name", "Service name is required").optional().notEmpty(),
  check("description", "Description is required").optional().notEmpty(),
  check("detailedContent").optional(),
  check("category", "Category must be valid")
    .optional()
    .isIn([
      "Occupational Therapy",
      "Speech Therapy",
      "Physical Therapy",
      "Assessment",
      "Consultation",
      "Other",
    ]),
  check("duration", "Duration must be a positive number")
    .optional()
    .isInt({ min: 1 }),
  check("price", "Price must be a positive number")
    .optional()
    .isFloat({ min: 0 }),
  check("isActive", "isActive must be a boolean").optional().isBoolean(),
];

// @desc    Get all services
// @route   GET /api/services
// @access  Public
exports.getServices = async (req, res, next) => {
  try {
    // Add filtering options
    let query = {};

    // Filter by category if provided
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Filter by active status if provided
    if (req.query.isActive) {
      query.isActive = req.query.isActive === "true";
    }

    const services = await Service.find(query);

    res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single service
// @route   GET /api/services/:id
// @access  Public
exports.getService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new service
// @route   POST /api/services
// @access  Private/Admin
exports.createService = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const service = await Service.create(req.body);

    res.status(201).json({
      success: true,
      data: service,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private/Admin
exports.updateService = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        error: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private/Admin
exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: "Service not found",
      });
    }

    await service.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get services by category
// @route   GET /api/services/category/:category
// @access  Public
exports.getServicesByCategory = async (req, res, next) => {
  try {
    const validCategories = [
      "Occupational Therapy",
      "Speech Therapy",
      "Physical Therapy",
      "Assessment",
      "Consultation",
      "Other",
    ];

    if (!validCategories.includes(req.params.category)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category specified",
      });
    }

    const services = await Service.find({
      category: req.params.category,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (err) {
    next(err);
  }
};
