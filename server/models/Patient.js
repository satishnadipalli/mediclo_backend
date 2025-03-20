const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please add a parent/guardian"],
    },
    firstName: {
      type: String,
      required: [true, "Please add a first name"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Please add a last name"],
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, "Please add a date of birth"],
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: [true, "Please specify gender"],
    },
    medicalHistory: {
      type: String,
    },
    diagnosis: {
      type: String,
    },
    allergies: {
      type: [String],
      default: [],
    },
    emergencyContact: {
      name: {
        type: String,
        required: [true, "Please add emergency contact name"],
      },
      relation: {
        type: String,
        required: [true, "Please add relation to patient"],
      },
      phone: {
        type: String,
        required: [true, "Please add emergency contact phone"],
      },
    },
    therapistNotes: [
      {
        therapistId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
          required: [true, "Please add note content"],
        },
      },
    ],
    assessments: [
      {
        date: {
          type: Date,
          required: [true, "Please add assessment date"],
        },
        type: {
          type: String,
          required: [true, "Please add assessment type"],
        },
        summary: {
          type: String,
          required: [true, "Please add assessment summary"],
        },
        conductedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        documents: {
          type: [String],
          default: [],
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create full name virtual
PatientSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Calculate age virtual
PatientSchema.virtual("age").get(function () {
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for appointments
PatientSchema.virtual("appointments", {
  ref: "Appointment",
  localField: "_id",
  foreignField: "patientId",
  justOne: false,
});

module.exports = mongoose.model("Patient", PatientSchema);
