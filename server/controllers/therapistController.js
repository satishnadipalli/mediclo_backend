const Therapist = require("../models/Therapist");
const User = require("../models/User");
const { check, validationResult } = require("express-validator");

// Validation rules
exports.createTherapistValidation = [
  check("specialization", "Specialization is required")
    .notEmpty()
    .isIn([
      "Occupational Therapy",
      "Speech Therapy",
      "Physical Therapy",
      "Other",
    ]),
  check("qualifications", "Qualifications are required").isArray().notEmpty(),
  check("experience", "Experience must be a number").isNumeric(),
  check("bio", "Bio is required").notEmpty(),
  check("workingHours", "Working hours are required").notEmpty(),
];

exports.updateTherapistValidation = [
  check("specialization", "Specialization must be valid")
    .optional()
    .isIn([
      "Occupational Therapy",
      "Speech Therapy",
      "Physical Therapy",
      "Other",
    ]),
  check("experience", "Experience must be a number").optional().isNumeric(),
  check("isAvailable", "isAvailable must be a boolean").optional().isBoolean(),
];

// @desc    Get all therapists
// @route   GET /api/therapists
// @access  Public
exports.getTherapists = async (req, res, next) => {
  try {
    // Add filtering options
    let query = { isAvailable: true };

    // Filter by specialization if provided
    if (req.query.specialization) {
      query.specialization = req.query.specialization;
    }

    // Get therapists and populate user details
    const therapists = await Therapist.find(query).populate({
      path: "userId",
      select: "firstName lastName email profilePicture",
    });

    res.status(200).json({
      success: true,
      count: therapists.length,
      data: therapists,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single therapist
// @route   GET /api/therapists/:id
// @access  Public
exports.getTherapist = async (req, res, next) => {
  try {
    const therapist = await Therapist.findById(req.params.id).populate({
      path: "userId",
      select: "firstName lastName email profilePicture",
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: "Therapist not found",
      });
    }

    res.status(200).json({
      success: true,
      data: therapist,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new therapist profile
// @route   POST /api/therapists
// @access  Private/Therapist/Admin
exports.createTherapist = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Set userId to current user if not provided (for therapist creating own profile)
    if (!req.body.userId) {
      req.body.userId = req.user.id;
    }

    // Check if user exists and is a therapist
    const user = await User.findById(req.body.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if user already has a therapist profile
    const existingTherapist = await Therapist.findOne({
      userId: req.body.userId,
    });
    if (existingTherapist) {
      return res.status(400).json({
        success: false,
        error: "Therapist profile already exists for this user",
      });
    }

    // Create therapist profile
    const therapist = await Therapist.create(req.body);

    res.status(201).json({
      success: true,
      data: therapist,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update therapist profile
// @route   PUT /api/therapists/:id
// @access  Private/Therapist/Admin
exports.updateTherapist = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let therapist = await Therapist.findById(req.params.id);

    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: "Therapist not found",
      });
    }

    // Check if user has permission to update this therapist profile
    if (
      req.user.role !== "admin" &&
      therapist.userId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this therapist profile",
      });
    }

    therapist = await Therapist.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: therapist,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete therapist profile
// @route   DELETE /api/therapists/:id
// @access  Private/Admin
exports.deleteTherapist = async (req, res, next) => {
  try {
    const therapist = await Therapist.findById(req.params.id);

    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: "Therapist not found",
      });
    }

    await therapist.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get therapist by user ID
// @route   GET /api/therapists/user/:userId
// @access  Private
exports.getTherapistByUserId = async (req, res, next) => {
  try {
    const therapist = await Therapist.findOne({
      userId: req.params.userId,
    }).populate({
      path: "userId",
      select: "firstName lastName email profilePicture",
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: "Therapist profile not found for this user",
      });
    }

    res.status(200).json({
      success: true,
      data: therapist,
    });
  } catch (err) {
    next(err);
  }
};
