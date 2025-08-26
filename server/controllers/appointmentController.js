const Appointment = require("../models/Appointment");
const AppointmentForm = require("../models/AppointmentForm");
const Patient = require("../models/Patient");
const User = require("../models/User");
const Service = require("../models/Service");
const { body, validationResult } = require("express-validator");
const sendEmail = require("../utils/mailer");
const appointmentConfirmation = require("../emails/appointmentConfirmation");
const appointmentReschedule = require("../emails/appointmentReschedule");
const mongoose = require("mongoose");
const { sendAppointmentReminder } = require("../services/whatsapp");
// const { sendAppointmentReminder } = require("../services/whatsapp")
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
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

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

    // Create appointment
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

    // -------------------------
    // 📌 Extra logic for reminders
    // -------------------------

    try {
      const now = new Date();
      const apptDate = new Date(date); // date from body (expected ISO string or yyyy-mm-dd)

      // Normalize to only date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Condition: If appointment is tomorrow & current time > 12 PM today
      const isTomorrow =
        apptDate.getFullYear() === tomorrow.getFullYear() &&
        apptDate.getMonth() === tomorrow.getMonth() &&
        apptDate.getDate() === tomorrow.getDate();

      const isAfterNoon = now.getHours() >= 12;

      console.log("helllo iam wroking ");
      if (isTomorrow && isAfterNoon) {
        console.log(
          "⏰ Sending immediate reminder since it's after 12PM today for tomorrow’s appointment"
        );
        await sendAppointmentReminder(appointment._id); // pass appointment ID
      }
    } catch (error) {
      console.error("⚠️ Reminder send logic failed:", error.message);
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
      "06:00 PM",
      "06:45 PM",
      "07:30 PM",
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
        : Number.POSITIVE_INFINITY;
      const bDate = b.latestAppointment?.appointmentDate
        ? new Date(b.latestAppointment.appointmentDate)
        : Number.POSITIVE_INFINITY;

      if (aDate < bDate) return -1;
      if (aDate > bDate) return 1;

      const aSlotIndex = timeOrder.indexOf(
        a.latestAppointment?.appointmentSlot || ""
      );
      // A slot a is said to be schedules if thte slting and the final updating aree the better uproachies fo the stiffs
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
    const { id } = req.params;
    const updates = req.body;

    // Find the appointment
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Handle cancellation: Update status to cancelled and handle payment status
    if (updates.status === "cancelled") {
      const paymentUpdates = {};

      // If appointment was paid, mark payment as refunded
      if (appointment.payment.status === "paid") {
        paymentUpdates.status = "refunded";
      }

      // If appointment was pending, keep it as pending (no refund needed)
      const updatedAppointment = await Appointment.findByIdAndUpdate(
        id,
        {
          status: "cancelled",
          cancelledAt: new Date(),
          // Update payment status based on original status
          ...(Object.keys(paymentUpdates).length > 0 && {
            payment: {
              ...appointment.payment,
              ...paymentUpdates,
            },
          }),
          ...updates, // This allows for additional cancellation notes, etc.
        },
        {
          new: true,
          runValidators: true,
        }
      ).populate("userId patientId therapistId serviceId assignedBy");

      return res.json({
        success: true,
        message:
          "Appointment cancelled successfully. Slot is now available for booking.",
        data: updatedAppointment,
      });
    }

    // Special handling for completion - SINGLE APPOINTMENT ONLY
    if (updates.status === "completed") {
      // Auto-increment sessionsCompleted by 1 if not explicitly provided
      if (updates.sessionsCompleted === undefined) {
        updates.sessionsCompleted = appointment.sessionsCompleted + 1;
      }

      // Ensure sessionsCompleted doesn't exceed totalSessions
      if (updates.sessionsCompleted > appointment.totalSessions) {
        updates.sessionsCompleted = appointment.totalSessions;
      }

      // Auto-update payment status to paid if completing and amount is set
      if (
        updates.payment &&
        updates.payment.amount > 0 &&
        !updates.payment.status
      ) {
        updates.payment.status = "paid";
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
      }
    ).populate("userId patientId therapistId serviceId assignedBy");

    res.json({
      success: true,
      message: "Appointment updated successfully",
      data: updatedAppointment,
    });
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update appointment",
    });
  }
};

// Enhanced reschedule function with availability checking
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { date, startTime, endTime, therapistId, reason, paymentStatus } =
      req.body;
    console.log("Received reschedule request:", {
      date,
      startTime,
      endTime,
      therapistId,
      reason,
      paymentStatus,
    });

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

    console.log(
      "Original appointment payment status:",
      appointment.payment.status
    );

    // Check if appointment is cancelled (only cancelled appointments should be rescheduled via this flow)
    if (appointment.status !== "cancelled") {
      return res.status(400).json({
        success: false,
        error:
          "Only cancelled appointments can be rescheduled through this process",
      });
    }

    // Check for conflicts with the new time slot
    const conflictCheck = await Appointment.findOne({
      therapistId: therapistId || appointment.therapistId,
      date: new Date(date),
      _id: { $ne: appointment._id },
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
    });

    if (conflictCheck) {
      return res.status(400).json({
        success: false,
        error: "Selected time slot is not available",
      });
    }

    // If changing therapist, validate therapist
    if (therapistId && therapistId !== appointment.therapistId.toString()) {
      const therapist = await User.findById(therapistId);
      if (!therapist || therapist.role !== "therapist") {
        return res.status(404).json({
          success: false,
          error: "Therapist not found",
        });
      }
    }

    // Determine the new payment status - THIS IS THE KEY FIX
    let newPaymentStatus = "pending"; // Default
    if (paymentStatus) {
      // ALWAYS use the payment status explicitly provided by the receptionist
      newPaymentStatus = paymentStatus;
      console.log("Using provided payment status:", newPaymentStatus);
    } else {
      // Fallback logic if no payment status provided
      if (appointment.payment.status === "refunded") {
        newPaymentStatus = "paid";
      } else {
        newPaymentStatus = "pending";
      }
      console.log("Using fallback payment status:", newPaymentStatus);
    }

    // Update notes with reschedule reason
    const rescheduleNote = `Rescheduled on ${new Date().toLocaleDateString()}: ${
      reason || "No reason provided"
    }`;
    const updatedNotes = appointment.notes
      ? `${appointment.notes}\n${rescheduleNote}`
      : rescheduleNote;

    // Create the update object with explicit payment status
    const updateData = {
      date: new Date(date),
      startTime: startTime,
      endTime: endTime,
      status: "scheduled",
      therapistId: therapistId || appointment.therapistId,
      notes: updatedNotes,
      // CRITICAL: Explicitly set the entire payment object
      "payment.status": newPaymentStatus,
      "payment.amount": appointment.payment.amount,
      "payment.method": appointment.payment.method,
    };

    console.log("Update data being sent to database:", updateData);

    // Use findByIdAndUpdate with dot notation for nested fields
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true, // Return the updated document
        runValidators: true,
      }
    ).populate("userId patientId therapistId serviceId assignedBy");

    if (!updatedAppointment) {
      return res.status(404).json({
        success: false,
        error: "Failed to update appointment",
      });
    }

    console.log(
      "Updated appointment payment status:",
      updatedAppointment.payment.status
    );

    // Fetch related service and therapist data for email
    const [service, therapist] = await Promise.all([
      Service.findById(updatedAppointment.serviceId),
      User.findById(updatedAppointment.therapistId),
    ]);

    // Send reschedule email
    try {
      await sendEmail({
        to: updatedAppointment.email,
        subject: "Your Appointment Has Been Rescheduled",
        html: appointmentReschedule({
          name:
            updatedAppointment.patientName ||
            updatedAppointment.fatherName ||
            "User",
          service: service?.name || "Service",
          date: updatedAppointment.date,
          startTime: updatedAppointment.startTime,
          endTime: updatedAppointment.endTime,
          therapist: therapist?.fullName || "Therapist",
          reason,
          paymentStatus: newPaymentStatus,
        }),
      });
      console.log("Reschedule email sent to:", updatedAppointment.email);
    } catch (err) {
      console.error("Failed to send reschedule email:", err.message);
    }

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      data: updatedAppointment,
    });
  } catch (err) {
    console.error("Reschedule error:", err);
    res.status(500).json({
      success: false,
      error: "Server Error",
      details: err.message,
    });
  }
};

exports.dashboardRescheduleAppointment = async (req, res) => {
  try {
    const { date, startTime, endTime, therapistId, reason } = req.body;
    console.log("Dashboard reschedule request:", {
      appointmentId: req.params.id,
      date,
      startTime,
      endTime,
      therapistId,
      reason,
    });

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

    console.log("Original appointment found:", {
      id: appointment._id,
      status: appointment.status,
      date: appointment.date,
      startTime: appointment.startTime,
    });

    // Check for conflicts with the new time slot
    const conflictCheck = await Appointment.findOne({
      therapistId: therapistId || appointment.therapistId,
      date: new Date(date),
      _id: { $ne: appointment._id },
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
    });

    if (conflictCheck) {
      return res.status(400).json({
        success: false,
        error: "Selected time slot is not available",
      });
    }

    // If changing therapist, validate therapist
    if (therapistId && therapistId !== appointment.therapistId.toString()) {
      const therapist = await User.findById(therapistId);
      if (!therapist || therapist.role !== "therapist") {
        return res.status(404).json({
          success: false,
          error: "Therapist not found",
        });
      }
    }

    // Update notes with reschedule reason
    const rescheduleNote = `Rescheduled on ${new Date().toLocaleDateString()}: ${
      reason || "No reason provided"
    }`;
    const updatedNotes = appointment.notes
      ? `${appointment.notes}\n${rescheduleNote}`
      : rescheduleNote;

    // Simple update - just change date/time, keep everything else the same
    const updateData = {
      date: new Date(date),
      startTime: startTime,
      endTime: endTime,
      therapistId: therapistId || appointment.therapistId,
      notes: updatedNotes,
      // Keep status as is (don't change to scheduled if it was completed, etc.)
      // Keep payment status exactly as it was
    };

    console.log("Update data for dashboard reschedule:", updateData);

    // Use findByIdAndUpdate to ensure atomic update
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true, // Return the updated document
        runValidators: true,
      }
    ).populate("userId patientId therapistId serviceId assignedBy");

    if (!updatedAppointment) {
      return res.status(404).json({
        success: false,
        error: "Failed to update appointment",
      });
    }

    console.log("Updated appointment:", {
      id: updatedAppointment._id,
      status: updatedAppointment.status,
      date: updatedAppointment.date,
      startTime: updatedAppointment.startTime,
      paymentStatus: updatedAppointment.payment.status,
    });

    // Fetch related service and therapist data for email
    const [service, therapist] = await Promise.all([
      Service.findById(updatedAppointment.serviceId),
      User.findById(updatedAppointment.therapistId),
    ]);

    // Send reschedule email
    try {
      await sendEmail({
        to: updatedAppointment.email,
        subject: "Your Appointment Has Been Rescheduled",
        html: appointmentReschedule({
          name:
            updatedAppointment.patientName ||
            updatedAppointment.fatherName ||
            "User",
          service: service?.name || "Service",
          date: updatedAppointment.date,
          startTime: updatedAppointment.startTime,
          endTime: updatedAppointment.endTime,
          therapist: therapist?.fullName || "Therapist",
          reason,
          paymentStatus: updatedAppointment.payment.status,
        }),
      });
      console.log("Reschedule email sent to:", updatedAppointment.email);
    } catch (err) {
      console.error("Failed to send reschedule email:", err.message);
    }

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      data: updatedAppointment,
    });
  } catch (err) {
    console.error("Dashboard reschedule error:", err);
    res.status(500).json({
      success: false,
      error: "Server Error",
      details: err.message,
    });
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

// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Private (Admin, Therapist, Receptionist)
exports.getAppointments = async (req, res) => {
  try {
    const query = {};

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

    // Separate individual appointments and group sessions
    const individualAppointments = [];
    const groupSessionsMap = new Map();

    appointments.forEach((apt) => {
      if (apt.isGroupSession && apt.groupSessionId) {
        const groupId = apt.groupSessionId.toString();

        if (!groupSessionsMap.has(groupId)) {
          groupSessionsMap.set(groupId, {
            _id: groupId,
            isGroupSession: true,
            groupSessionId: apt.groupSessionId,
            groupSessionName: apt.groupSessionName,
            maxCapacity: apt.maxCapacity,
            date: apt.date,
            startTime: apt.startTime,
            endTime: apt.endTime,
            therapistId: apt.therapistId,
            serviceId: apt.serviceId,
            type: apt.type,
            consultationMode: apt.consultationMode,
            notes: apt.notes,
            status: apt.status, // We'll determine the overall status
            assignedBy: apt.assignedBy,
            assignedAt: apt.assignedAt,
            createdAt: apt.createdAt,
            updatedAt: apt.updatedAt,
            patients: [],
            totalRevenue: 0,
            paidRevenue: 0,
            pendingRevenue: 0,
          });
        }

        const groupSession = groupSessionsMap.get(groupId);

        // Add patient to the group
        groupSession.patients.push({
          _id: apt._id,
          patientId: apt.patientId,
          patientName: apt.patientName,
          fatherName: apt.fatherName,
          email: apt.email,
          phone: apt.phone,
          payment: apt.payment,
          status: apt.status,
          totalSessions: apt.totalSessions,
          sessionsCompleted: apt.sessionsCompleted,
          sessionsPaid: apt.sessionsPaid,
          consent: apt.consent,
          notes: apt.notes,
        });

        // Calculate revenue
        groupSession.totalRevenue += apt.payment?.amount || 0;
        if (apt.payment?.status === "paid") {
          groupSession.paidRevenue += apt.payment.amount || 0;
        } else if (apt.payment?.status === "pending") {
          groupSession.pendingRevenue += apt.payment.amount || 0;
        }

        // Determine overall group status (priority: cancelled > completed > confirmed > scheduled)
        const statusPriority = {
          cancelled: 4,
          "no-show": 3,
          completed: 2,
          confirmed: 1,
          scheduled: 0,
        };

        const currentPriority = statusPriority[groupSession.status] || 0;
        const newPriority = statusPriority[apt.status] || 0;

        if (newPriority > currentPriority) {
          groupSession.status = apt.status;
        }
      } else {
        // Individual appointment
        individualAppointments.push(apt);
      }
    });

    // Convert group sessions map to array
    const groupSessions = Array.from(groupSessionsMap.values());

    // Combine individual appointments and group sessions
    const combinedData = [...individualAppointments, ...groupSessions].sort(
      (a, b) => {
        // Sort by date first, then by start time
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);

        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }

        // If dates are same, sort by start time
        const timeA = a.startTime;
        const timeB = b.startTime;
        return timeA.localeCompare(timeB);
      }
    );

    res.status(200).json({
      success: true,
      count: combinedData.length,
      individualCount: individualAppointments.length,
      groupSessionsCount: groupSessions.length,
      data: combinedData,
    });
  } catch (err) {
    console.error("Get appointments error:", err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @access  Private (Admin, Receptionist, Therapist)
exports.getAppointmentsCalendarView = async (req, res) => {
  try {
    const requestedDate = req.query.date;
    let dateStart, dateEnd;

    if (requestedDate) {
      const targetDate = new Date(requestedDate);
      dateStart = new Date(targetDate.setHours(0, 0, 0, 0));
      dateEnd = new Date(targetDate.setHours(23, 59, 59, 999));
    } else {
      const now = new Date();
      dateStart = new Date(now.setHours(0, 0, 0, 0));
      dateEnd = new Date(now.setHours(23, 59, 59, 999));
    }

    const query = {
      date: {
        $gte: dateStart,
        $lte: dateEnd,
      },
      status: { $ne: "cancelled" },
    };

    if (req.user.role === "therapist") {
      query.therapistId = req.user._id;
    }

    const appointments = await Appointment.find(query)
      .populate(
        "therapistId",
        "firstName lastName email specialization designation"
      )
      .populate(
        "patientId",
        "fullName childName age dateOfBirth childDOB gender childGender"
      )
      .populate("serviceId", "name price duration")
      .sort({ createdAt: -1 });

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
      "06:00 PM",
      "06:45 PM",
      "07:30 PM",
    ];

    const calendar = {};

    // Initialize calendar with therapists
    let therapists = [];
    if (req.user.role === "admin" || req.user.role === "receptionist") {
      therapists = await User.find({
        role: "therapist",
        isActive: true,
      }).select("firstName lastName designation");

      therapists.forEach((therapist) => {
        const therapistName = `Dr. ${therapist.firstName} ${
          therapist.lastName
        } (${therapist.designation || "N/A"})`;
        calendar[therapistName] = {};
        timeSlots.forEach((slot) => {
          calendar[therapistName][slot] = null;
        });
      });
    }

    // Group appointments by therapist, time slot, and group session
    const appointmentGroups = {};

    appointments.forEach((appt) => {
      const therapist = appt.therapistId;
      if (!therapist || !therapist.firstName || !therapist.lastName) return;

      const therapistName = `Dr. ${therapist.firstName} ${
        therapist.lastName
      } (${therapist.designation || "N/A"})`;
      const timeSlot = appt.startTime;

      if (!calendar[therapistName]) {
        calendar[therapistName] = {};
        timeSlots.forEach((slot) => {
          calendar[therapistName][slot] = null;
        });
      }

      if (!timeSlots.includes(timeSlot)) return;

      // Create grouping key
      const groupKey = `${therapistName}_${timeSlot}_${
        appt.groupSessionId || "individual_" + appt._id
      }`;

      if (!appointmentGroups[groupKey]) {
        appointmentGroups[groupKey] = {
          therapistName,
          timeSlot,
          isGroupSession: appt.isGroupSession || false,
          groupSessionId: appt.groupSessionId,
          groupSessionName: appt.groupSessionName,
          appointments: [],
        };
      }

      // Create appointment object
      const patientName =
        appt.patientName ||
        appt.patientId?.fullName ||
        appt.patientId?.childName ||
        "N/A";
      const duration = calculateDuration(appt.startTime, appt.endTime);

      const appointmentObj = {
        id: appt._id.toString(),
        patientId: appt.patientId?._id?.toString() || null,
        doctorId: therapist._id.toString(),
        patientName: patientName,
        type: appt.type || "initial assessment",
        status: appt.status || "scheduled",
        duration: duration,
        payment: {
          amount: appt.payment?.amount || 0,
          status: appt.payment?.status || "pending",
          method: appt.payment?.method || "not_specified",
        },
        totalSessions: appt.totalSessions || 0,
        sessionsPaid: appt.sessionsPaid || 0,
        sessionsCompleted: appt.sessionsCompleted || 0,
        phone: appt.phone || "N/A",
        email: appt.email || "N/A",
        notes: appt.notes || "",
        consultationMode: appt.consultationMode || "in-person",
        fatherName: appt.fatherName || "",
        address: appt.address || "",
        serviceInfo: appt.serviceId
          ? {
              name: appt.serviceId.name,
              price: appt.serviceId.price,
              duration: appt.serviceId.duration,
            }
          : null,
        createdAt: appt.createdAt,
        updatedAt: appt.updatedAt,
        consent: appt.consent || false,
        isDraft: appt.isDraft || false,
      };

      appointmentGroups[groupKey].appointments.push(appointmentObj);
    });

    // Process grouped appointments and assign to calendar
    Object.values(appointmentGroups).forEach((group) => {
      const {
        therapistName,
        timeSlot,
        isGroupSession,
        groupSessionId,
        groupSessionName,
        appointments,
      } = group;

      if (
        calendar[therapistName] &&
        calendar[therapistName][timeSlot] === null
      ) {
        if (isGroupSession && appointments.length > 1) {
          // Group session with multiple patients
          calendar[therapistName][timeSlot] = {
            isGroupSession: true,
            groupSessionId: groupSessionId,
            groupSessionName: groupSessionName,
            doctorId: appointments[0].doctorId,
            totalPatients: appointments.length,
            duration: appointments[0].duration,
            type: appointments[0].type,
            status: appointments[0].status,
            consultationMode: appointments[0].consultationMode,
            patients: appointments.map((apt) => ({
              id: apt.id,
              patientId: apt.patientId,
              patientName: apt.patientName,
              phone: apt.phone,
              email: apt.email,
              fatherName: apt.fatherName,
              payment: apt.payment,
              notes: apt.notes,
              address: apt.address,
              serviceInfo: apt.serviceInfo,
              createdAt: apt.createdAt,
              updatedAt: apt.updatedAt,
            })),
            totalRevenue: appointments.reduce(
              (sum, apt) => sum + (apt.payment?.amount || 0),
              0
            ),
            serviceInfo: appointments[0].serviceInfo,
          };
        } else {
          // Individual appointment (or single patient in group)
          calendar[therapistName][timeSlot] = appointments[0];
        }
      }
    });

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
    console.log(selectedDate, "selected-date");

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

    // Get all appointments for the date EXCEPT cancelled ones
    const appointments = await Appointment.find({
      date: { $gte: dateStart, $lte: dateEnd },
      status: { $ne: "cancelled" }, // Add this line to exclude cancelled appointments
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
      "06:00 PM",
      "06:45 PM",
      "07:30 PM",
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

    // Fill appointments (only non-cancelled ones will be here)
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

    // If cancelled, delete the appointment
    if (status === "cancelled") {
      console.log("Hello  i am working");
      await appointment.deleteOne();
      return res.status(200).json({
        success: true,
        message: "Appointment cancelled and deleted successfully",
      });
    }

    // Otherwise, just update the status
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

// Enhanced createMultipleAppointments with proper scheduling flow

// Enhanced createMultipleAppointments with proper scheduling flow
exports.createMultipleAppointments = async (req, res) => {
  try {
    console.log("=== CREATE MULTIPLE APPOINTMENTS START ===");
    console.log("Full request body:", JSON.stringify(req.body, null, 2));
    const {
      patientId,
      patientName,
      fatherName,
      email,
      phone,
      serviceId,
      therapistId,
      dates,
      scheduledAppointments,
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

    // Helper function to convert time string to minutes
    const timeToMinutes = (timeStr) => {
      const [time, period] = timeStr.split(" ");
      const [hours, minutes] = time.split(":").map(Number);
      let totalMinutes = hours * 60 + minutes;

      if (period === "PM" && hours !== 12) totalMinutes += 12 * 60;
      if (period === "AM" && hours === 12) totalMinutes -= 12 * 60;

      return totalMinutes;
    };

    // Enhanced appointment data processing
    let appointmentsToCreate = [];
    if (
      scheduledAppointments &&
      Array.isArray(scheduledAppointments) &&
      scheduledAppointments.length > 0
    ) {
      appointmentsToCreate = scheduledAppointments.map((appointment) => ({
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      }));
    } else if (
      dates &&
      Array.isArray(dates) &&
      dates.length > 0 &&
      startTime &&
      endTime
    ) {
      appointmentsToCreate = dates.map((date) => ({
        date,
        startTime,
        endTime,
      }));
    } else {
      return res.status(400).json({
        success: false,
        error:
          "Invalid appointment data. Please provide either 'scheduledAppointments' with individual times or 'dates' with 'startTime' and 'endTime'",
      });
    }

    // Validate appointments
    const invalidAppointments = appointmentsToCreate.filter(
      (apt) => !(apt.startTime && apt.endTime && apt.date)
    );
    if (invalidAppointments.length > 0) {
      return res.status(400).json({
        success: false,
        error:
          "All appointments must have date, startTime and endTime specified",
        invalidAppointments,
      });
    }

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

    // Conflict checking
    const INACTIVE_STATUSES = [
      "cancelled",
      "no-show",
      "completed",
      "converted",
    ];
    const conflictPromises = appointmentsToCreate.map(async (appointment) => {
      const appointmentDate = new Date(appointment.date);
      const newStartMinutes = timeToMinutes(appointment.startTime);
      const newEndMinutes = timeToMinutes(appointment.endTime);

      const activeAppointments = await Appointment.find({
        therapistId: therapistId,
        date: appointmentDate,
        status: { $nin: INACTIVE_STATUSES },
      }).select("_id startTime endTime status");

      for (const existing of activeAppointments) {
        const existingStartMinutes = timeToMinutes(existing.startTime);
        const existingEndMinutes = timeToMinutes(existing.endTime);

        const hasOverlap =
          newStartMinutes < existingEndMinutes &&
          newEndMinutes > existingStartMinutes;
        if (hasOverlap) {
          return {
            hasConflict: true,
            date: appointmentDate.toISOString().split("T")[0],
            time: appointment.startTime,
            conflictingAppointment: existing._id,
          };
        }
      }

      return { hasConflict: false };
    });

    const conflictResults = await Promise.all(conflictPromises);
    const conflicts = conflictResults.filter((result) => result.hasConflict);
    if (conflicts.length > 0) {
      const conflictDetails = conflicts
        .map((c) => `${c.date} at ${c.time}`)
        .join(", ");
      return res.status(400).json({
        success: false,
        error: `Therapist already has appointments on: ${conflictDetails}`,
        conflicts,
      });
    }

    // Create appointments
    const appointmentPromises = appointmentsToCreate.map((appointment) => {
      const appointmentData = {
        userId: req?.user?._id,
        patientId: patient?._id,
        patientName,
        fatherName,
        email,
        phone,
        serviceId,
        therapistId,
        date: new Date(appointment.date),
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        type: type || "initial assessment",
        consultationMode: consultationMode || "in-person",
        notes,
        address,
        payment: {
          amount: paymentAmount || service.price || 0,
          method: paymentMethod || "not_specified",
          status: "pending",
        },
        consent: consent || false,
        totalSessions: appointmentsToCreate.length,
        status: "scheduled",
        assignedBy: req?.user?._id,
        assignedAt: new Date(),
      };
      return Appointment.create(appointmentData);
    });

    const createdAppointments = await Promise.all(appointmentPromises);
    console.log(
      "Successfully created appointments:",
      createdAppointments.length
    );

    try {
      const now = new Date();

      // Normalize times to Asia/Kolkata regardless of server TZ
      const istNow = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      );
      const istHour = istNow.getHours();

      const isAfterNoon = istHour >= 12;

      for (const appointment of createdAppointments) {
        const apptDate = new Date(appointment.date);

        // Define tomorrow’s IST start/end
        const startOfTomorrow = new Date(istNow);
        startOfTomorrow.setDate(istNow.getDate() + 1);
        startOfTomorrow.setHours(0, 0, 0, 0);

        const endOfTomorrow = new Date(startOfTomorrow);
        endOfTomorrow.setHours(23, 59, 59, 999);

        const isTomorrow =
          apptDate >= startOfTomorrow && apptDate <= endOfTomorrow;

        console.log({
          now: istNow.toString(),
          apptDate: apptDate.toString(),
          startOfTomorrow: startOfTomorrow.toString(),
          endOfTomorrow: endOfTomorrow.toString(),
          isAfterNoon,
          isTomorrow,
        });

        if (isTomorrow && isAfterNoon) {
          console.log(
            `⏰ Immediate WhatsApp reminder for appointment ${appointment._id}`
          );
          await sendAppointmentReminder(appointment._id);
        }
      }
    } catch (reminderErr) {
      console.error(
        "⚠️ Failed to send immediate WhatsApp reminder:",
        reminderErr
      );
    }

    console.log("=== CREATE MULTIPLE APPOINTMENTS SUCCESS ===");
    return res.status(201).json({
      success: true,
      message: `${appointmentsToCreate.length} appointments created successfully`,
      data: {
        appointments: createdAppointments,
        patient: patient,
        appointmentCount: appointmentsToCreate.length,
        totalCost: (service.price || 0) * appointmentsToCreate.length,
        therapist: {
          name: `Dr. ${therapist.firstName} ${therapist.lastName}`,
          id: therapist._id,
        },
        service: {
          name: service.name,
          price: service.price,
        },
      },
    });
  } catch (err) {
    console.error("=== CREATE MULTIPLE APPOINTMENTS ERROR ===");
    console.error("Error details:", err);
    res.status(500).json({
      success: false,
      error: "Server Error",
      message: err.message,
    });
  }
};

// Update the existing updateAppointment function to handle bulk payment updates
exports.updatePatientAppointmentsPayment = async (req, res) => {
  try {
    const { patientId, paymentStatus, paymentMethod, paymentAmount } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: "Patient ID is required",
      });
    }

    // Find all scheduled appointments for this patient
    const appointments = await Appointment.find({
      patientId: patientId,
      status: { $in: ["scheduled", "completed"] },
    });

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No appointments found for this patient",
      });
    }

    // Update all appointments
    const updatePromises = appointments.map((appointment) => {
      return Appointment.findByIdAndUpdate(
        appointment._id,
        {
          "payment.status": paymentStatus || appointment.payment.status,
          "payment.method": paymentMethod || appointment.payment.method,
          "payment.amount":
            paymentAmount !== undefined
              ? paymentAmount
              : appointment.payment.amount,
        },
        { new: true, runValidators: true }
      );
    });

    const updatedAppointments = await Promise.all(updatePromises);

    // Fetch updated patient data for response
    let patients = await Patient.find({}).lean();
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
      "06:00 PM",
      "06:45 PM",
      "07:30 PM",
    ];

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

    patients.sort((a, b) => {
      const aDate = a.latestAppointment?.appointmentDate
        ? new Date(a.latestAppointment.appointmentDate)
        : Number.POSITIVE_INFINITY;
      const bDate = b.latestAppointment?.appointmentDate
        ? new Date(b.latestAppointment.appointmentDate)
        : Number.POSITIVE_INFINITY;

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

    return res.status(200).json({
      success: true,
      message: `Updated ${updatedAppointments.length} appointments`,
      data: {
        updatedAppointments,
        patients,
        updateCount: updatedAppointments.length,
      },
    });
  } catch (err) {
    console.error("Update patient appointments payment error:", err);
    return res.status(500).json({
      success: false,
      error: "Server Error",
      message: err.message,
    });
  }
};

// Get payment summary for dashboard
exports.getPaymentSummary = async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments();
    const appointments = await Appointment.find({}).lean();

    const summary = appointments.reduce(
      (acc, apt) => {
        if (apt.payment?.status === "paid") {
          acc.totalRevenue += apt.payment.amount;
          acc.completedPayments += 1;
        } else if (apt.payment?.status === "partial") {
          acc.totalRevenue += apt.payment.paidAmount || 0;
          acc.partialPayments += 1;
        } else if (apt.payment?.status === "pending") {
          acc.pendingPayments += 1;
        }
        return acc;
      },
      {
        totalPatients,
        totalRevenue: 0,
        pendingPayments: 0,
        completedPayments: 0,
        partialPayments: 0,
      }
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching payment summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment summary",
      error: error.message,
    });
  }
};

exports.getPatientsWithAppointments = async (req, res) => {
  try {
    // Fetch all patients with photo and birth certificate data
    const patients = await Patient.find({})
      .select("+photo +birthCertificate") // Ensure these fields are included
      .lean();

    // For each patient, get their appointments with payment details
    const patientsWithAppointments = await Promise.all(
      patients.map(async (patient) => {
        const appointments = await Appointment.find({
          patientId: patient._id,
        })
          .populate("serviceId", "name price")
          .populate("therapistId", "firstName")
          .sort({ date: -1 })
          .lean();

        console.log(appointments);

        // Transform appointments to include payment details AND group session info
        const transformedAppointments = appointments.map((apt) => ({
          _id: apt._id,
          date: apt.date,
          startTime: apt.startTime,
          endTime: apt.endTime,
          type: apt.type,
          status: apt.status,
          // NEW: Add group session information
          isGroupSession: apt.isGroupSession || false,
          groupSessionName: apt.groupSessionName || null,
          groupSessionId: apt.groupSessionId || null,
          maxCapacity: apt.maxCapacity || null,
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
            name: apt.therapistId?.firstName || "Unknown Therapist",
            _id: apt.therapistId?._id,
          },
          totalSessions: apt.totalSessions || 1,
          sessionsCompleted: apt.sessionsCompleted || 0,
          sessionsPaid: apt.sessionsPaid || 0,
        }));

        // Calculate payment summary
        const totalAppointments = transformedAppointments.length;
        const completedAppointments = transformedAppointments.filter(
          (apt) => apt.status === "completed"
        ).length;
        const pendingPayments = transformedAppointments.filter(
          (apt) =>
            apt.payment.status === "pending" || apt.payment.status === "partial"
        ).length;

        const totalOwed = transformedAppointments.reduce((sum, apt) => {
          if (apt.payment.status === "pending") {
            return sum + apt.payment.amount;
          } else if (apt.payment.status === "partial") {
            return sum + (apt.payment.amount - apt.payment.paidAmount);
          }
          return sum;
        }, 0);

        const totalPaid = transformedAppointments.reduce((sum, apt) => {
          if (apt.payment.status === "paid") {
            return sum + apt.payment.amount;
          } else if (apt.payment.status === "partial") {
            return sum + apt.payment.paidAmount;
          }
          return sum;
        }, 0);

        return {
          ...patient,
          // Include photo and birth certificate data in response
          photo: patient.photo
            ? {
                url: patient.photo.url,
                public_id: patient.photo.public_id,
              }
            : null,
          birthCertificate: patient.birthCertificate
            ? {
                url: patient.birthCertificate.url,
                public_id: patient.birthCertificate.public_id,
              }
            : null,
          appointments: transformedAppointments,
          totalAppointments,
          completedAppointments,
          pendingPayments,
          totalOwed,
          totalPaid,
        };
      })
    );

    res.json({
      success: true,
      data: patientsWithAppointments,
    });
  } catch (error) {
    console.error("Error fetching patients with appointments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patient data",
      error: error.message,
    });
  }
};

// Add this new function to process payments
exports.processAppointmentPayment = async (req, res) => {
  try {
    const {
      patientId,
      appointmentIds,
      paymentAmount,
      paymentMethod,
      paymentType,
    } = req.body;

    // Validate input
    if (!appointmentIds || appointmentIds.length === 0 || paymentAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment data provided",
      });
    }

    // Find the appointments
    const appointments = await Appointment.find({
      _id: { $in: appointmentIds },
    }).populate("serviceId therapistId patientId");

    if (appointments.length !== appointmentIds.length) {
      return res.status(404).json({
        success: false,
        message: "Some appointments not found",
      });
    }

    // Calculate total owed for selected appointments
    const totalOwed = appointments.reduce((sum, apt) => {
      const remaining =
        (apt.payment?.amount || 0) - (apt.payment?.paidAmount || 0);
      return sum + Math.max(0, remaining);
    }, 0);

    if (paymentAmount > totalOwed) {
      return res.status(400).json({
        success: false,
        message: "Payment amount exceeds total owed",
      });
    }

    // Process payment distribution
    let remainingPayment = paymentAmount;
    const updatedAppointments = [];

    for (const appointment of appointments) {
      if (remainingPayment < 0) break;

      const currentOwed =
        (appointment.payment?.amount || 0) -
        (appointment.payment?.paidAmount || 0);

      if (currentOwed < 0) continue;

      const paymentForThisAppointment = Math.min(remainingPayment, currentOwed);
      const newPaidAmount =
        (appointment.payment?.paidAmount || 0) + paymentForThisAppointment;

      // Determine new payment status
      let newPaymentStatus = "partial";
      if (newPaidAmount >= (appointment.payment?.amount || 0)) {
        newPaymentStatus = "paid";
      } else if (newPaidAmount === 0) {
        newPaymentStatus = "pending";
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
        { new: true, runValidators: true }
      ).populate("serviceId therapistId patientId");

      updatedAppointments.push(updatedAppointment);
      remainingPayment -= paymentForThisAppointment;
    }

    res.json({
      success: true,
      message: `Payment of $${paymentAmount} processed successfully`,
      data: {
        processedAmount: paymentAmount,
        updatedAppointments: updatedAppointments.length,
        appointments: updatedAppointments,
      },
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process payment",
      error: error.message,
    });
  }
};

// Group appointments
// @desc    Create group appointment with multiple patients
// @route   POST /api/appointments/group
// @access  Private (Admin, Receptionist)
exports.createGroupAppointment = async (req, res) => {
  try {
    console.log("=== CREATE GROUP APPOINTMENT START ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      therapistId,
      serviceId,
      date,
      startTime,
      endTime,
      type,
      consultationMode,
      notes,
      paymentMethod,
      groupSessionName,
      maxCapacity,
      patients, // Array of patient objects
    } = req.body;

    console.log("patints", patients);
    // return;

    // Validate required fields
    if (
      !therapistId ||
      !serviceId ||
      !date ||
      !startTime ||
      !endTime ||
      !patients ||
      patients.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: therapistId, serviceId, date, startTime, endTime, and patients are required",
      });
    }

    if (!groupSessionName || !groupSessionName.trim()) {
      return res.status(400).json({
        success: false,
        error: "Group session name is required",
      });
    }

    if (patients.length > (maxCapacity || 10)) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${
          maxCapacity || 10
        } patients allowed per group session`,
      });
    }

    // Validate service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: "Service not found!",
      });
    }

    // Validate therapist
    const therapist = await User.findById(therapistId);
    if (!therapist || therapist.role !== "therapist") {
      return res.status(404).json({
        success: false,
        error: "Therapist not found!",
      });
    }

    // Generate unique group session ID
    const groupSessionId = new mongoose.Types.ObjectId();

    console.log("Generated group session ID:", groupSessionId);

    // Check for conflicts with existing NON-GROUP appointments
    const appointmentDate = new Date(date);
    const INACTIVE_STATUSES = [
      "cancelled",
      "no-show",
      "completed",
      "converted",
    ];

    // Helper function to convert time string to minutes
    const timeToMinutes = (timeStr) => {
      const [time, period] = timeStr.split(" ");
      const [hours, minutes] = time.split(":").map(Number);
      let totalMinutes = hours * 60 + minutes;

      if (period === "PM" && hours !== 12) totalMinutes += 12 * 60;
      if (period === "AM" && hours === 12) totalMinutes -= 12 * 60;

      return totalMinutes;
    };

    const newStartMinutes = timeToMinutes(startTime);
    const newEndMinutes = timeToMinutes(endTime);

    // Check for conflicts with existing appointments (excluding group sessions)
    const conflictingAppointments = await Appointment.find({
      therapistId: therapistId,
      date: appointmentDate,
      status: { $nin: INACTIVE_STATUSES },
      $or: [
        { isGroupSession: { $ne: true } }, // Non-group appointments
        { isGroupSession: { $exists: false } }, // Legacy appointments without group field
      ],
    });

    console.log(
      `Found ${conflictingAppointments.length} existing non-group appointments to check`
    );

    for (const existing of conflictingAppointments) {
      const existingStartMinutes = timeToMinutes(existing.startTime);
      const existingEndMinutes = timeToMinutes(existing.endTime);

      // Check if times overlap
      const hasOverlap =
        newStartMinutes < existingEndMinutes &&
        newEndMinutes > existingStartMinutes;

      if (hasOverlap) {
        console.log(`❌ CONFLICT FOUND with appointment ${existing._id}`);
        return res.status(400).json({
          success: false,
          error: `Therapist already has an individual appointment at this time: ${existing.startTime} - ${existing.endTime}`,
        });
      }
    }

    // Check if any of the selected patients already have appointments at this time
    const patientIds = patients.map((p) => p.patientId).filter(Boolean);
    const patientConflicts = await Appointment.find({
      patientId: { $in: patientIds },
      date: appointmentDate,
      status: { $nin: INACTIVE_STATUSES },
    });

    // if (patientConflicts.length > 0) {

    //   const conflictingPatients = patientConflicts.map((apt) => apt.patientName).join(", ")
    //   console.log("confil",conflictingPatients)
    //   return res.status(400).json({
    //     success: false,
    //     error: `The following patients already have appointments at this time: ${conflictingPatients}`,
    //   })
    // }

    console.log("✅ No conflicts found. Creating group appointments...");

    // Create individual appointments for each patient in the group
    const appointmentPromises = patients.map((patient, index) => {
      const appointmentData = {
        userId: req?.user?._id,
        patientId: patient.patientId,
        patientName: patient.patientName,
        fatherName: patient.fatherName || "",
        email: patient.email || "",
        phone: patient.phone || "",
        serviceId,
        therapistId,
        date: appointmentDate,
        startTime,
        endTime,
        type: type || "group therapy session",
        consultationMode: consultationMode || "in-person",
        notes: `${
          notes || ""
        }\n\nGroup Session: ${groupSessionName}\nParticipants: ${
          patients.length
        }/${maxCapacity}`,
        payment: {
          amount: service.price || 0,
          method: paymentMethod || "not_specified",
          status: "pending",
        },
        consent: false,
        totalSessions: 1,
        status: "scheduled",
        assignedBy: req?.user?._id,
        assignedAt: new Date(),
        // Group session specific fields
        isGroupSession: true,
        groupSessionId: groupSessionId,
        groupSessionName: groupSessionName,
        maxCapacity: maxCapacity || 6,
      };

      console.log(
        `Creating appointment ${index + 1} for patient: ${patient.patientName}`
      );
      return Appointment.create(appointmentData);
    });

    const createdAppointments = await Promise.all(appointmentPromises);

    console.log(createdAppointments, "created appointments");

    console.log(
      `✅ Successfully created ${createdAppointments.length} group appointments`
    );

    // Send confirmation emails to all patients
    const emailPromises = createdAppointments.map(async (appointment) => {
      if (appointment.email) {
        try {
          await sendEmail({
            to: appointment.email,
            subject: `Group Appointment Confirmation - ${groupSessionName}`,
            html: appointmentConfirmation({
              name:
                appointment.patientName || appointment.fatherName || "Patient",
              service: service.name,
              date: appointment.date,
              startTime: appointment.startTime,
              endTime: appointment.endTime,
              therapist: `Dr. ${therapist.firstName} ${therapist.lastName}`,
              consultationMode: appointment.consultationMode,
              isGroupSession: true,
              groupSessionName: groupSessionName,
              totalParticipants: patients.length,
            }),
          });
          console.log(`Email sent to: ${appointment.email}`);
        } catch (emailError) {
          console.error(
            `Failed to send email to ${appointment.email}:`,
            emailError.message
          );
        }
      }
    });

    await Promise.all(emailPromises);

    console.log("=== CREATE GROUP APPOINTMENT SUCCESS ===");

    return res.status(201).json({
      success: true,
      message: `Group appointment "${groupSessionName}" created successfully for ${patients.length} patients`,
      data: {
        groupSessionId: groupSessionId,
        groupSessionName: groupSessionName,
        appointments: createdAppointments,
        appointmentCount: createdAppointments.length,
        totalCost: service.price * patients.length,
        therapist: {
          name: `Dr. ${therapist.firstName} ${therapist.lastName}`,
          id: therapist._id,
        },
        service: {
          name: service.name,
          price: service.price,
        },
        schedule: {
          date: appointmentDate,
          startTime: startTime,
          endTime: endTime,
        },
      },
    });
  } catch (error) {
    console.error("=== CREATE GROUP APPOINTMENT ERROR ===");
    console.error("Error details:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      error: "Server Error",
      message: error.message,
    });
  }
};

// @desc    Get group appointments
// @route   GET /api/appointments/group
// @access  Private (Admin, Receptionist, Therapist)
exports.getGroupAppointments = async (req, res) => {
  try {
    const query = { isGroupSession: true };

    // If user is a therapist, limit to their appointments
    if (req.user.role === "therapist") {
      query.therapistId = req.user._id;
    }

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      query.date = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    }

    const groupAppointments = await Appointment.find(query)
      .populate({
        path: "patientId",
        select: "fullName firstName lastName dateOfBirth gender",
      })
      .populate({
        path: "therapistId",
        select: "firstName lastName email",
        model: "User",
      })
      .populate({
        path: "serviceId",
        select: "name category price duration",
      })
      .sort({ date: 1, startTime: 1 });

    // Group appointments by groupSessionId
    const groupedSessions = {};
    groupAppointments.forEach((appointment) => {
      const sessionId = appointment.groupSessionId.toString();
      if (!groupedSessions[sessionId]) {
        groupedSessions[sessionId] = {
          groupSessionId: sessionId,
          groupSessionName: appointment.groupSessionName,
          therapist: appointment.therapistId,
          service: appointment.serviceId,
          date: appointment.date,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          type: appointment.type,
          status: appointment.status,
          maxCapacity: appointment.maxCapacity,
          consultationMode: appointment.consultationMode,
          notes: appointment.notes,
          patients: [],
          totalRevenue: 0,
        };
      }

      groupedSessions[sessionId].patients.push({
        _id: appointment._id,
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        fatherName: appointment.fatherName,
        email: appointment.email,
        phone: appointment.phone,
        paymentStatus: appointment.payment?.status || "pending",
        paymentAmount: appointment.payment?.amount || 0,
      });

      groupedSessions[sessionId].totalRevenue +=
        appointment.payment?.amount || 0;
    });

    const sessions = Object.values(groupedSessions);

    res.status(200).json({
      success: true,
      count: sessions.length,
      totalAppointments: groupAppointments.length,
      data: sessions,
    });
  } catch (error) {
    console.error("Get group appointments error:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Update group appointment
// @route   PUT /api/appointments/group/:groupSessionId
// @access  Private (Admin, Receptionist)
exports.updateGroupAppointment = async (req, res) => {
  try {
    const { groupSessionId } = req.params;
    const updates = req.body;

    // Find all appointments in this group session
    const groupAppointments = await Appointment.find({
      groupSessionId: groupSessionId,
      isGroupSession: true,
    });

    if (groupAppointments.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group session not found",
      });
    }

    // Update all appointments in the group
    const updatePromises = groupAppointments.map((appointment) => {
      return Appointment.findByIdAndUpdate(
        appointment._id,
        {
          ...updates,
          // Preserve group session data
          isGroupSession: true,
          groupSessionId: groupSessionId,
          groupSessionName:
            updates.groupSessionName || appointment.groupSessionName,
          maxCapacity: updates.maxCapacity || appointment.maxCapacity,
        },
        { new: true, runValidators: true }
      );
    });

    const updatedAppointments = await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: `Updated ${updatedAppointments.length} appointments in group session`,
      data: updatedAppointments,
    });
  } catch (error) {
    console.error("Update group appointment error:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Cancel group appointment
// @route   DELETE /api/appointments/group/:groupSessionId
// @access  Private (Admin, Receptionist)
exports.cancelGroupAppointment = async (req, res) => {
  try {
    const { groupSessionId } = req.params;

    // Find all appointments in this group session
    const groupAppointments = await Appointment.find({
      groupSessionId: groupSessionId,
      isGroupSession: true,
    });

    if (groupAppointments.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group session not found",
      });
    }

    // Cancel all appointments in the group
    const cancelPromises = groupAppointments.map((appointment) => {
      return Appointment.findByIdAndUpdate(
        appointment._id,
        {
          status: "cancelled",
          cancelledAt: new Date(),
          // Update payment status if needed
          ...(appointment.payment?.status === "paid" && {
            "payment.status": "refunded",
          }),
        },
        { new: true }
      );
    });

    const cancelledAppointments = await Promise.all(cancelPromises);

    // Send cancellation emails
    const emailPromises = cancelledAppointments.map(async (appointment) => {
      if (appointment.email) {
        try {
          await sendEmail({
            to: appointment.email,
            subject: `Group Session Cancelled - ${appointment.groupSessionName}`,
            html: `
              <h2>Group Session Cancelled</h2>
              <p>Dear ${appointment.patientName || appointment.fatherName},</p>
              <p>We regret to inform you that the group session "${
                appointment.groupSessionName
              }" scheduled for ${appointment.date.toDateString()} at ${
              appointment.startTime
            } has been cancelled.</p>
              <p>We will contact you soon to reschedule.</p>
              <p>Thank you for your understanding.</p>
            `,
          });
        } catch (emailError) {
          console.error(
            `Failed to send cancellation email to ${appointment.email}:`,
            emailError.message
          );
        }
      }
    });

    await Promise.all(emailPromises);

    res.status(200).json({
      success: true,
      message: `Cancelled group session with ${cancelledAppointments.length} appointments`,
      data: cancelledAppointments,
    });
  } catch (error) {
    console.error("Cancel group appointment error:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Test controllers
// Enhanced group session update with individual patient handling
exports.updateGroupAppointmentEnhanced = async (req, res) => {
  try {
    const { groupSessionId } = req.params;
    const {
      status,
      notes,
      groupPaymentStrategy,
      patientUpdates,
      globalPayment,
    } = req.body;

    console.log("Enhanced group update request:", {
      groupSessionId,
      status,
      groupPaymentStrategy,
    });

    // Find all appointments in this group session
    const groupAppointments = await Appointment.find({
      groupSessionId: groupSessionId,
      isGroupSession: true,
    });

    if (groupAppointments.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group session not found",
      });
    }

    // Update each appointment based on strategy
    const updatePromises = groupAppointments.map(async (appointment) => {
      let updateData = {
        status: status || appointment.status,
        notes: notes || appointment.notes,
      };

      // Handle payment strategy
      if (groupPaymentStrategy === "all-paid") {
        updateData["payment.status"] = "paid";
        updateData["payment.method"] =
          globalPayment?.method || appointment.payment.method;
      } else if (groupPaymentStrategy === "all-pending") {
        updateData["payment.status"] = "pending";
        updateData["payment.method"] =
          globalPayment?.method || appointment.payment.method;
      } else if (groupPaymentStrategy === "keep-current") {
        // Keep existing payment status
      }

      // Handle individual patient updates if provided
      if (patientUpdates && Array.isArray(patientUpdates)) {
        const patientUpdate = patientUpdates.find(
          (pu) => pu.patientId === appointment._id.toString()
        );
        if (patientUpdate) {
          if (patientUpdate.payment) {
            updateData["payment.status"] = patientUpdate.payment.status;
            updateData["payment.method"] = patientUpdate.payment.method;
            updateData["payment.amount"] = patientUpdate.payment.amount;
          }
          if (patientUpdate.notes) {
            updateData.notes = patientUpdate.notes;
          }
        }
      }

      return Appointment.findByIdAndUpdate(appointment._id, updateData, {
        new: true,
        runValidators: true,
      });
    });

    const updatedAppointments = await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: `Updated ${updatedAppointments.length} appointments in group session`,
      data: updatedAppointments,
    });
  } catch (error) {
    console.error("Enhanced group update error:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
      message: error.message,
    });
  }
};

// Group session reschedule
exports.rescheduleGroupAppointment = async (req, res) => {
  try {
    const { groupSessionId } = req.params;
    const {
      date,
      startTime,
      endTime,
      therapistId,
      reason,
      individualPaymentStatuses,
    } = req.body;

    console.log("Group reschedule request:", {
      groupSessionId,
      date,
      startTime,
      endTime,
    });

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: "Date, startTime, and endTime are required",
      });
    }

    // Find all appointments in this group session
    const groupAppointments = await Appointment.find({
      groupSessionId: groupSessionId,
      isGroupSession: true,
    });

    if (groupAppointments.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group session not found",
      });
    }

    // Check for conflicts with the new time slot
    const appointmentDate = new Date(date);
    const INACTIVE_STATUSES = [
      "cancelled",
      "no-show",
      "completed",
      "converted",
    ];

    const conflictCheck = await Appointment.findOne({
      therapistId: therapistId || groupAppointments[0].therapistId,
      date: appointmentDate,
      _id: { $nin: groupAppointments.map((apt) => apt._id) },
      status: { $nin: INACTIVE_STATUSES },
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

    if (conflictCheck) {
      return res.status(400).json({
        success: false,
        error: "Selected time slot is not available",
      });
    }

    // Update all appointments in the group
    const rescheduleNote = `Group rescheduled on ${new Date().toLocaleDateString()}: ${
      reason || "No reason provided"
    }`;

    const updatePromises = groupAppointments.map(async (appointment) => {
      let updateData = {
        date: appointmentDate,
        startTime: startTime,
        endTime: endTime,
        therapistId: therapistId || appointment.therapistId,
        status: "scheduled",
        notes: appointment.notes
          ? `${appointment.notes}\n${rescheduleNote}`
          : rescheduleNote,
      };

      // Handle individual payment statuses if provided
      if (
        individualPaymentStatuses &&
        individualPaymentStatuses[appointment._id.toString()]
      ) {
        updateData["payment.status"] =
          individualPaymentStatuses[appointment._id.toString()];
      }

      return Appointment.findByIdAndUpdate(appointment._id, updateData, {
        new: true,
        runValidators: true,
      }).populate("userId patientId therapistId serviceId assignedBy");
    });

    const updatedAppointments = await Promise.all(updatePromises);

    // Send reschedule emails to all patients
    const emailPromises = updatedAppointments.map(async (appointment) => {
      if (appointment.email) {
        try {
          const [service, therapist] = await Promise.all([
            Service.findById(appointment.serviceId),
            User.findById(appointment.therapistId),
          ]);

          await sendEmail({
            to: appointment.email,
            subject: "Your Group Session Has Been Rescheduled",
            html: appointmentReschedule({
              name:
                appointment.patientName || appointment.fatherName || "Patient",
              service: service?.name || "Group Session",
              date: appointment.date,
              startTime: appointment.startTime,
              endTime: appointment.endTime,
              therapist: therapist?.fullName || "Therapist",
              reason,
              paymentStatus: appointment.payment.status,
              isGroupSession: true,
              groupSessionName: appointment.groupSessionName,
            }),
          });
        } catch (emailError) {
          console.error(
            `Failed to send reschedule email to ${appointment.email}:`,
            emailError.message
          );
        }
      }
    });

    await Promise.all(emailPromises);

    res.status(200).json({
      success: true,
      message: `Group session rescheduled successfully for ${updatedAppointments.length} patients`,
      data: updatedAppointments,
    });
  } catch (error) {
    console.error("Group reschedule error:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
      message: error.message,
    });
  }
};
