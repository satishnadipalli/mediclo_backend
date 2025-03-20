const mongoose = require("mongoose");

const TherapistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please add a user ID"],
      unique: true,
    },
    specialization: {
      type: String,
      required: [true, "Please add a specialization"],
      enum: ["Occupational Therapy", "Speech Therapy", "Physical Therapy", "Other"],
    },
    qualifications: {
      type: [String],
      required: [true, "Please add qualifications"],
    },
    certifications: {
      type: [String],
      default: [],
    },
    experience: {
      type: Number,
      required: [true, "Please add years of experience"],
    },
    bio: {
      type: String,
      required: [true, "Please add a bio"],
    },
    profilePicture: {
      type: String,
    },
    workingHours: {
      monday: {
        start: String,
        end: String,
      },
      tuesday: {
        start: String,
        end: String,
      },
      wednesday: {
        start: String,
        end: String,
      },
      thursday: {
        start: String,
        end: String,
      },
      friday: {
        start: String,
        end: String,
      },
      saturday: {
        start: String,
        end: String,
      },
      sunday: {
        start: String,
        end: String,
      },
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for appointments
TherapistSchema.virtual("appointments", {
  ref: "Appointment",
  localField: "userId",
  foreignField: "therapistId",
  justOne: false,
});

// Cascade delete when user is deleted
TherapistSchema.pre("remove", async function (next) {
  // Update appointments to remove this therapist
  await this.model("Appointment").updateMany(
    { therapistId: this.userId },
    { $set: { status: "cancelled" } }
  );
  next();
});

module.exports = mongoose.model("Therapist", TherapistSchema);