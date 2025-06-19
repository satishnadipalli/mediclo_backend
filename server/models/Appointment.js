const mongoose = require("mongoose");

// const TimeSlotSchema = new mongoose.Schema(
//   {
//     date: {
//       type: Date,
//       required: [true, "Please add a date"],
//     },
//     timeSlot: {
//       type: String,
//       enum: ["morning", "afternoon", "evening"],
//       required: [true, "Please specify a time slot"],
//     },
//   },
//   { _id: false }
// );

const AppointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },
    patientName: {
      type: String,
      required: true,
    },
    fatherName: {
      type: String,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    consultationMode: {
      type: String,
      enum: ["in-person", "video-call", "phone"],
      default: "in-person",
    },
    date: {
      type: Date,
      required: true,
    },
    startIme: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["initial assessment", "follow-up", "therapy session", "other"],
      default: "initial assessment",
    },
    status: {
      type: String,
      enum: [
        "scheduled",
        "rescheduled",
        "cancelled",
        "no-show",
        "pending-assignment",
        "pending_confirmation",
      ],
      default: "scheduled",
    },
    notes: {
      type: String,
    },
    //payment model
    payment: {
      amount: {
        type: Number,
        default: 0,
      },
      status: {
        type: String,
        enum: ["pending", "paid", "refunded"],
        default: "pending",
      },
      method: {
        type: String,
        enum: ["card", "cash", "insurance", "not_specified"],
        default: "not_specified",
      },
    },
    // Adding address field for appointment location
    address: {
      type: String,
    },
    // Adding documents field for uploading medical records
    documents: {
      type: [String],
      default: [],
    },
    // Adding consent field for patient consent
    consent: {
      type: Boolean,
      default: false,
    },
    //total number of sessions prescribed by therapist
    totalSessions: {
      type: Number,
      default: 0,
    },
    //number of paid sessions
    sessionsPaid: {
      type: Number,
      default: 0,
    },
    //number of completed sessions
    sessionsCompleted: {
      type: Number,
      default: 0,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAt: {
      type: Date,
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add index for efficient queries
AppointmentSchema.index({ patientId: 1, date: 1 });
AppointmentSchema.index({ therapistId: 1, date: 1 });
AppointmentSchema.index({ userId: 1, date: 1 });
AppointmentSchema.index({ email: 1 }); // Add index for email searches for public submissions

// Prevent overlapping appointments for the same therapist
AppointmentSchema.pre("save", async function (next) {
  // Skip validation for appointment requests without confirmed dates
  if (
    this.isPublicSubmission ||
    this.status === "pending_assignment" ||
    !this.therapistId
  ) {
    return next();
  }

  if (
    this.isModified("date") ||
    this.isModified("startTime") ||
    this.isModified("endTime") ||
    this.isModified("therapistId") ||
    this.isNew
  ) {
    const existingAppointment = await this.constructor.findOne({
      therapistId: this.therapistId,
      date: this.date,
      _id: { $ne: this._id },
      status: { $ne: "cancelled" },
      $or: [
        {
          // New appointment starts during an existing appointment
          startTime: { $lte: this.startTime },
          endTime: { $gt: this.startTime },
        },
        {
          // New appointment ends during an existing appointment
          startTime: { $lt: this.endTime },
          endTime: { $gte: this.endTime },
        },
        {
          // New appointment contains an existing appointment
          startTime: { $gte: this.startTime },
          endTime: { $lte: this.endTime },
        },
      ],
    });

    if (existingAppointment) {
      const error = new Error(
        "Therapist already has an appointment at this time"
      );
      error.statusCode = 400;
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Appointment", AppointmentSchema);
