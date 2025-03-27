const mongoose = require("mongoose");

const TimeSlotSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Please add a date"],
    },
    timeSlot: {
      type: String,
      enum: ["morning", "afternoon", "evening"],
      required: [true, "Please specify a time slot"],
    },
  },
  { _id: false }
);

const AppointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: [true, "Please add a patient"],
    },
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Making therapistId optional for parent appointment requests
      required: function () {
        return this.status !== "pending_assignment";
      },
    },
    date: {
      type: Date,
      required: function () {
        // Only required for confirmed appointments
        return !this.preferredDates || this.preferredDates.length === 0;
      },
    },
    startTime: {
      type: String,
      required: function () {
        // Only required for confirmed appointments
        return !this.preferredDates || this.preferredDates.length === 0;
      },
    },
    endTime: {
      type: String,
      required: function () {
        // Only required for confirmed appointments
        return !this.preferredDates || this.preferredDates.length === 0;
      },
    },
    status: {
      type: String,
      enum: [
        "scheduled",
        "completed",
        "cancelled",
        "no-show",
        "pending_assignment", // Waiting for admin to assign therapist
        "pending_confirmation", // Waiting for therapist to confirm
      ],
      default: "scheduled",
    },
    type: {
      type: String,
      enum: ["initial assessment", "follow-up", "therapy session"],
      required: [true, "Please add appointment type"],
    },
    notes: {
      type: String,
    },
    payment: {
      amount: {
        type: Number,
        required: [true, "Please add payment amount"],
      },
      status: {
        type: String,
        enum: ["pending", "paid", "refunded"],
        default: "pending",
      },
      method: {
        type: String,
        enum: ["card", "cash", "insurance", "not_specified"],
        default: "card",
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
      required: [true, "Patient consent is required"],
      default: false,
    },
    // Fields for parent appointment requests
    preferredDates: {
      type: [TimeSlotSchema],
      default: undefined,
    },
    therapistPreference: {
      type: String,
      enum: ["no_preference", "specific", "any_available"],
      default: "no_preference",
    },
    requestedByParent: {
      type: Boolean,
      default: false,
    },
    parentRequestedAt: {
      type: Date,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAt: {
      type: Date,
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

// Prevent overlapping appointments for the same therapist
AppointmentSchema.pre("save", async function (next) {
  // Skip validation for appointment requests without confirmed dates
  if (this.status === "pending_assignment" || !this.therapistId) {
    return next();
  }

  if (
    this.isModified("date") ||
    this.isModified("startTime") ||
    this.isModified("endTime") ||
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
