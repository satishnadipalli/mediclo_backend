const mongoose = require("mongoose");

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
      required: false,
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
    startTime: {
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
        "converted",
        "completed",
        "confirmed"
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
        enum: ["upi","card", "cash", "insurance", "not_specified"],
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
      required:false
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
// In your Appointment.js model file, replace the existing pre-save hook with this:

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
    // FIXED: Define inactive statuses that should NOT cause conflicts
    const INACTIVE_STATUSES = ["cancelled", "no-show", "completed", "converted"];

    // Helper function to convert time string to minutes
    const timeToMinutes = (timeStr) => {
      const [time, period] = timeStr.split(' ')
      const [hours, minutes] = time.split(':').map(Number)
      let totalMinutes = hours * 60 + minutes
      
      if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60
      if (period === 'AM' && hours === 12) totalMinutes -= 12 * 60
      
      return totalMinutes
    }

    // Get all active appointments for this therapist on this date
    const activeAppointments = await this.constructor.find({
      therapistId: this.therapistId,
      date: this.date,
      _id: { $ne: this._id },
      status: { $nin: INACTIVE_STATUSES }, // FIXED: Exclude inactive statuses
    });

    console.log(`Pre-save conflict check for appointment ${this._id}:`);
    console.log(`New appointment: ${this.startTime} - ${this.endTime}`);
    console.log(`Active appointments on ${this.date}:`, activeAppointments.map(apt => ({
      id: apt._id,
      time: `${apt.startTime} - ${apt.endTime}`,
      status: apt.status,
      patient: apt.patientName
    })));

    // Check for conflicts using proper time comparison
    const newStartMinutes = timeToMinutes(this.startTime);
    const newEndMinutes = timeToMinutes(this.endTime);

    for (const existing of activeAppointments) {
      const existingStartMinutes = timeToMinutes(existing.startTime);
      const existingEndMinutes = timeToMinutes(existing.endTime);

      // Check if times overlap
      const hasOverlap = (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes);
      
      console.log(`Checking overlap with ${existing._id}:`, {
        existing: `${existingStartMinutes}-${existingEndMinutes} (${existing.startTime}-${existing.endTime})`,
        new: `${newStartMinutes}-${newEndMinutes} (${this.startTime}-${this.endTime})`,
        hasOverlap: hasOverlap
      });

      if (hasOverlap) {
        const error = new Error(
          `Therapist already has an appointment at this time: ${existing.startTime} - ${existing.endTime} (${existing.status})`
        );
        error.statusCode = 400;
        console.log(`❌ CONFLICT FOUND in pre-save hook with appointment ${existing._id}`);
        return next(error);
      }
    }

    console.log(`✅ NO CONFLICTS found in pre-save hook`);
  }

  next();
});

module.exports = mongoose.model("Appointment", AppointmentSchema);
