const Appointment = require("../models/Appointment");
const AppointmentForm = require("../models/AppointmentForm");
const Patient = require("../models/Patient");
const User = require("../models/User");
const Service = require("../models/Service");
const { body, validationResult } = require("express-validator");

// =======================
// VALIDATIONS
// =======================

// Validation for appointment request (user)
exports.validateAppointmentRequest = [
  body("motherName").notEmpty().withMessage("Mother's name is required"),
  body("fatherName").notEmpty().withMessage("Father's name is required"),
  body("childName").notEmpty().withMessage("Child's name is required"),
  body("childAge")
    .isInt({ min: 1, max: 30 })
    .withMessage("Child's age must be 1-30"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone").notEmpty().withMessage("Phone is required"),
  body("serviceType").notEmpty().withMessage("Service type is required"),
  body("preferredDate")
    .notEmpty()
    .withMessage("Preferred date is required")
    .isISO8601(),
  body("preferredTime").notEmpty().withMessage("Preferred time is required"),
  body("notes").optional().isString(),
];

// Validation for receptionist formal appointment creation
exports.validateFormalAppointment = [
  body("therapistId").notEmpty().withMessage("Therapist is required"),
  body("serviceId").notEmpty().withMessage("Service is required"),
  body("date").notEmpty().isISO8601().withMessage("Valid date is required"),
  body("startTime").notEmpty().withMessage("Start time is required"),
  body("endTime").notEmpty().withMessage("End time is required"),
  body("type")
    .notEmpty()
    .isIn(["initial assessment", "follow-up", "therapy session", "other"])
    .withMessage("Appointment type is required"),
];

// Validation for creating appointment (by receptionist)
exports.validateAppointment = [
  body("patientName").notEmpty().withMessage("Patient name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  body("serviceId").notEmpty().withMessage("Service is required"),
  body("date").notEmpty().isDate().withMessage("Valid date is required"),
  body("startTime").notEmpty().withMessage("Start time is required"),
  body("endTime").notEmpty().withMessage("End time is required"),
  body("type")
    .optional()
    .isIn(["initial assessment", "follow-up", "therapy session", "other"])
    .withMessage("Invalid type"),
];

// Validation for update appointment
exports.validateUpdateAppointment = [
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

// =======================
// USER REQUEST
// =======================

// @desc    User submits appointment request
// @route   POST /api/appointments/request
// @access  Private (User)
exports.submitAppointmentRequest = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const form = await AppointmentForm.create({
      motherName: req.body.motherName,
      fatherName: req.body.fatherName,
      childName: req.body.childName,
      phone: req.body.phone,
      email: req.body.email,
      childAge: req.body.childAge,
      serviceType: req.body.serviceType,
      preferredDate: req.body.preferredDate,
      preferredTime: req.body.preferredTime,
      paymentMethod: req.body.paymentMethod || "not_specified",
      notes: req.body.notes,
      createdBy: req.user._id,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Appointment request submitted! Our team will contact you soon.",
      data: form,
    });
  } catch (error) {
    console.error("Request Error:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Fetch pending appointment requests
// @route   GET /api/appointments/requests/pending
// @access  Private (Receptionist, Admin)
exports.getPendingAppointmentRequests = async (req, res) => {
  try {
    const forms = await AppointmentForm.find({ status: "pending" }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, count: forms.length, data: forms });
  } catch (err) {
    console.error("Fetch pending requests error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// =======================
// RECEPTIONIST CONVERSION
// =======================

// @desc    Convert appointment request to formal appointment
// @route   POST /api/appointments/convert/:formId
// @access  Private (Receptionist, Admin)
exports.convertRequestToAppointment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const form = await AppointmentForm.findById(req.params.formId);
    if (!form) {
      return res
        .status(404)
        .json({ success: false, error: "Appointment request not found!" });
    }

    //Ensure user exists or create placeholder user
    let user = await User.findOne({ email: form.email });
    if (!user) {
      user = await User.create({
        email: form.email,
        password: "temporary",
        role: "parent",
        firstName: form.fatherName?.split(" ")[0] || "Parent",
        lastName:
          form.fatherName?.split(" ").slice(1).join(" ") ||
          form.motherName ||
          "User",
      });
    }

    // Create patient
    const patient = await Patient.create({
      parentId: user._id,
      fullName: form.childName,
      parentInfo: {
        name: form.fatherName,
        phone: form.phone.toString(),
        email: form.email,
        relationship: "Father",
      },
      emergencyContact: {
        name: form.motherName || "N/A",
        relation: "Mother",
        phone: form.phone.toString(),
      },
    });

    // Create formal appointment
    const appointment = await Appointment.create({
      userId: user._id,
      patientId: patient._id,
      patientName: form.childName,
      fatherName: form.fatherName,
      email: form.email,
      phone: form.phone,
      serviceId: req.body.serviceId,
      therapistId: req.body.therapistId,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      type: req.body.type,
      status: "scheduled",
      payment: {
        amount: req.body.paymentAmount || 0,
        method: req.body.paymentMethod || "not_specified",
        status: "pending",
      },
      notes: form.notes,
      assignedBy: req.user._id,
      assignedAt: new Date(),
    });

    // Mark the form as converted
    form.status = "scheduled";
    form.status = "converted";
    await form.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      message: "Appointment scheduled",
      data: appointment,
    });
  } catch (error) {
    console.error("Conversion error:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Create formal appointment
// @route   POST /api/appointments
// @access  Private (Admin, Receptionist)
exports.createAppointment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const {
      patientName,
      fatherName,
      email,
      phone,
      serviceId,
      therapistId,
      date,
      startTime,
      endTime,
      type,
      notes,
      address,
      paymentAmount,
      paymentMethod,
    } = req.body;

    // Check service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return res
        .status(404)
        .json({ success: false, error: "Service not found!" });
    }

    // Check therapist if provided
    if (therapistId) {
      const therapist = await User.findById(therapistId);
      if (!therapist || therapist.role !== "therapist") {
        return res
          .status(404)
          .json({ success: false, error: "Therapist not found!" });
      }
    }

    // Check or create User (parent)
    let user = await User.findOne({ email });
    if (!user) {
      const nameParts = fatherName.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "Doe";
      user = await User.create({
        email,
        password: "temporary", // You may want to trigger a reset process
        role: "parent",
        firstName: firstName,
        lastName: lastName,
        phone: phone,
      });
    }

    // Create patient record
    const patient = await Patient.create({
      parentId: user._id,
      fullName: patientName,
      parentInfo: {
        name: fatherName,
        phone: phone,
        email: email,
        relationship: "Father",
      },
      emergencyContact: {
        name: fatherName,
        relation: "Father",
        phone: phone,
      },
    });

    // Create appointment
    const appointment = await Appointment.create({
      userId: user._id,
      patientId: patient._id,
      patientName,
      fatherName,
      email,
      phone,
      serviceId,
      therapistId: therapistId || null,
      date,
      startTime,
      endTime,
      type: type || "initial assessment",
      status: therapistId ? "scheduled" : "pending_assignment",
      notes,
      address,
      payment: {
        amount: paymentAmount || 0,
        method: paymentMethod || "not_specified",
        status: "pending",
      },
      assignedBy: req.user._id || null,
      assignedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Appointment created",
      data: appointment,
    });
  } catch (error) {
    console.error("Create appointment error:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

// =======================
// FORMAL APPOINTMENT MANAGEMENT
// =======================

// @desc    Update appointment
// @route   PUT /api/appointments/:id
// @access  Private (Admin, Receptionist, Therapist)
exports.updateAppointment = async (req, res) => {
  try {
    let appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, error: "Appointment not found" });
    }

    if (
      req.user.role !== "admin" &&
      req.user.role !== "receptionist" &&
      appointment.therapistId?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: appointment });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
// @access  Private (Admin, Receptionist)
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, error: "Appointment not found" });
    }

    if (req.user.role !== "admin" && req.user.role !== "receptionist") {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    await appointment.deleteOne();

    res.status(200).json({ success: true, message: "Appointment deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Reschedule appointment
// @route   PUT /api/appointments/:id/reschedule
// @access  Private (Admin, Receptionist, Therapist)
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { date, startTime, endTime, therapistId, reason } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: "Date, startTime, and endTime are required",
      });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // If changing therapist, validate therapist
    if (therapistId) {
      const therapist = await User.findById(therapistId);
      if (!therapist || therapist.role !== "therapist") {
        return res.status(404).json({
          success: false,
          error: "Therapist not found",
        });
      }
      appointment.therapistId = therapistId;
    }

    // Update appointment fields
    appointment.date = date;
    appointment.startTime = startTime;
    appointment.endTime = endTime;
    appointment.status = "rescheduled";
    appointment.notes = `${appointment.notes || ""}\nRescheduled: ${
      reason || ""
    }`;

    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled",
      data: appointment,
    });
  } catch (err) {
    console.error("Reschedule error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Private (Admin, Therapist, Receptionist)
exports.getAppointments = async (req, res) => {
  try {
    let query = {};

    // If user is a therapist, limit to their appointments
    if (req.user.role === "therapist") {
      query.therapistId = req.user._id;
    }

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by patient
    if (req.query.patientId) {
      query.patientId = req.query.patientId;
    }

    // Filter by user (who made the request)
    if (req.query.userId) {
      query.userId = req.query.userId;
    }

    // Filter by therapist (only admins/receptionists can specify therapistId in query)
    if (req.query.therapistId && req.user.role !== "therapist") {
      query.therapistId = req.query.therapistId;
    }

    // Filter by date range
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
        select: "fullName dateOfBirth gender",
      })
      .populate({
        path: "therapistId",
        select: "firstName lastName email",
        model: "User",
      })
      .populate({
        path: "userId",
        select: "firstName lastName email",
        model: "User",
      })
      .populate({
        path: "serviceId",
        select: "name category",
      })
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    console.error("Get appointments error:", err);
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

    // Base query
    const query = {
      date: {
        $gte: dateStart,
        $lte: dateEnd,
      },
    };

    // If therapist, limit to their appointments
    if (req.user.role === "therapist") {
      query.therapistId = req.user._id;
    }

    //Fetch all appointments for today
    const appointments = await Appointment.find(query)
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

    // Helper to format Date object to 12-hour time string (e.g., "10:45 AM")
    // const formatTime = (timeStr) => {
    //   const [time, modifier] = timeStr.split(" ");
    //   let [hours, minutes] = time.split(":").map(Number);
    //   if (modifier === "PM" && hours !== 12) hours += 12;
    //   if (modifier === "AM" && hours === 12) hours = 0;
    //   const date = new Date();
    //   date.setHours(hours, minutes);
    //   return date.toLocaleTimeString([], {
    //     hour: "numeric",
    //     minute: "2-digit",
    //     hour12: true,
    //   });
    // };

    //Group appointments by therapist
    const calendar = {};

    appointments.forEach((appt) => {
      const therapistName = `Dr. ${appt.therapistId.firstName} ${appt.therapistId.lastName}`;
      const startFormatted = appt.startTime;

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
        select:
          "firstName lastName fullName dateOfBirth gender emergencyContact parentId",
      })
      .populate({
        path: "therapistId",
        select: "firstName lastName email phone",
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

    // Access check: admin/receptionist can see all; therapist can see own; parent can see their child's appointment
    if (
      req.user.role !== "admin" &&
      req.user.role !== "receptionist" &&
      (!appointment.therapistId ||
        appointment.therapistId._id.toString() !== req.user._id.toString())
    ) {
      // If patient exists, check parent relationship
      if (appointment.patientId && appointment.patientId.parentId) {
        if (
          appointment.patientId.parentId.toString() !== req.user._id.toString()
        ) {
          return res.status(403).json({
            success: false,
            error: "Not authorized to view this appointment",
          });
        }
      } else {
        // If no patient or no parent info, restrict access
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
    console.error("Get appointment error:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Update appointment status
// @route   PUT /api/appointments/:id/status
// @access  Private (Admin, Therapist, Receptionist)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    // Validate status input
    const validStatuses = ["scheduled", "completed", "cancelled", "no-show"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error:
          "A valid status is required: scheduled, completed, cancelled, or no-show",
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // Permission check
    if (
      req.user.role !== "admin" &&
      req.user.role !== "receptionist" &&
      (!appointment.therapistId ||
        appointment.therapistId.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this appointment status",
      });
    }

    // Update status
    appointment.status = status;
    await appointment.save();

    res.status(200).json({
      success: true,
      message: `Appointment status updated to ${status}`,
      data: appointment,
    });
  } catch (err) {
    console.error("Update appointment status error:", err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};
