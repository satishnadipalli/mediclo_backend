const Therapist = require("../models/Therapist");
const User = require("../models/User");
const { check, validationResult } = require("express-validator");
const Appointment = require("../models/Appointment");

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
// @access  Private/Admin
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

    // Check if user exists
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
// @access  Private/Admin
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
// @access  Private/Admin
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

// @desc    Get available therapists by specialty with their availability
// @route   GET /api/therapists/available
// @access  Public
exports.getAvailableTherapists = async (req, res) => {
  try {
    const { specialty, date } = req.query;

    // Build query object
    const query = { role: "therapist" };

    // If specialty is provided, filter by it
    if (specialty) {
      query["specialty"] = specialty;
    }

    // Find all therapists matching the query
    const therapists = await User.find(query).select(
      "firstName lastName specialty profilePicture bio experience availability"
    );

    // If date is provided, filter out therapists with no availability on that date
    let filteredTherapists = therapists;

    if (date) {
      const queryDate = new Date(date);

      // Get appointments for all therapists on the specified date
      const appointments = await Appointment.find({
        therapistId: { $in: therapists.map((t) => t._id) },
        date: {
          $gte: new Date(queryDate.setHours(0, 0, 0, 0)),
          $lt: new Date(queryDate.setHours(23, 59, 59, 999)),
        },
        status: { $nin: ["cancelled", "pending_assignment"] },
      }).select("therapistId startTime endTime");

      // Group appointments by therapist
      const therapistAppointments = {};
      appointments.forEach((app) => {
        if (!therapistAppointments[app.therapistId]) {
          therapistAppointments[app.therapistId] = [];
        }
        therapistAppointments[app.therapistId].push({
          startTime: app.startTime,
          endTime: app.endTime,
        });
      });

      // Add availability info to therapists
      filteredTherapists = therapists.map((therapist) => {
        const therapistData = therapist.toObject();

        // Get therapist's appointments for the day
        const bookedSlots = therapistAppointments[therapist._id] || [];

        // Define common time slots
        const timeSlots = [
          {
            label: "Morning (8:00 AM - 12:00 PM)",
            value: "morning",
            available: true,
          },
          {
            label: "Afternoon (12:00 PM - 4:00 PM)",
            value: "afternoon",
            available: true,
          },
          {
            label: "Evening (4:00 PM - 8:00 PM)",
            value: "evening",
            available: true,
          },
        ];

        // Mark slots as unavailable if they conflict with appointments
        bookedSlots.forEach((slot) => {
          const startHour = parseInt(slot.startTime.split(":")[0]);

          // Mark morning slot
          if (startHour >= 8 && startHour < 12) {
            timeSlots[0].available = false;
          }
          // Mark afternoon slot
          else if (startHour >= 12 && startHour < 16) {
            timeSlots[1].available = false;
          }
          // Mark evening slot
          else if (startHour >= 16 && startHour < 20) {
            timeSlots[2].available = false;
          }
        });

        therapistData.availableTimeSlots = timeSlots;

        // Remove ratings calculation
        therapistData.averageRating = 0;
        therapistData.ratingCount = 0;

        return therapistData;
      });
    }

    res.status(200).json({
      success: true,
      count: filteredTherapists.length,
      data: filteredTherapists,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};
