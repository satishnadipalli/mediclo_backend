const mongoose = require("mongoose");

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
      required: [true, "Please add a therapist"],
    },
    date: {
      type: Date,
      required: [true, "Please add a date"],
    },
    startTime: {
      type: String,
      required: [true, "Please add a start time"],
    },
    endTime: {
      type: String,
      required: [true, "Please add an end time"],
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "no-show"],
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
        enum: ["card", "cash", "insurance"],
        default: "card",
      },
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
  if (this.isModified("date") || this.isModified("startTime") || this.isModified("endTime") || this.isNew) {
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
      const error = new Error("Therapist already has an appointment at this time");
      error.statusCode = 400;
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Appointment", AppointmentSchema);