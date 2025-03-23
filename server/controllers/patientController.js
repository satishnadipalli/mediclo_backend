const Patient = require("../models/Patient");
const { body, check, validationResult } = require("express-validator");
const Appointment = require("../models/Appointment");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules
exports.createPatientValidation = [
  body("firstName", "Child's name is required").notEmpty(),
  body("lastName", "Child's last name is required").notEmpty(),
  body("dateOfBirth", "Date of birth must be a valid date").isISO8601(),
  body("gender", "Gender must be male, female, or other").isIn([
    "male",
    "female",
    "other",
  ]),
  body("parentId", "Parent ID is required").notEmpty(),
  body("parentInfo.name", "Parent/Guardian name is required").notEmpty(),
  body("parentInfo.phone", "Parent contact number is required").notEmpty(),
  body("parentInfo.email", "Invalid email format").optional().isEmail(),
  body("parentInfo.address", "Address is required").notEmpty(),
  body("parentInfo.relationship", "Relationship to child is required")
    .optional()
    .isIn(["Father", "Mother", "Guardian", "Other"]),
  body(
    "emergencyContact.name",
    "Emergency contact name is required"
  ).notEmpty(),
  body(
    "emergencyContact.relation",
    "Emergency contact relation is required"
  ).notEmpty(),
  body(
    "emergencyContact.phone",
    "Emergency contact phone is required"
  ).notEmpty(),
];

exports.updatePatientValidation = [
  check("firstName", "Child's name is required").optional().notEmpty(),
  check("lastName", "Child's last name is required").optional().notEmpty(),
  check("dateOfBirth", "Date of birth must be a valid date")
    .optional()
    .isISO8601(),
  check("gender", "Gender must be male, female, or other")
    .optional()
    .isIn(["male", "female", "other"]),
  check("parentInfo.name", "Parent/Guardian name is required")
    .optional()
    .notEmpty(),
  check("parentInfo.phone", "Parent contact number is required")
    .optional()
    .notEmpty(),
  check("parentInfo.email", "Invalid email format").optional().isEmail(),
  check("parentInfo.address", "Address is required").optional().notEmpty(),
  check("parentInfo.relationship", "Relationship to child is required")
    .optional()
    .isIn(["Father", "Mother", "Guardian", "Other"]),
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
    } else if (req.user.role === "therapist") {
      // For therapists, get all patients who have appointments with them
      const appointmentPatients = await Appointment.distinct("patientId", {
        therapistId: req.user._id,
      });
      query._id = { $in: appointmentPatients };
    }

    // Handle search query
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { "parentInfo.name": searchRegex },
        { "parentInfo.phone": searchRegex },
        { "parentInfo.email": searchRegex },
      ];
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
// @access  Private (Admin, Therapist, Receptionist only)
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

    // Only allow admin, therapist, or receptionist to create patients
    if (!["admin", "therapist", "receptionist"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to register patients",
      });
    }

    // Calculate age based on date of birth
    const dateOfBirth = new Date(req.body.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const m = today.getMonth() - dateOfBirth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }

    const patient = await Patient.create({
      ...req.body,
      // Set the parent info fields from the input
      parentInfo: {
        name: req.body.parentInfo?.name,
        phone: req.body.parentInfo?.phone,
        email: req.body.parentInfo?.email,
        relationship: req.body.parentInfo?.relationship || "Guardian",
        address: req.body.parentInfo?.address,
        photo: req.body.parentInfo?.photo,
      },
    });

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
      req.user.role !== "admin" &&
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

// @desc    Add patient photo
// @route   PUT /api/patients/:id/photo
// @access  Private
exports.updatePatientPhoto = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Check authorization
    if (
      req.user.role === "parent" &&
      patient.parentId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this patient",
      });
    }

    // Update photo information
    patient.photo = req.body.photo;
    await patient.save();

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update birth certificate
// @route   PUT /api/patients/:id/birth-certificate
// @access  Private
exports.updateBirthCertificate = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Check authorization
    if (
      req.user.role === "parent" &&
      patient.parentId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this patient",
      });
    }

    // Update birth certificate information
    patient.birthCertificate = req.body.birthCertificate;
    await patient.save();

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update aadhar card
// @route   PUT /api/patients/:id/aadhar-card
// @access  Private
exports.updateAadharCard = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Check authorization
    if (
      req.user.role === "parent" &&
      patient.parentId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this patient",
      });
    }

    // Update aadhar card information
    patient.aadharCard = req.body.aadharCard;
    await patient.save();

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update parent photo
// @route   PUT /api/patients/:id/parent-photo
// @access  Private
exports.updateParentPhoto = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Check authorization
    if (
      req.user.role === "parent" &&
      patient.parentId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this patient",
      });
    }

    // Update parent photo information
    if (!patient.parentInfo) {
      patient.parentInfo = {};
    }
    patient.parentInfo.photo = req.body.photo;
    await patient.save();

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add medical record
// @route   POST /api/patients/:id/medical-records
// @access  Private
exports.addMedicalRecord = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Add medical record
    if (!req.body.url || !req.body.public_id) {
      return res.status(400).json({
        success: false,
        error: "Medical record URL and public_id are required",
      });
    }

    patient.medicalRecords.push({
      url: req.body.url,
      public_id: req.body.public_id,
      name: req.body.name || "Medical Record",
      uploadDate: new Date(),
      uploadedBy: req.user.id,
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
