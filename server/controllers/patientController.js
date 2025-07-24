const Patient = require("../models/Patient")
const { body, check, validationResult } = require("express-validator")
const Appointment = require("../models/Appointment")
const ErrorResponse = require("../utils/errorResponse")
const User = require("../models/User")

// Define allowed symptoms for validation
const ALLOWED_SYMPTOMS = [
  "Autism spectrum disorder",
  "Attention deficit hyperactivity disorder",
  "Down's syndrome",
  "Developmental delayed disorder",
  "Cerebral palsy",
  "Seizure disorders",
  "Hypoxic-Ischemic Encephalopathy",
  "Hemiparalysis",
  "Learning difficulties",
  "Slow learner",
  "Fine motor skills difficulties",
  "Attention deficit disorder",
  "Sensory processing disorders",
  "Swallowing and feeding issues",
  "Speech language delays",
  "Stammering",
  "Articulations issues",
  "Slurred speech",
  "Visual processing difficulties",
  "Behavioural issues",
  "Handwriting difficulties",
  "Brachial plexus injury",
  "Hand functions dysfunction",
  "Spina bifida",
  "Developmental disorders",
  "Genetic disorders",
  "Others",
]

// Validation rules
exports.createPatientValidation = [
  body("firstName", "Child's name is required").notEmpty(),
  body("lastName", "Child's last name is required").notEmpty(),
  body("dateOfBirth", "Date of birth must be a valid date").isISO8601(),
  body("gender", "Gender must be male, female, or other").isIn(["male", "female", "other"]),
  body("parentId", "Parent ID is required").optional(),
  body("parentInfo.name", "Parent/Guardian name is required").notEmpty(),
  body("parentInfo.phone", "Parent contact number is required").notEmpty(),
  body("parentInfo.address", "Address is required").notEmpty(),
  body("parentInfo.relationship", "Relationship to child is required")
    .optional()
    .isIn(["Father", "Mother", "Guardian", "Other"]),
  // NEW VALIDATIONS - Child Symptoms and Notes
  body("childSymptoms")
    .optional()
    .isArray()
    .withMessage("Child symptoms must be an array")
    .custom((symptoms) => {
      if (symptoms && symptoms.length > 0) {
        const invalidSymptoms = symptoms.filter((symptom) => !ALLOWED_SYMPTOMS.includes(symptom))
        if (invalidSymptoms.length > 0) {
          throw new Error(`Invalid symptoms: ${invalidSymptoms.join(", ")}`)
        }
      }
      return true
    }),
  body("notes").optional().isLength({ max: 1000 }).withMessage("Notes cannot exceed 1000 characters"),
]

exports.updatePatientValidation = [
  check("firstName").optional().notEmpty(),
  check("lastName").optional().notEmpty(),
  check("dateOfBirth").optional().isISO8601(),
  check("gender").optional().isIn(["male", "female", "other"]),
  check("parentInfo.name").optional().notEmpty(),
  check("parentInfo.phone").optional().notEmpty(),
  check("parentInfo.email").optional().isEmail(),
  check("parentInfo.address").optional().notEmpty(),
  check("parentInfo.relationship").optional().isIn(["Father", "Mother", "Guardian", "Other"]),
  // NEW VALIDATIONS for update
  check("childSymptoms")
    .optional()
    .isArray()
    .withMessage("Child symptoms must be an array")
    .custom((symptoms) => {
      if (symptoms && symptoms.length > 0) {
        const invalidSymptoms = symptoms.filter((symptom) => !ALLOWED_SYMPTOMS.includes(symptom))
        if (invalidSymptoms.length > 0) {
          throw new Error(`Invalid symptoms: ${invalidSymptoms.join(", ")}`)
        }
      }
      return true
    }),
  check("notes").optional().isLength({ max: 1000 }).withMessage("Notes cannot exceed 1000 characters"),
]

exports.addNoteValidation = [check("note", "Note content is required").notEmpty()]

exports.addAssessmentValidation = [
  check("type", "Assessment type is required").notEmpty(),
  check("summary", "Assessment summary is required").notEmpty(),
  check("date", "Assessment date must be a valid date").isISO8601(),
]

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private/Admin/Therapist/Receptionist
exports.getPatients = async (req, res, next) => {
  try {
    // Add filtering based on user role
    const query = {}

    // For therapists, get all patients who have appointments with them
    if (req.user.role === "therapist") {
      const appointmentPatients = await Appointment.distinct("patientId", {
        therapistId: req.user._id,
      })
      query._id = { $in: appointmentPatients }
    }

    // Handle search query
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i")
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { "parentInfo.name": searchRegex },
        { "parentInfo.phone": searchRegex },
        { "parentInfo.email": searchRegex },
        { childSymptoms: { $in: [searchRegex] } }, // NEW - Search in symptoms
      ]
    }

    let patients = await Patient.find(query).lean()

    // Fetch all appointments
    const allAppointments = await Appointment.find({
      patientId: { $in: patients.map((p) => p._id) },
    }).sort({ date: 1 })

    // Schedules
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
    ]

    // Attach appointment data
    patients = patients.map((patient) => {
      const relevant = allAppointments.filter((appt) => appt.patientId.toString() === patient._id.toString())
      const future = relevant.find((a) => a.date > new Date())
      const past = [...relevant].reverse().find((a) => a.date <= new Date())

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
          ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
          : null,
      }
    })

    // Sort by earliest upcoming appointment
    patients.sort((a, b) => {
      const aDate = a.latestAppointment?.appointmentDate
        ? new Date(a.latestAppointment.appointmentDate)
        : Number.POSITIVE_INFINITY
      const bDate = b.latestAppointment?.appointmentDate
        ? new Date(b.latestAppointment.appointmentDate)
        : Number.POSITIVE_INFINITY

      if (aDate < bDate) return -1
      if (aDate > bDate) return 1

      const aSlotIndex = timeOrder.indexOf(a.latestAppointment?.appointmentSlot || "")
      const bSlotIndex = timeOrder.indexOf(b.latestAppointment?.appointmentSlot || "")

      return aSlotIndex - bSlotIndex
    })

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Get single patient
// @route   GET /api/patients/:id
// @access  Private/Admin/Therapist/Receptionist
exports.getPatient = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id)

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      })
    }

    res.status(200).json({
      success: true,
      data: patient,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Create new patient
// @route   POST /api/patients
// @access  Private (Admin, Therapist, Receptionist only)
exports.createPatient = async (req, res, next) => {
  console.log("Patient registration request received")

  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      })
    }

    if (!["admin", "therapist", "receptionist"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to register patients",
      })
    }

    const {
      parentInfo,
      childSymptoms, // NEW FIELD
      notes, // NEW FIELD
      ...patientData
    } = req.body

    // Validate required father information
    if (!parentInfo.name) {
      return res.status(400).json({
        success: false,
        error: "Father's name is required",
      })
    }

    if (!parentInfo.phone) {
      return res.status(400).json({
        success: false,
        error: "Father's phone number is required",
      })
    }

    // Validate required mother information
    if (!parentInfo.motherName) {
      return res.status(400).json({
        success: false,
        error: "Mother's name is required",
      })
    }

    if (!parentInfo.motherphone) {
      return res.status(400).json({
        success: false,
        error: "Mother's phone number is required",
      })
    }

    // Validate child symptoms if provided
    if (childSymptoms && childSymptoms.length > 0) {
      const invalidSymptoms = childSymptoms.filter((symptom) => !ALLOWED_SYMPTOMS.includes(symptom))
      if (invalidSymptoms.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid symptoms provided: ${invalidSymptoms.join(", ")}`,
        })
      }
    }

    // Try to find existing parent user by email first (if provided), then by phone
    let parentUser = null
    if (parentInfo.email) {
      // If email is provided, search by email first
      parentUser = await User.findOne({ email: parentInfo.email })
    }

    if (!parentUser) {
      // If no user found by email OR no email provided, search by phone number
      parentUser = await User.findOne({ phone: parentInfo.phone })
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
      }

      // Only add email if it's provided
      if (parentInfo.email) {
        userData.email = parentInfo.email
      }

      console.log("Creating new parent user")
      parentUser = await User.create(userData)
      console.log("Parent user created successfully")
    }

    // Create patient with complete parent information including mother's details and NEW FIELDS
    const patient = await Patient.create({
      ...patientData,
      parentId: parentUser._id,
      childSymptoms: childSymptoms || [], // NEW FIELD
      notes: notes || "", // NEW FIELD
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
    })

    // Populate the patient data with parent information for response
    await patient.populate("parentId", "firstName lastName email phone")

    console.log("Patient created successfully with symptoms:", childSymptoms)

    res.status(201).json({
      success: true,
      message: "Patient registered successfully with complete information",
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
    })
  } catch (error) {
    console.error("Patient registration error:", error)

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }))
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationErrors,
      })
    }

    // Handle duplicate key errors (e.g., if phone or email already exists)
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0]
      return res.status(400).json({
        success: false,
        error: `A user with this ${duplicateField} already exists`,
      })
    }

    next(error)
  }
}

exports.updatePatient = async (req, res, next) => {
  try {
    // Check validation
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      })
    }

    let patient = await Patient.findById(req.params.id)
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      })
    }

    // Validate child symptoms if provided in update
    if (req.body.childSymptoms && req.body.childSymptoms.length > 0) {
      const invalidSymptoms = req.body.childSymptoms.filter((symptom) => !ALLOWED_SYMPTOMS.includes(symptom))
      if (invalidSymptoms.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid symptoms provided: ${invalidSymptoms.join(", ")}`,
        })
      }
    }

    patient = await Patient.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })

    res.status(200).json({
      success: true,
      data: patient,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Delete patient
// @route   DELETE /api/patients/:id
// @access  Private/Admin/Therapist/Receptionist
exports.deletePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id)

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      })
    }

    await patient.deleteOne()

    res.status(200).json({
      success: true,
      data: {},
    })
  } catch (err) {
    next(err)
  }
}

// NEW ENDPOINT - Get available symptoms
// @desc    Get available child symptoms
// @route   GET /api/patients/symptoms
// @access  Private/Admin/Therapist/Receptionist
exports.getAvailableSymptoms = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: ALLOWED_SYMPTOMS,
    })
  } catch (err) {
    next(err)
  }
}
