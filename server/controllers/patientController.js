const Patient = require("../models/Patient");
const { body, check, validationResult } = require("express-validator");
const Appointment = require("../models/Appointment");
const ErrorResponse = require("../utils/errorResponse");
const User = require("../models/User");

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
  // body("parentInfo.email", "Invalid email format").optional().isEmail(),
  body("parentInfo.address", "Address is required").notEmpty(),
  body("parentInfo.relationship", "Relationship to child is required")
    .optional()
    .isIn(["Father", "Mother", "Guardian", "Other"]),
];

exports.updatePatientValidation = [
  check("firstName").optional().notEmpty(),
  check("lastName").optional().notEmpty(),
  check("dateOfBirth").optional().isISO8601(),
  check("gender").optional().isIn(["male", "female", "other"]),
  check("parentInfo.name").optional().notEmpty(),
  check("parentInfo.phone").optional().notEmpty(),
  check("parentInfo.email").optional().isEmail(),
  check("parentInfo.address").optional().notEmpty(),
  check("parentInfo.relationship")
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
// @access  Private/Admin/Therapist/Receptionist
exports.getPatients = async (req, res, next) => {
  try {
    // Add filtering based on user role
    let query = {};

    // For therapists, get all patients who have appointments with them
    if (req.user.role === "therapist") {
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

    let patients = await Patient.find(query).lean();

    //Fetch all aappointments
    const allAppointments = await Appointment.find({
      patientId: { $in: patients.map((p) => p._id) },
    }).sort({ date: 1 });

    //Schedules
    const timeOrder = [
      "09:15 AM",
      "10:00 AM",
      "10:45 AM",
      "11:30 AM",
      "12:15 PM",
      "01:00 PM",
      "01:45 PM",
      "02:30 PM",
      "03:15 PM",
      "04:00 PM",
      "04:45 PM",
      "05:30 PM",
      "06:15 PM",
      "07:00 PM",
    ];

    // Attach appointment data
    patients = patients.map((patient) => {
      const relevant = allAppointments.filter(
        (appt) => appt.patientId.toString() === patient._id.toString()
      );

      const future = relevant.find((a) => a.date > new Date());
      const past = [...relevant].reverse().find((a) => a.date <= new Date());

      console.log(future, "futrei");

      return {
        ...patient,
        latestAppointment: future
          ? {
              id: future._id,
              method: future?.payment?.method,
              amount: future?.amount?.amount,
              appointmentDate: future?.date,
              appointmentSlot: future?.startTime,
              paymentStatus: future?.payment?.status || "pending",
            }
          : null,
        lastVisit: past ? past.date : null,
        age: patient.dateOfBirth
          ? Math.floor(
              (new Date() - new Date(patient.dateOfBirth)) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : null,
      };
    });

    // Sort by earliest upcoming appointment
    patients.sort((a, b) => {
      const aDate = a.latestAppointment?.appointmentDate
        ? new Date(a.latestAppointment.appointmentDate)
        : Infinity;
      const bDate = b.latestAppointment?.appointmentDate
        ? new Date(b.latestAppointment.appointmentDate)
        : Infinity;

      if (aDate < bDate) return -1;
      if (aDate > bDate) return 1;

      const aSlotIndex = timeOrder.indexOf(
        a.latestAppointment?.appointmentSlot || ""
      );
      const bSlotIndex = timeOrder.indexOf(
        b.latestAppointment?.appointmentSlot || ""
      );
      return aSlotIndex - bSlotIndex;
    });

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
// @access  Private/Admin/Therapist/Receptionist
exports.getPatient = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (!["admin", "therapist", "receptionist"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to register patients",
      });
    }

    const { parentInfo, ...patientData } = req.body;

    // Validate required father information
    if (!parentInfo.name) {
      return res.status(400).json({
        success: false,
        error: "Father's name is required",
      });
    }

    if (!parentInfo.phone) {
      return res.status(400).json({
        success: false,
        error: "Father's phone number is required",
      });
    }

    // Validate required mother information
    if (!parentInfo.motherName) {
      return res.status(400).json({
        success: false,
        error: "Mother's name is required",
      });
    }

    if (!parentInfo.motherphone) {
      return res.status(400).json({
        success: false,
        error: "Mother's phone number is required",
      });
    }

    // Try to find existing parent user by email first (if provided), then by phone
    let parentUser = null;

    if (parentInfo.email) {
      // If email is provided, search by email first
      parentUser = await User.findOne({ email: parentInfo.email });
    }

    if (!parentUser) {
      // If no user found by email OR no email provided, search by phone number
      parentUser = await User.findOne({ phone: parentInfo.phone });
    }

    if (!parentUser) {
      // Create new parent user if not found by email or phone
      const userData = {
        password: "temporary",
        role: "parent",
        firstName: parentInfo.name.split(" ")[0],
        lastName: parentInfo.name.split(" ").slice(1).join(" ") || "Parent",
        phone: parentInfo.phone,
        address: { street: parentInfo.address },
      };

      // Only add email if it's provided
      if (parentInfo.email) {
        userData.email = parentInfo.email;
      }

      parentUser = await User.create(userData);
    }

    // Create patient with complete parent information including mother's details
    const patient = await Patient.create({
      ...patientData,
      parentId: parentUser._id,
      parentInfo: {
        name: parentInfo.name, // Father's name
        phone: parentInfo.phone, // Father's phone
        email: parentInfo.email || null, // Email (optional)
        motherName: parentInfo.motherName, // Mother's name
        motherphone: parentInfo.motherphone, // Mother's phone
        photo: parentInfo.photo,
        relationship: parentInfo.relationship || "Guardian",
        address: parentInfo.address,
      },
    });

    // Populate the patient data with parent information for response
    await patient.populate("parentId", "firstName lastName email phone");

    res.status(201).json({
      success: true,
      message:
        "Patient registered successfully with complete parent information",
      data: {
        patient,
        parentUser: {
          id: parentUser._id,
          email: parentUser.email || null,
          firstName: parentUser.firstName,
          lastName: parentUser.lastName,
          phone: parentUser.phone,
        },
      },
    });
  } catch (error) {
    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationErrors,
      });
    }

    // Handle duplicate key errors (e.g., if phone or email already exists)
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: `A user with this ${duplicateField} already exists`,
      });
    }

    next(error);
  }
};

// exports.createPatient = async (req, res, next) => {
//   try {
//     // Check validation
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({
//         success: false,
//         errors: errors.array(),
//       });
//     }

//     // Only allow admin, therapist, or receptionist to create patients
//     if (!["admin", "therapist", "receptionist"].includes(req.user.role)) {
//       return res.status(403).json({
//         success: false,
//         error: "Not authorized to register patients",
//       });
//     }

//     // Calculate age based on date of birth
//     const dateOfBirth = new Date(req.body.dateOfBirth);
//     const today = new Date();
//     let age = today.getFullYear() - dateOfBirth.getFullYear();
//     const m = today.getMonth() - dateOfBirth.getMonth();
//     if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) {
//       age--;
//     }

//     const patient = await Patient.create({
//       ...req.body,
//       // Set the parent info fields from the input
//       parentInfo: {
//         name: req.body.parentInfo?.name,
//         phone: req.body.parentInfo?.phone,
//         email: req.body.parentInfo?.email,
//         relationship: req.body.parentInfo?.relationship || "Guardian",
//         address: req.body.parentInfo?.address,
//         photo: req.body.parentInfo?.photo,
//       },
//     });

//     res.status(201).json({
//       success: true,
//       data: patient,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// @desc    Update patient
// @route   PUT /api/patients/:id
// @access  Private/Admin/Therapist/Receptionist
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
// @access  Private/Admin/Therapist/Receptionist
exports.deletePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
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

//Un-necessary Photos;

// @desc    Add patient photo
// @route   PUT /api/patients/:id/photo
// @access  Private/Admin/Therapist/Receptionist
exports.updatePatientPhoto = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
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
// @access  Private/Admin/Therapist/Receptionist
exports.updateBirthCertificate = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
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
// @access  Private/Admin/Therapist/Receptionist
exports.updateAadharCard = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
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
// @access  Private/Admin/Therapist/Receptionist
exports.updateParentPhoto = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
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
