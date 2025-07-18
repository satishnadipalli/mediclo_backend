const Appointment = require("../models/Appointment");
const AppointmentForm = require("../models/AppointmentForm");
const Patient = require("../models/Patient");
const User = require("../models/User");
const Service = require("../models/Service");
const { body, validationResult } = require("express-validator");
const sendEmail = require("../utils/mailer");
const appointmentConfirmation = require("../emails/appointmentConfirmation"); //email
const appointmentReschedule = require("../emails/appointmentReschedule"); //email

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




// Above Controllers are un-necessary
// @desc    Create formal appointment
// @route   POST /api/appointments
// @access  Private (Admin, Receptionist)

exports.createAppointment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const {
      patientId,
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
      consultationMode,
      consent,
      totalSessions,
    } = req.body;

    // Validate service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res
        .status(404)
        .json({ success: false, error: "Service not found!" });
    }

    // Validate therapist
    const therapist = await User.findById(therapistId);
    if (!therapist || therapist.role !== "therapist") {
      return res
        .status(404)
        .json({ success: false, error: "Therapist not found!" });
    }

    // Determine patient
    let patient;
    if (patientId) {
      patient = await Patient.findById(patientId);
      if (!patient) {
        return res
          .status(404)
          .json({ success: false, error: "Patient not found!" });
      }
    } else {
      patient = await Patient.create({
        fullName: patientName,
        parentInfo: {
          name: fatherName,
          phone: phone,
          email: email,
          relationship: "Father",
        },
      });
    }

    const appointment = await Appointment.create({
      userId: req?.user?._id,
      patientId: patient?._id,
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
      consultationMode,
      notes,
      address,
      payment: {
        amount: paymentAmount || 0,
        method: paymentMethod || "not_specified",
        status: "pending",
      },
      consent: consent || false,
      totalSessions: totalSessions || 1,
      status: "scheduled",
      assignedBy: req?.user?._id,
      assignedAt: new Date(),
    });

    //Send confirmation email
    try {
      await sendEmail({
        to: email,
        subject: "Your Appointment Confirmation",
        html: appointmentConfirmation({
          name: patientName || fatherName || "User",
          service: service.name,
          date,
          startTime,
          endTime,
          therapist: therapist.fullName,
          consultationMode,
        }),
      });
      console.log("Confirmation email sent to:", email);
    } catch (emailErr) {
      console.error("Failed to send confirmation email:", emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Appointment created successfully",
      data: appointment,
    });
  } catch (err) {
    console.error("Create appointment error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
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
    console.log("Incoming payment update:", req.body.payment);

    // Find the appointment
    let appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // Optional authorization check (commented out for now)
    /*
    if (
      req?.user?.role !== "admin" &&
      req?.user?.role !== "receptionist" &&
      appointment.therapistId?.toString() !== req?.user?._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized",
      });
    }
    */

    //Update the appointment's payment info
    appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      {
        "payment.amount": req.body.payment.amount,
        "payment.status": req.body.payment.status,
        "payment.method": req.body.payment.method,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    // Fetch all patients
    let patients = await Patient.find({}).lean();

    // Fetch all appointments for all patients
    const allAppointments = await Appointment.find({
      patientId: { $in: patients.map((p) => p._id) },
    }).sort({ date: 1 });

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

    //Attach latest appointment & age to each patient
    patients = patients.map((patient) => {
      const relevantAppointments = allAppointments.filter(
        (appt) => appt.patientId.toString() === patient._id.toString()
      );

      const future = relevantAppointments.find((a) => a.date > new Date());
      const past = [...relevantAppointments]
        .reverse()
        .find((a) => a.date <= new Date());

      return {
        ...patient,
        latestAppointment: future
          ? {
              id: future._id,
              method: future?.payment?.method,
              amount: future?.payment?.amount,
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

    // Sort patients by earliest upcoming appointment
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

    // Final response
    return res.status(200).json({
      success: true,
      updatedAppointment: appointment,
      data: patients,
    });
  } catch (err) {
    console.error("Update error:", err);
    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

//Update Appointment status
exports.updateAppointmentStatusAndDetails = async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // Find the appointment
    const appointment = await Appointment.findById(id)
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      })
    }

    // Special handling for completion - SINGLE APPOINTMENT ONLY
    if (updates.status === "completed") {
      // Auto-increment sessionsCompleted by 1 if not explicitly provided
      if (updates.sessionsCompleted === undefined) {
        updates.sessionsCompleted = appointment.sessionsCompleted + 1
      }

      // Ensure sessionsCompleted doesn't exceed totalSessions
      if (updates.sessionsCompleted > appointment.totalSessions) {
        updates.sessionsCompleted = appointment.totalSessions
      }

      // Auto-update payment status to paid if completing and amount is set
      if (updates.payment && updates.payment.amount > 0 && !updates.payment.status) {
        updates.payment.status = "paid"
      }
    }

    // Update ONLY this specific appointment
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      {
        ...updates,
        // Merge payment object properly
        ...(updates.payment && {
          payment: {
            ...appointment.payment,
            ...updates.payment,
          },
        }),
      },
      {
        new: true,
        runValidators: true,
      },
    ).populate("userId patientId therapistId serviceId assignedBy")

    res.json({
      success: true,
      message: "Appointment updated successfully",
      data: updatedAppointment,
    })
  } catch (error) {
    console.error("Error updating appointment:", error)
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update appointment",
    })
  }
}

// Enhanced reschedule function with availability checking
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { date, startTime, endTime, therapistId, reason } = req.body

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: "Date, startTime, and endTime are required",
      })
    }

    const appointment = await Appointment.findById(req.params.id)
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      })
    }

    // Check for conflicts with the new time slot
    const conflictCheck = await Appointment.findOne({
      therapistId: therapistId || appointment.therapistId,
      date: new Date(date),
      _id: { $ne: appointment._id }, // Exclude current appointment
      status: { $ne: "cancelled" },
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
    })

    if (conflictCheck) {
      return res.status(400).json({
        success: false,
        error: "Selected time slot is not available",
      })
    }

    // If changing therapist, validate therapist
    if (therapistId && therapistId !== appointment.therapistId.toString()) {
      const therapist = await User.findById(therapistId)
      if (!therapist || therapist.role !== "therapist") {
        return res.status(404).json({
          success: false,
          error: "Therapist not found",
        })
      }
      appointment.therapistId = therapistId
    }

    // Update appointment fields
    appointment.date = new Date(date)
    appointment.startTime = startTime
    appointment.endTime = endTime
    appointment.status = "rescheduled"
    appointment.notes = `${appointment.notes || ""}\nRescheduled: ${reason || ""}`

    await appointment.save()

    // Fetch related service and therapist data for email
    const [service, therapist] = await Promise.all([
      Service.findById(appointment.serviceId),
      User.findById(appointment.therapistId),
    ])

    // Send reschedule email
    try {
      await sendEmail({
        to: appointment.email,
        subject: "Your Appointment Has Been Rescheduled",
        html: appointmentReschedule({
          name: appointment.patientName || appointment.fatherName || "User",
          service: service?.name || "Service",
          date: appointment.date,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          therapist: therapist?.fullName || "Therapist",
          reason,
        }),
      })
      console.log("Reschedule email sent to:", appointment.email)
    } catch (err) {
      console.error("Failed to send reschedule email:", err.message)
    }

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      data: appointment,
    })
  } catch (err) {
    console.error("Reschedule error:", err)
    res.status(500).json({ success: false, error: "Server Error" })
  }
}

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
    // Get date from query params or default to today
    const requestedDate = req.query.date;
    let dateStart, dateEnd;

    if (requestedDate) {
      // Use the requested date
      const targetDate = new Date(requestedDate);
      dateStart = new Date(targetDate.setHours(0, 0, 0, 0));
      dateEnd = new Date(targetDate.setHours(23, 59, 59, 999));
    } else {
      // Default to today
      const now = new Date();
      dateStart = new Date(now.setHours(0, 0, 0, 0));
      dateEnd = new Date(now.setHours(23, 59, 59, 999));
    }

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

    // Fetch all appointments for the specified date with full population
    const appointments = await Appointment.find(query)
      .populate("therapistId", "firstName lastName email specialization")
      .populate(
        "patientId",
        "fullName childName age dateOfBirth childDOB gender childGender"
      )
      .populate("serviceId", "name price duration")
      .sort({ "therapistId.lastName": 1, startTime: 1 });

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

    const calendar = {};

    // Loop through appointments
    appointments.forEach((appt) => {
      const therapist = appt.therapistId;
      if (!therapist || !therapist.firstName || !therapist.lastName) return;

      const therapistName = `Dr. ${therapist.firstName} ${therapist.lastName}`;
      const startFormatted = appt.startTime;

      // Initialize calendar slots for this therapist
      if (!calendar[therapistName]) {
        calendar[therapistName] = {};
        timeSlots.forEach((slot) => {
          calendar[therapistName][slot] = null;
        });
      }

      console.log("Processing appointment:", appt._id);

      // Fill in if the slot is in list and still empty
      if (
        timeSlots.includes(startFormatted) &&
        !calendar[therapistName][startFormatted]
      ) {
        // Extract patient name with fallback logic
        const patientName =
          appt.patientName ||
          appt.patientId?.fullName ||
          appt.patientId?.childName ||
          "N/A";

        // Calculate duration
        const duration = calculateDuration(appt.startTime, appt.endTime);

        // Build the appointment object with all required data
        calendar[therapistName][startFormatted] = {
          id: appt._id.toString(),
          patientId: appt.patientId?._id?.toString() || null,
          doctorId: therapist._id.toString(),
          patientName: patientName,
          type: appt.type || "initial assessment",
          status: appt.status || "scheduled",
          duration: duration,

          // Payment information (required by frontend)
          payment: {
            amount: appt.payment?.amount || 0,
            status: appt.payment?.status || "pending",
            method: appt.payment?.method || "not_specified",
          },

          // Session information (required by frontend)
          totalSessions: appt.totalSessions || 0,
          sessionsPaid: appt.sessionsPaid || 0,
          sessionsCompleted: appt.sessionsCompleted || 0,

          // Contact information (required by frontend)
          phone: appt.phone || "N/A",
          email: appt.email || "N/A",

          // Additional appointment details
          notes: appt.notes || "",
          consultationMode: appt.consultationMode || "in-person",
          fatherName: appt.fatherName || "",
          address: appt.address || "",

          // Service information if available
          serviceInfo: appt.serviceId
            ? {
                name: appt.serviceId.name,
                price: appt.serviceId.price,
                duration: appt.serviceId.duration,
              }
            : null,

          // Timestamps
          createdAt: appt.createdAt,
          updatedAt: appt.updatedAt,

          // Additional flags
          consent: appt.consent || false,
          isDraft: appt.isDraft || false,
        };
      }
    });

    // Add empty slots for doctors who don't have appointments but should appear in calendar
    // This ensures all active therapists appear in the calendar view
    if (req.user.role === "admin" || req.user.role === "receptionist") {
      // You might want to fetch all active therapists and ensure they have slots
      // This is optional based on your requirements
    }

    res.status(200).json({
      success: true,
      data: calendar,
      meta: {
        date: requestedDate || dateStart.toISOString().split("T")[0],
        totalAppointments: appointments.length,
        timeSlots: timeSlots,
      },
    });
  } catch (error) {
    console.error("Calendar fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
      message: error.message,
    });
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

// @desc    Get all appointments for a selected date
// @route   GET /api/appointments/by-date?date=YYYY-MM-DD
// @access  Private (admin, receptionist, therapist)
// for therapist list
exports.getAppointmentsByDate = async (req, res) => {
  try {
    const selectedDate = req.query.date;
    if (!selectedDate) {
      return res.status(400).json({
        success: false,
        message: "Date is required in query string (YYYY-MM-DD)",
      });
    }

    const dateStart = new Date(new Date(selectedDate).setHours(0, 0, 0, 0));
    const dateEnd = new Date(new Date(selectedDate).setHours(23, 59, 59, 999));

    const therapistQuery = { role: "therapist" };
    if (req.user.role === "therapist") {
      therapistQuery._id = req.user._id;
    }

    const therapists = await User.find(therapistQuery).select(
      "firstName lastName _id"
    );

    const appointments = await Appointment.find({
      date: { $gte: dateStart, $lte: dateEnd },
    })
      .populate("therapistId", "firstName lastName _id")
      .populate("patientId", "fullName");

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

    const calculateDuration = (start, end) => {
      const [sH, sM, sP] = start.match(/(\d+):(\d+)\s(AM|PM)/).slice(1);
      const [eH, eM, eP] = end.match(/(\d+):(\d+)\s(AM|PM)/).slice(1);
      const to24 = (h, p) => (p === "PM" ? (h % 12) + 12 : h % 12);
      const sDate = new Date(0, 0, 0, to24(+sH, sP), +sM);
      const eDate = new Date(0, 0, 0, to24(+eH, eP), +eM);
      return Math.round((eDate - sDate) / 60000);
    };

    const calendar = {};

    // Initialize
    therapists.forEach((t) => {
      calendar[t._id] = {
        name: `Dr. ${t.firstName} ${t.lastName}`,
        id: t._id,
        slots: {},
      };
      timeSlots.forEach((slot) => {
        calendar[t._id].slots[slot] = null;
      });
    });

    // Fill appointments
    appointments.forEach((appt) => {
      const t = appt.therapistId;
      if (!t || !calendar[t._id]) return;

      const slot = appt.startTime;
      if (timeSlots.includes(slot)) {
        calendar[t._id].slots[slot] = {
          id: appt._id,
          patientId: appt.patientId?._id || null,
          doctorId: t._id,
          patientName: appt.patientId?.fullName || "N/A",
          type: appt.type,
          status: appt.status,
          duration: calculateDuration(appt.startTime, appt.endTime),
        };
      }
    });

    const patients = await Patient.find({});

    return res.status(200).json({
      success: true,
      data: calendar,
      patients,
    });
  } catch (err) {
    console.error("getAppointmentsByDate error:", err);
    res.status(500).json({ success: false, error: "Server error" });
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

// @desc    Get all upcoming appointments for all therapists
// @route   GET /api/appointments/upcoming/all
// @access  Private (Admin, Receptionist)
exports.getAllUpcomingAppointmentsForTherapists = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Only allow access to admin or receptionist
    // if (!["admin", "receptionist"].includes(req?.user?.role)) {
    //   return res.status(403).json({
    //     success: false,
    //     error: "Access denied: Admin or Receptionist only",
    //   });
    // }

    const appointments = await Appointment.find({
      date: { $gte: today },
    })
      .populate("therapistId", "firstName lastName email")
      .populate("patientId", "fullName")
      .populate("serviceId", "name category")
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    console.error("Error fetching upcoming appointments:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};



exports.createMultipleAppointments = async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      fatherName,
      email,
      phone,
      serviceId,
      therapistId,
      dates, // Array of dates
      startTime,
      endTime,
      type,
      notes,
      address,
      paymentAmount,
      paymentMethod,
      consultationMode,
      consent,
      totalSessions,
    } = req.body

    // Validate required fields
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one date is required",
      })
    }

    // Validate service
    const service = await Service.findById(serviceId)
    if (!service) {
      return res.status(404).json({
        success: false,
        error: "Service not found!",
      })
    }

    // Validate therapist
    const therapist = await User.findById(therapistId)
    if (!therapist || therapist.role !== "therapist") {
      return res.status(404).json({
        success: false,
        error: "Therapist not found!",
      })
    }

    // Determine patient
    let patient
    if (patientId) {
      patient = await Patient.findById(patientId)
      if (!patient) {
        return res.status(404).json({
          success: false,
          error: "Patient not found!",
        })
      }
    } else {
      // Create new patient if not exists
      patient = await Patient.create({
        fullName: patientName,
        parentInfo: {
          name: fatherName,
          phone: phone,
          email: email,
          relationship: "Father",
        },
      })
    }

    // Check for conflicts across all dates
    const conflictCheck = await Appointment.find({
      therapistId: therapistId,
      date: { $in: dates.map((date) => new Date(date)) },
      status: { $ne: "cancelled" },
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
    })

    if (conflictCheck.length > 0) {
      const conflictDates = conflictCheck.map((appt) => appt.date.toISOString().split("T")[0])
      return res.status(400).json({
        success: false,
        error: `Therapist already has appointments on: ${conflictDates.join(", ")}`,
      })
    }

    // Create appointments for all dates
    const appointmentPromises = dates.map((date) => {
      return Appointment.create({
        userId: req?.user?._id,
        patientId: patient?._id,
        patientName,
        fatherName,
        email,
        phone,
        serviceId,
        therapistId,
        date: new Date(date),
        startTime,
        endTime,
        type,
        consultationMode,
        notes,
        address,
        payment: {
          amount: paymentAmount || 0,
          method: paymentMethod || "not_specified",
          status: "pending",
        },
        consent: consent || false,
        totalSessions: dates?.length || 1,
        status: "scheduled",
        assignedBy: req?.user?._id,
        assignedAt: new Date(),
      })
    })

    const createdAppointments = await Promise.all(appointmentPromises)

    // Send confirmation email for all appointments
    try {
      const appointmentDates = dates.map((date) => new Date(date).toLocaleDateString()).join(", ")

      await sendEmail({
        to: email,
        subject: "Your Appointments Confirmation",
        html: appointmentConfirmation({
          name: patientName || fatherName || "User",
          service: service.name,
          dates: appointmentDates, // Pass multiple dates
          startTime,
          endTime,
          therapist: therapist.fullName,
          consultationMode,
          appointmentCount: dates.length,
        }),
      })
      console.log("Confirmation email sent to:", email)
    } catch (emailErr) {
      console.error("Failed to send confirmation email:", emailErr.message)
    }

    return res.status(201).json({
      success: true,
      message: `${dates.length} appointments created successfully`,
      data: {
        appointments: createdAppointments,
        patient: patient,
        appointmentCount: dates.length,
      },
    })
  } catch (err) {
    console.error("Create multiple appointments error:", err)
    res.status(500).json({
      success: false,
      error: "Server Error",
      message: err.message,
    })
  }
}

// Update the existing updateAppointment function to handle bulk payment updates
exports.updatePatientAppointmentsPayment = async (req, res) => {
  try {
    const { patientId, paymentStatus, paymentMethod, paymentAmount } = req.body

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: "Patient ID is required",
      })
    }

    // Find all scheduled appointments for this patient
    const appointments = await Appointment.find({
      patientId: patientId,
      status: { $in: ["scheduled", "completed"] },
    })

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No appointments found for this patient",
      })
    }

    // Update all appointments
    const updatePromises = appointments.map((appointment) => {
      return Appointment.findByIdAndUpdate(
        appointment._id,
        {
          "payment.status": paymentStatus || appointment.payment.status,
          "payment.method": paymentMethod || appointment.payment.method,
          "payment.amount": paymentAmount !== undefined ? paymentAmount : appointment.payment.amount,
        },
        { new: true, runValidators: true },
      )
    })

    const updatedAppointments = await Promise.all(updatePromises)

    // Fetch updated patient data for response
    let patients = await Patient.find({}).lean()
    const allAppointments = await Appointment.find({
      patientId: { $in: patients.map((p) => p._id) },
    }).sort({ date: 1 })

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

    patients = patients.map((patient) => {
      const relevantAppointments = allAppointments.filter(
        (appt) => appt.patientId.toString() === patient._id.toString(),
      )
      const future = relevantAppointments.find((a) => a.date > new Date())
      const past = [...relevantAppointments].reverse().find((a) => a.date <= new Date())

      return {
        ...patient,
        latestAppointment: future
          ? {
              id: future._id,
              method: future?.payment?.method,
              amount: future?.payment?.amount,
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

    return res.status(200).json({
      success: true,
      message: `Updated ${updatedAppointments.length} appointments`,
      data: {
        updatedAppointments,
        patients,
        updateCount: updatedAppointments.length,
      },
    })
  } catch (err) {
    console.error("Update patient appointments payment error:", err)
    return res.status(500).json({
      success: false,
      error: "Server Error",
      message: err.message,
    })
  }
}

// Get payment summary for dashboard
exports.getPaymentSummary = async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments()

    const appointments = await Appointment.find({}).lean()

    const summary = appointments.reduce(
      (acc, apt) => {
        if (apt.payment?.status === "paid") {
          acc.totalRevenue += apt.payment.amount
          acc.completedPayments += 1
        } else if (apt.payment?.status === "partial") {
          acc.totalRevenue += apt.payment.paidAmount || 0
          acc.partialPayments += 1
        } else if (apt.payment?.status === "pending") {
          acc.pendingPayments += 1
        }
        return acc
      },
      {
        totalPatients,
        totalRevenue: 0,
        pendingPayments: 0,
        completedPayments: 0,
        partialPayments: 0,
      },
    )

    res.json({
      success: true,
      data: summary,
    })
  } catch (error) {
    console.error("Error fetching payment summary:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment summary",
      error: error.message,
    })
  }
}

exports.getPatientsWithAppointments = async (req, res) => {
  try {
    // Fetch all patients
    const patients = await Patient.find({}).lean()

    // For each patient, get their appointments with payment details
    const patientsWithAppointments = await Promise.all(
      patients.map(async (patient) => {
        const appointments = await Appointment.find({
          patientId: patient._id,
        })
          .populate("serviceId", "name price")
          .populate("therapistId", "fullName")
          .sort({ date: -1 })
          .lean()

        // Transform appointments to include payment details
        const transformedAppointments = appointments.map((apt) => ({
          _id: apt._id,
          date: apt.date,
          startTime: apt.startTime,
          endTime: apt.endTime,
          type: apt.type,
          status: apt.status,
          payment: {
            amount: apt.payment?.amount || 0,
            status: apt.payment?.status || "pending",
            method: apt.payment?.method || "not_specified",
            paidAmount: apt.payment?.paidAmount || 0,
          },
          service: {
            name: apt.serviceId?.name || "Unknown Service",
            price: apt.serviceId?.price || 0,
          },
          therapist: {
            name: apt.therapistId?.fullName || "Unknown Therapist",
            _id: apt.therapistId?._id,
          },
          totalSessions: apt.totalSessions || 1,
          sessionsCompleted: apt.sessionsCompleted || 0,
          sessionsPaid: apt.sessionsPaid || 0,
        }))

        // Calculate payment summary
        const totalAppointments = transformedAppointments.length
        const completedAppointments = transformedAppointments.filter((apt) => apt.status === "completed").length

        const pendingPayments = transformedAppointments.filter(
          (apt) => apt.payment.status === "pending" || apt.payment.status === "partial",
        ).length

        const totalOwed = transformedAppointments.reduce((sum, apt) => {
          if (apt.payment.status === "pending") {
            return sum + apt.payment.amount
          } else if (apt.payment.status === "partial") {
            return sum + (apt.payment.amount - apt.payment.paidAmount)
          }
          return sum
        }, 0)

        const totalPaid = transformedAppointments.reduce((sum, apt) => {
          if (apt.payment.status === "paid") {
            return sum + apt.payment.amount
          } else if (apt.payment.status === "partial") {
            return sum + apt.payment.paidAmount
          }
          return sum
        }, 0)

        return {
          ...patient,
          appointments: transformedAppointments,
          totalAppointments,
          completedAppointments,
          pendingPayments,
          totalOwed,
          totalPaid,
        }
      }),
    )

    res.json({
      success: true,
      data: patientsWithAppointments,
    })
  } catch (error) {
    console.error("Error fetching patients with appointments:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch patient data",
      error: error.message,
    })
  }
}

// Add this new function to process payments
exports.processAppointmentPayment = async (req, res) => {
  try {
    const { patientId, appointmentIds, paymentAmount, paymentMethod, paymentType } = req.body

    // Validate input
    if (!appointmentIds || appointmentIds.length === 0 || !paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment data provided",
      })
    }

    // Find the appointments
    const appointments = await Appointment.find({
      _id: { $in: appointmentIds },
    }).populate("serviceId therapistId patientId")

    if (appointments.length !== appointmentIds.length) {
      return res.status(404).json({
        success: false,
        message: "Some appointments not found",
      })
    }

    // Calculate total owed for selected appointments
    const totalOwed = appointments.reduce((sum, apt) => {
      const remaining = (apt.payment?.amount || 0) - (apt.payment?.paidAmount || 0)
      return sum + Math.max(0, remaining)
    }, 0)

    if (paymentAmount > totalOwed) {
      return res.status(400).json({
        success: false,
        message: "Payment amount exceeds total owed",
      })
    }

    // Process payment distribution
    let remainingPayment = paymentAmount
    const updatedAppointments = []

    for (const appointment of appointments) {
      if (remainingPayment <= 0) break

      const currentOwed = (appointment.payment?.amount || 0) - (appointment.payment?.paidAmount || 0)
      if (currentOwed <= 0) continue

      const paymentForThisAppointment = Math.min(remainingPayment, currentOwed)
      const newPaidAmount = (appointment.payment?.paidAmount || 0) + paymentForThisAppointment

      // Determine new payment status
      let newPaymentStatus = "partial"
      if (newPaidAmount >= (appointment.payment?.amount || 0)) {
        newPaymentStatus = "paid"
      } else if (newPaidAmount === 0) {
        newPaymentStatus = "pending"
      }

      // Update appointment
      const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointment._id,
        {
          $set: {
            "payment.status": newPaymentStatus,
            "payment.method": paymentMethod,
            "payment.paidAmount": newPaidAmount,
            "payment.lastPaymentDate": new Date(),
          },
        },
        { new: true, runValidators: true },
      ).populate("serviceId therapistId patientId")

      updatedAppointments.push(updatedAppointment)
      remainingPayment -= paymentForThisAppointment
    }

    res.json({
      success: true,
      message: `Payment of $${paymentAmount} processed successfully`,
      data: {
        processedAmount: paymentAmount,
        updatedAppointments: updatedAppointments.length,
        appointments: updatedAppointments,
      },
    })
  } catch (error) {
    console.error("Error processing payment:", error)
    res.status(500).json({
      success: false,
      message: "Failed to process payment",
      error: error.message,
    })
  }
}