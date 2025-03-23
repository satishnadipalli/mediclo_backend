const Appointment = require("../models/Appointment");
const Patient = require("../models/Patient");
const User = require("../models/User");
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
  body("patientId").notEmpty().withMessage("Patient is required"),
  body("therapistId").notEmpty().withMessage("Therapist is required"),
  body("date")
    .notEmpty()
    .withMessage("Date is required")
    .isDate()
    .withMessage("Invalid date format"),
  body("startTime").notEmpty().withMessage("Start time is required"),
  body("endTime").notEmpty().withMessage("End time is required"),
  body("type").notEmpty().withMessage("Appointment type is required"),
  body("payment.amount")
    .isNumeric()
    .withMessage("Payment amount must be a number"),
  body("consent").equals("true").withMessage("Patient consent is required"),
];

// @desc    Create appointment
// @route   POST /api/appointments
// @access  Private (Admin, Therapist, Receptionist)
exports.createAppointment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  try {
    // Check if patient exists
    const patient = await Patient.findById(req.body.patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
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

    // Create the appointment
    const appointment = await Appointment.create({
      patientId: req.body.patientId,
      therapistId: req.body.therapistId,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      status: req.body.status || "scheduled",
      type: req.body.type,
      notes: req.body.notes || "",
      payment: {
        amount: req.body.payment.amount,
        status: req.body.payment.status || "pending",
        method: req.body.payment.method || "card",
      },
      address: req.body.address || "",
      documents: req.body.documents || [],
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
