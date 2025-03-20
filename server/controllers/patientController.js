const Patient = require("../models/Patient");
const { check, validationResult } = require("express-validator");

// Validation rules
exports.createPatientValidation = [
  check("firstName", "First name is required").notEmpty(),
  check("lastName", "Last name is required").notEmpty(),
  check("dateOfBirth", "Date of birth must be a valid date").isISO8601(),
  check("gender", "Gender must be male, female, or other").isIn([
    "male",
    "female",
    "other",
  ]),
  check(
    "emergencyContact.name",
    "Emergency contact name is required"
  ).notEmpty(),
  check(
    "emergencyContact.relation",
    "Emergency contact relation is required"
  ).notEmpty(),
  check(
    "emergencyContact.phone",
    "Emergency contact phone is required"
  ).notEmpty(),
];

exports.updatePatientValidation = [
  check("firstName", "First name is required").optional().notEmpty(),
  check("lastName", "Last name is required").optional().notEmpty(),
  check("dateOfBirth", "Date of birth must be a valid date")
    .optional()
    .isISO8601(),
  check("gender", "Gender must be male, female, or other")
    .optional()
    .isIn(["male", "female", "other"]),
];

exports.addNoteValidation = [
  check("note", "Note content is required").notEmpty(),
];

exports.addAssessmentValidation = [
  check("type", "Assessment type is required").notEmpty(),
  check("summary", "Assessment summary is required").notEmpty(),
  check("date", "Assessment date must be a valid date").isISO8601(),
];

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private
exports.getPatients = async (req, res, next) => {
  try {
    // Add filtering based on user role
    let query = {};

    // If user is a parent, only show their patients
    if (req.user.role === "parent") {
      query.parentId = req.user.id;
    }

    const patients = await Patient.find(query);

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single patient
// @route   GET /api/patients/:id
// @access  Private
exports.getPatient = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Check if user has permission to view this patient
    if (
      req.user.role === "parent" &&
      patient.parentId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access this patient",
      });
    }

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new patient
// @route   POST /api/patients
// @access  Private
exports.createPatient = async (req, res, next) => {
  try {
    // Check validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // If user is a parent, set parentId to their user ID
    if (req.user.role === "parent") {
      req.body.parentId = req.user.id;
    }

    const patient = await Patient.create(req.body);

    res.status(201).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update patient
// @route   PUT /api/patients/:id
// @access  Private
exports.updatePatient = async (req, res, next) => {
  try {
    // Check validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Check if user has permission to update this patient
    if (
      req.user.role === "parent" &&
      patient.parentId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this patient",
      });
    }

    patient = await Patient.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete patient
// @route   DELETE /api/patients/:id
// @access  Private
exports.deletePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Only admin or the parent of the patient can delete
    if (
      req.user.role === "parent" &&
      patient.parentId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete this patient",
      });
    }

    await patient.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add note to patient
// @route   POST /api/patients/:id/notes
// @access  Private/Therapist
exports.addPatientNote = async (req, res, next) => {
  try {
    // Check validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Add note with therapist ID
    patient.therapistNotes.push({
      therapistId: req.user.id,
      date: new Date(),
      note: req.body.note,
    });

    await patient.save();

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add assessment to patient
// @route   POST /api/patients/:id/assessments
// @access  Private/Therapist
exports.addPatientAssessment = async (req, res, next) => {
  try {
    // Check validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Add assessment with therapist ID
    patient.assessments.push({
      date: req.body.date,
      type: req.body.type,
      summary: req.body.summary,
      conductedBy: req.user.id,
      documents: req.body.documents || [],
    });

    await patient.save();

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    next(err);
  }
};
