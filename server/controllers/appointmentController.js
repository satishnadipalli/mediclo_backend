const Appointment = require("../models/Appointment");
const Patient = require("../models/Patient");
const User = require("../models/User");
const Service = require("../models/Service");
const { body, validationResult } = require("express-validator");

// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Private (Admin, Therapist, Receptionist)
exports.getAppointments = async (req, res) => {
  try {
    let query = {};

    // If user is a therapist, only show their appointments
    if (req.user.role === "therapist") {
      query.therapistId = req.user._id;
    }

    // Allow filtering by status, date range, patient, or therapist
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.patientId) {
      query.patientId = req.query.patientId;
    }

    if (req.query.therapistId && req.user.role !== "therapist") {
      query.therapistId = req.query.therapistId;
    }

    if (req.query.startDate && req.query.endDate) {
      query.date = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    } else if (req.query.startDate) {
      query.date = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      query.date = { $lte: new Date(req.query.endDate) };
    }

    const appointments = await Appointment.find(query)
      .populate({
        path: "patientId",
        select: "firstName lastName dateOfBirth gender",
      })
      .populate({
        path: "therapistId",
        select: "firstName lastName",
        model: "User",
      })
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get single appointment
// @route   GET /api/appointments/:id
// @access  Private
exports.getAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({
        path: "patientId",
        select: "firstName lastName dateOfBirth gender emergencyContact",
      })
      .populate({
        path: "therapistId",
        select: "firstName lastName email phone",
        model: "User",
      })
      .populate({
        path: "serviceId",
        select: "name category duration price",
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // Check if user has permission to view this appointment
    if (
      req.user.role !== "admin" &&
      req.user.role !== "receptionist" &&
      appointment.therapistId._id.toString() !== req.user._id.toString()
    ) {
      // Check if user is parent of the patient
      const patient = await Patient.findById(appointment.patientId);
      if (!patient || patient.parentId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to view this appointment",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Validation for create appointment
exports.validateAppointment = [
  body("fullName").notEmpty().withMessage("Patient name is required"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  body("therapistId").optional(),
  body("serviceId").notEmpty().withMessage("Service is required"),
  body("date")
    .notEmpty()
    .withMessage("Date is required")
    .isDate()
    .withMessage("Invalid date format"),
  body("startTime").notEmpty().withMessage("Start time is required"),
  body("endTime").notEmpty().withMessage("End time is required"),
  body("type").notEmpty().withMessage("Appointment type is required"),
  body("notes").optional(),
  body("address").optional(),
];

// @desc    Create appointment by receptionist
// @route   POST /api/appointments
// @access  Private (Admin, Receptionist)
exports.createAppointment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  try {
    // Check if therapist exists if provided
    if (req.body.therapistId) {
      const therapist = await User.findById(req.body.therapistId);
      if (!therapist || therapist.role !== "therapist") {
        return res.status(404).json({
          success: false,
          error: "Therapist not found",
        });
      }
    }

    // Check if service exists
    if (req.body.serviceId) {
      const service = await Service.findById(req.body.serviceId);
      if (!service) {
        return res.status(404).json({
          success: false,
          error: "Service not found",
        });
      }
    }

    // Create the appointment - receptionist can create directly in scheduled status
    const appointment = await Appointment.create({
      fullName: req.body.fullName,
      email: req.body.email || "",
      phone: req.body.phone,
      therapistId: req.body.therapistId,
      serviceId: req.body.serviceId,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      status: req.body.status || "scheduled",
      type: req.body.type,
      notes: req.body.notes || "",
      address: req.body.address || "",
      payment: {
        amount: req.body.paymentAmount || 0,
        status: "pending",
        method: req.body.paymentMethod || "not_specified",
      },
      // Record who created this appointment
      assignedBy: req.user._id,
      assignedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: appointment,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
};

// Validation for update appointment
exports.validateUpdateAppointment = [
  body("status")
    .optional()
    .isIn(["scheduled", "completed", "cancelled", "no-show"])
    .withMessage("Invalid status"),
  body("date").optional().isDate().withMessage("Invalid date format"),
  body("payment.status")
    .optional()
    .isIn(["pending", "paid", "refunded"])
    .withMessage("Invalid payment status"),
];

// @desc    Update appointment
// @route   PUT /api/appointments/:id
// @access  Private
exports.updateAppointment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  try {
    let appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // Check if user has permission to update this appointment
    if (
      req.user.role !== "admin" &&
      req.user.role !== "receptionist" &&
      appointment.therapistId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this appointment",
      });
    }

    // Update the appointment
    appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
};

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
// @access  Private (Admin, Receptionist)
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // Only admin and receptionist can delete appointments
    if (req.user.role !== "admin" && req.user.role !== "receptionist") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete appointments",
      });
    }

    await appointment.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Reschedule appointment
// @route   PUT /api/appointments/:id/reschedule
// @access  Private (Admin, Therapist, Receptionist)
exports.rescheduleAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // Validate required fields for rescheduling
    if (!req.body.date || !req.body.startTime || !req.body.endTime) {
      return res.status(400).json({
        success: false,
        error: "Date, start time, and end time are required for rescheduling",
      });
    }

    // If changing therapist, validate new therapist
    if (
      req.body.therapistId &&
      req.body.therapistId !== appointment.therapistId.toString()
    ) {
      const newTherapist = await User.findById(req.body.therapistId);
      if (!newTherapist || newTherapist.role !== "therapist") {
        return res.status(404).json({
          success: false,
          error: "New therapist not found",
        });
      }
    }

    // Update appointment with new schedule details
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      {
        date: req.body.date,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        therapistId: req.body.therapistId || appointment.therapistId,
        address: req.body.address || appointment.address,
        notes: req.body.reason
          ? `${appointment.notes}\nRescheduled: ${req.body.reason}`
          : appointment.notes,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedAppointment,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
};

// @desc    Update appointment status
// @route   PUT /api/appointments/:id/status
// @access  Private (Admin, Therapist, Receptionist)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    // Validate status
    if (
      !req.body.status ||
      !["scheduled", "completed", "cancelled", "no-show"].includes(
        req.body.status
      )
    ) {
      return res.status(400).json({
        success: false,
        error: "Valid status is required",
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // Check if user has permission to update this appointment status
    if (
      req.user.role !== "admin" &&
      req.user.role !== "receptionist" &&
      appointment.therapistId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this appointment status",
      });
    }

    // Update the status
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedAppointment,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get therapist's appointments
// @route   GET /api/appointments/therapist/:therapistId
// @access  Private (Admin, Therapist, Receptionist)
exports.getTherapistAppointments = async (req, res) => {
  try {
    // Check if user is authorized to view this therapist's appointments
    if (
      req.user.role !== "admin" &&
      req.user.role !== "receptionist" &&
      req.params.therapistId !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view this therapist's appointments",
      });
    }

    // Get the therapist
    const therapist = await User.findById(req.params.therapistId);
    if (!therapist || therapist.role !== "therapist") {
      return res.status(404).json({
        success: false,
        error: "Therapist not found",
      });
    }

    // Get appointments
    const appointments = await Appointment.find({
      therapistId: req.params.therapistId,
    })
      .populate({
        path: "patientId",
        select: "firstName lastName dateOfBirth gender",
      })
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get patient's appointments
// @route   GET /api/appointments/patient/:patientId
// @access  Private
exports.getPatientAppointments = async (req, res) => {
  try {
    // Get the patient
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    // Check if user has permission to view this patient's appointments
    if (
      req.user.role !== "admin" &&
      req.user.role !== "receptionist" &&
      patient.parentId.toString() !== req.user._id.toString() &&
      req.user.role !== "therapist"
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view this patient's appointments",
      });
    }

    // If user is therapist, only show appointments with this therapist
    let query = { patientId: req.params.patientId };
    if (req.user.role === "therapist") {
      query.therapistId = req.user._id;
    }

    // Get appointments
    const appointments = await Appointment.find(query)
      .populate({
        path: "therapistId",
        select: "firstName lastName",
        model: "User",
      })
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// // Validation for parent appointment request
// exports.validateParentAppointmentRequest = [
//   body("patientId").notEmpty().withMessage("Patient is required"),
//   body("preferredDates")
//     .isArray({ min: 1 })
//     .withMessage("At least one preferred date is required"),
//   body("preferredDates.*.date").isDate().withMessage("Invalid date format"),
//   body("preferredDates.*.timeSlot")
//     .notEmpty()
//     .withMessage("Time slot preference is required")
//     .isIn(["morning", "afternoon", "evening"])
//     .withMessage("Time slot must be morning, afternoon, or evening"),
//   body("therapistPreference")
//     .optional()
//     .isIn(["no_preference", "specific", "any_available"])
//     .withMessage("Invalid therapist preference"),
//   body("specificTherapistId")
//     .optional()
//     .custom((value, { req }) => {
//       if (req.body.therapistPreference === "specific" && !value) {
//         throw new Error(
//           "Therapist ID is required when selecting a specific therapist"
//         );
//       }
//       return true;
//     }),
//   body("therapyType").notEmpty().withMessage("Therapy type is required"),
//   body("notes").optional(),
//   body("consent").equals("true").withMessage("Patient consent is required"),
// ];

// // @desc    Create parent appointment request
// // @route   POST /api/appointments/request
// // @access  Private (Parent only)
// exports.createParentAppointmentRequest = async (req, res) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({
//       success: false,
//       errors: errors.array(),
//     });
//   }

//   try {
//     // Check if patient exists and belongs to the parent
//     const patient = await Patient.findById(req.body.patientId);
//     if (!patient) {
//       return res.status(404).json({
//         success: false,
//         error: "Patient not found",
//       });
//     }

//     // Verify parent is the guardian of this patient
//     if (patient.parentId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({
//         success: false,
//         error: "Not authorized to book appointments for this patient",
//       });
//     }

//     // If specific therapist is selected, verify therapist exists
//     let therapistId = null;
//     if (
//       req.body.therapistPreference === "specific" &&
//       req.body.specificTherapistId
//     ) {
//       const therapist = await User.findById(req.body.specificTherapistId);
//       if (!therapist || therapist.role !== "therapist") {
//         return res.status(404).json({
//           success: false,
//           error: "Therapist not found",
//         });
//       }
//       therapistId = req.body.specificTherapistId;
//     }

//     // Create the appointment request with status "pending_assignment" if no therapist selected
//     const appointmentStatus = therapistId
//       ? "pending_confirmation"
//       : "pending_assignment";

//     // Create the appointment request
//     const appointment = await Appointment.create({
//       patientId: req.body.patientId,
//       therapistId: therapistId, // Can be null if no specific therapist
//       preferredDates: req.body.preferredDates,
//       therapistPreference: req.body.therapistPreference || "no_preference",
//       type: req.body.therapyType,
//       status: appointmentStatus,
//       notes: req.body.notes || "",
//       payment: {
//         amount: 0, // To be determined later
//         status: "pending",
//         method: "not_specified",
//       },
//       requestedByParent: true,
//       parentRequestedAt: new Date(),
//     });

//     res.status(201).json({
//       success: true,
//       data: appointment,
//       message: therapistId
//         ? "Appointment request submitted and awaiting confirmation"
//         : "Appointment request submitted and awaiting therapist assignment",
//     });
//   } catch (err) {
//     if (err.name === "ValidationError") {
//       const messages = Object.values(err.errors).map((val) => val.message);
//       return res.status(400).json({
//         success: false,
//         error: messages,
//       });
//     } else {
//       return res.status(500).json({
//         success: false,
//         error: "Server Error",
//       });
//     }
//   }
// };

// @desc    Assign therapist to pending appointment request
// @route   PUT /api/appointments/:id/assign-therapist
// @access  Private (Admin, Receptionist)
exports.assignTherapistToAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // Verify the appointment is in a pending_assignment status
    if (appointment.status !== "pending_assignment") {
      return res.status(400).json({
        success: false,
        error: "This appointment is not pending therapist assignment",
      });
    }

    // Check if therapist exists and is a therapist
    const therapist = await User.findById(req.body.therapistId);
    if (!therapist || therapist.role !== "therapist") {
      return res.status(404).json({
        success: false,
        error: "Therapist not found",
      });
    }

    // Check if the selected date and time is in the preferred dates
    const { date, startTime, endTime } = req.body;
    const selectedDate = new Date(date);

    if (appointment.preferredDates && appointment.preferredDates.length > 0) {
      // Check if the date matches one of the preferred dates
      const matchingDateFound = appointment.preferredDates.some((prefDate) => {
        const prefDateObject = new Date(prefDate.date);
        return (
          prefDateObject.getFullYear() === selectedDate.getFullYear() &&
          prefDateObject.getMonth() === selectedDate.getMonth() &&
          prefDateObject.getDate() === selectedDate.getDate()
        );
      });

      if (!matchingDateFound) {
        return res.status(400).json({
          success: false,
          error: "Selected date doesn't match any of the preferred dates",
        });
      }
    }

    // Check for therapist availability at the selected date/time
    const existingAppointment = await Appointment.findOne({
      therapistId: req.body.therapistId,
      date: selectedDate,
      _id: { $ne: appointment._id },
      status: { $nin: ["cancelled", "pending_assignment"] },
      $or: [
        {
          startTime: { $lte: startTime },
          endTime: { $gt: startTime },
        },
        {
          startTime: { $lt: endTime },
          endTime: { $gte: endTime },
        },
        {
          startTime: { $gte: startTime },
          endTime: { $lte: endTime },
        },
      ],
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        error: "Therapist already has an appointment at this time",
      });
    }

    // Update the appointment with the assigned therapist and scheduled time
    appointment.therapistId = req.body.therapistId;
    appointment.date = selectedDate;
    appointment.startTime = startTime;
    appointment.endTime = endTime;
    appointment.status = "scheduled";
    appointment.assignedBy = req.user._id;
    appointment.assignedAt = new Date();

    // Update the payment amount if provided
    if (req.body.paymentAmount) {
      appointment.payment.amount = req.body.paymentAmount;
    }

    await appointment.save();

    res.status(200).json({
      success: true,
      data: appointment,
      message: "Therapist successfully assigned to appointment",
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
};

// @desc    Get all public appointment requests
// @route   GET /api/appointments/public-requests
// @access  Private (Admin, Receptionist)
exports.getPublicAppointmentRequests = async (req, res) => {
  try {
    const requests = await Appointment.find({
      isPublicSubmission: true,
      status: "pending",
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Convert public appointment request to formal appointment
// @route   PUT /api/appointments/:id/convert-public-request
// @access  Private (Admin, Receptionist)
exports.convertPublicAppointmentRequest = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment request not found",
      });
    }

    if (!appointment.isPublicSubmission) {
      return res.status(400).json({
        success: false,
        error: "This is not a public appointment request",
      });
    }

    const {
      therapistId,
      date,
      startTime,
      endTime,
      appointmentType,
      paymentAmount,
      patientId,
      patientDetails, // Optional - if creating a new patient record
      serviceId, // Added service reference
    } = req.body;

    // If patientId is not provided but patientDetails is, create a new patient
    let finalPatientId = patientId;

    if (!patientId && patientDetails) {
      // This would require importing Patient and User models and implementing the logic
      // For now, we'll just indicate it's required
      return res.status(400).json({
        success: false,
        error:
          "PatientId is required. Creating patients from public appointments is not yet implemented.",
      });
    }

    // Check if service exists
    if (serviceId) {
      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({
          success: false,
          error: "Service not found",
        });
      }
    }

    // Update the appointment with formal details
    appointment.therapistId = therapistId;
    appointment.date = new Date(date);
    appointment.startTime = startTime;
    appointment.endTime = endTime;
    appointment.status = "scheduled";
    appointment.type = appointmentType || "initial assessment";
    appointment.serviceId = serviceId;
    appointment.payment = {
      amount: paymentAmount || 0,
      status: "pending",
      method: "not_specified",
    };
    appointment.patientId = finalPatientId;
    appointment.assignedBy = req.user._id;
    appointment.assignedAt = new Date();

    await appointment.save();

    res.status(200).json({
      success: true,
      data: appointment,
      message:
        "Public appointment request has been converted to a formal appointment",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Validation for public appointment submission
exports.validatePublicAppointment = [
  body("fullName").notEmpty().withMessage("Your name is required"),
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  body("dateTime")
    .notEmpty()
    .withMessage("Preferred date and time is required"),
  body("reason").notEmpty().withMessage("Reason for appointment is required"),
  body("specialist").optional(),
  body("serviceType").optional(),
  body("consultationMode").optional(),
];

// @desc    Submit public appointment request
// @route   POST /api/appointments/public
// @access  Public
exports.submitPublicAppointment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  try {
    const {
      fullName,
      email,
      phone,
      specialist,
      dateTime,
      reason,
      serviceType,
      consultationMode,
    } = req.body;

    // Create the appointment directly without requiring user/patient accounts
    const appointment = await Appointment.create({
      // Public form fields
      fullName,
      email,
      phone,
      requestedSpecialist: specialist || "Any available specialist",
      requestedDateTime: new Date(dateTime),
      consultationMode: consultationMode || "in-person",
      requestSource: "website",
      isPublicSubmission: true,

      // Record service type if provided
      notes: serviceType
        ? `Service type: ${serviceType}. Reason: ${reason}`
        : reason,

      // Set appropriate status
      status: "pending",

      // Use the reason as both type and notes
      type: "other",
    });

    // Send successful response
    res.status(201).json({
      success: true,
      message:
        "Thank you! Your appointment request has been received. We'll contact you soon.",
      reference: appointment._id,
    });
  } catch (err) {
    console.error("Error submitting appointment form:", err);
    res.status(500).json({
      success: false,
      error:
        "We couldn't process your request. Please try again or contact us directly.",
    });
  }
};

// @desc    Check appointment request status - public endpoint
// @route   GET /api/appointments/public/status/:id
// @access  Public
exports.checkPublicAppointmentStatus = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment || !appointment.isPublicSubmission) {
      return res.status(404).json({
        success: false,
        error: "Appointment request not found",
      });
    }

    // Return limited information for public access
    res.status(200).json({
      success: true,
      data: {
        id: appointment._id,
        status: appointment.status,
        requestedDateTime: appointment.requestedDateTime,
        requestedSpecialist: appointment.requestedSpecialist,
        createdAt: appointment.createdAt,
        // Do not include email, phone, or other personal details
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};
