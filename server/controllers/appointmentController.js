const Appointment = require("../models/Appointment");
const AppointmentForm = require("../models/AppointmentForm");
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

// @desc    Get today's appointments in calendar format with fix time slots (45 minutes)
// @route   GET /api/appointments/calendar
// @access  Private (Admin, Receptionist, Therapist)
exports.getAppointmentsCalendarView = async (req, res) => {
  try {
    //Get todays date and end timestamps
    const now = new Date();
    const dateStart = new Date(now.setHours(0, 0, 0, 0));
    const dateEnd = new Date(now.setHours(23, 59, 59, 999));

    //Fetch all appointments for today
    const appointments = await Appointment.find({
      date: {
        $gte: dateStart,
        $lte: dateEnd,
      },
    })
      .populate({
        path: "therapistId",
        select: "firstName lastName",
      })
      .populate({
        path: "patientId",
        select: "fullName",
      })
      .sort({ "therapistId.lastName": 1, startTime: 1 });

    // fixed 45-minute time slots
    const timeSlots = [
      "9:15 AM",
      "10:00 AM",
      "10:45 AM",
      "11:30 AM",
      "12:15 PM",
      "1:00 PM",
      "1:45 PM",
      "2:30 PM",
      "3:15 PM",
      "4:00 PM",
      "4:45 PM",
      "5:30 PM",
      "6:15 PM",
      "7:00 PM",
    ];

    // Helper to format Date object to 12-hour time string (e.g., "10:45 AM")
    const formatTime = (timeStr) => {
      const [time, modifier] = timeStr.split(" ");
      let [hours, minutes] = time.split(":").map(Number);
      if (modifier === "PM" && hours !== 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;
      const date = new Date();
      date.setHours(hours, minutes);
      return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    };

    //Group appointments by therapist
    const calendar = {};

    appointments.forEach((appt) => {
      const therapistName = `Dr. ${appt.therapistId.firstName} ${appt.therapistId.lastName}`;
      const startFormatted = formatTime(appt.startTime);

      if (!calendar[therapistName]) {
        calendar[therapistName] = {};
        timeSlots.forEach((slot) => {
          calendar[therapistName][slot] = null;
        });
      }

      // Fill the appropriate slot
      if (calendar[therapistName][startFormatted] === null) {
        calendar[therapistName][startFormatted] = {
          id: appt._id,
          patientId: appt.patientId?._id || null,
          doctorId: appt.therapistId._id,
          patientName: appt.patientId?.fullName || "N/A",
          type: appt.type,
          status: appt.status,
          duration: calculateDuration(appt.startTime, appt.endTime),
        };
      }
    });
    res.status(200).json({
      success: true,
      data: calendar,
    });
  } catch (error) {
    console.error("Calendar fetch error:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Updated helper to support 12-hour format with AM/PM
function calculateDuration(startTime, endTime) {
  const parseTime = (str) => {
    const [time, modifier] = str.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return end - start;
}

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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Save appointment as draft
// @route   POST /api/appointments/save-later
// @access  Private (Admin/Receptionist)
exports.saveAppointmentAsDraft = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phone,
      date,
      startTime,
      endTime,
      notes,
      serviceId,
      address,
      documents,
      type,
      therapistId,
    } = req.body;

    const draft = await Appointment.create({
      fullName,
      email,
      phone,
      date,
      startTime,
      endTime,
      notes,
      serviceId,
      address,
      documents,
      type,
      therapistId,
      isDraft: true,
      status: "pending", // or use a custom status like "draft"
    });

    res.status(201).json({
      success: true,
      message: "Appointment saved as draft",
      data: draft,
    });
  } catch (err) {
    next(err);
  }
};

// Validation for create appointment(for receptionist)
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
  body("totalSessions").optional().isInt({ min: 0 }),
  body("sessionsPaid").optional().isInt({ min: 0 }),
];

// @desc    Create appointment by receptionist
// @route   POST /api/appointments
// @access  Private (Admin, Receptionist)
exports.createAppointment = async (req, res) => {
  console.log("Request body:", req.body);
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
      patientId: req.body.patientId,
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
  body("totalSessions").optional().isInt({ min: 0 }),
  body("sessionsPaid").optional().isInt({ min: 0 }),
  body("status")
    .optional()
    .isIn([
      "scheduled",
      "completed",
      "cancelled",
      "no-show",
      "pending_assignment",
      "pending_confirmation",
      "pending",
    ])
    .withMessage("Invalid status"),
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

    await appointment.deleteOne();

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

    // Validate status if provided
    const validStatuses = [
      "scheduled",
      "rescheduled",
      "completed",
      "cancelled",
      "no-show",
      "pending_assignment",
      "pending_confirmation",
      "pending",
    ];

    if (req.body.status && !validStatuses.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status value",
      });
    }

    // Build update fields
    const updateFields = {
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      therapistId: req.body.therapistId || appointment.therapistId,
      address: req.body.address || appointment.address,
      status: req.body.status || appointment.status,
      notes: req.body.reason
        ? `${appointment.notes || ""}\nRescheduled: ${req.body.reason}`
        : appointment.notes,
    };

    // Update the appointment
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateFields,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: `Appointment successfully ${updateFields.status}`,
      data: updatedAppointment,
    });
  } catch (error) {
    console.log("Reschedule Error:", error);
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
  console.log("Inside controller: getPublicAppointmentRequests"); //debug
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
  } catch (error) {
    console.error("Error fetching public requests:", error); //debug
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Convert public appointment request to formal appointment
// @route   POST /api/appointments/:id/convert-public-request
// @access  Private (Admin, Receptionist)
exports.convertPublicAppointmentRequest = async (req, res) => {
  try {
    const appointment = await AppointmentForm.findById(req.params.id);

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
      status,
      // paymentMethod,
      // patientId,
      //patientDetails, // Optional - if creating a new patient record
      // Added service reference
    } = req.body;

    // Ensure required fields are present
    if (!therapistId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: "Therapist, date, startTime, and endTime are required",
      });
    }

    // Validate therapist
    const therapist = await User.findById(therapistId);
    if (!therapist || therapist.role !== "therapist") {
      return res.status(400).json({
        success: false,
        error: "Invalid therapist selected",
      });
    }

    // Convert serviceType string to actual serviceId
    const service = await Service.findOne({
      name: { $regex: new RegExp(`^${req.body.serviceType}$`, "i") },
    });

    if (!service) {
      return res
        .status(404)
        .json({ success: false, error: "Service type not found" });
    }

    //Create a basic patient entry
    const newPatient = new Patient({
      parentId: req.user._id, //Assuming recpeptionist as gurardian for now
      fullName: appointment.childName,
      dateOfBirth: "",
      emergencyContact: {
        name: appointment.motherName || "Unknown",
        relation: "Mother",
        phone: appointment.contactNumber,
      },
      parentInfo: {
        name: appointment.fatherName,
        phone: appointment.contactNumber,
        email: appointment.email,
        relationship: "Father",
      },
    });
    await newPatient.save();

    // Create appointment
    const newAppointment = await Appointment.create({
      patientName: appointment.childName,
      fatherName: appointment.fatherName,
      email: appointment.email,
      phone: appointment.contactNumber,
      serviceId: service._id,
      patientId: newPatient._id,
      type: appointmentType || form.serviceType,
      date: new Date(date),
      startTime,
      endTime,
      status: status || "scheduled",
      therapistId,
      payment: {
        method: appointment.paymentMethod || "not_specified",
        status: "pending",
        amount: 0,
      },
      assignedBy: req.user._id,
      assignedAt: new Date(),
      notes: appointment.notes,
    });

    // Update the original form
    await appointment.save();

    res.status(201).json({
      success: true,
      message: `Appointment scheduled successfully`,
      data: newAppointment,
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
  body("motherName").notEmpty().withMessage("Mother's name is required"),
  body("fatherName").notEmpty().withMessage("Father's name is required"),
  body("childName").notEmpty().withMessage("Child's name is required"),
  body("childAge")
    .notEmpty()
    .withMessage("Child's age is required")
    .isInt({ min: 1, max: 30 })
    .withMessage("Child's age must be a number between 1 and 30"),
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required"),
  body("contactNumber").notEmpty().withMessage("Contact number is required"),
  body("serviceType").notEmpty().withMessage("Service type is required"),
  body("preferredDate").notEmpty().withMessage("Preferred date is required"),
  body("preferredTime").notEmpty().withMessage("Preferred time is required"),
  body("notes").optional().isString().withMessage("Notes must be a string"),
  body("status")
    .optional()
    .isIn(["pending", "cancelled", "converted", "scheduled"])
    .withMessage("Invalid status value"),
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
    const form = await AppointmentForm.create(req.body);
    res.status(201).json({
      success: true,
      message: "Appointment request submitted successfully",
      data: form,
    });
  } catch (err) {
    console.error("Submit Error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc Get all pending forms submitted by public
// @route GET /api/appointment-forms/pending
// @access Private (Receptionist/Admin)
exports.getPendingForms = async (req, res) => {
  try {
    const forms = await AppointmentForm.find({ status: "pending" }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, count: forms.length, data: forms });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server Error" });
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
