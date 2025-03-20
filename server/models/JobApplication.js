const mongoose = require("mongoose");

const JobApplicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: [true, "Job ID is required"],
    },
    applicant: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"],
      },
      name: {
        type: String,
        required: [true, "Applicant name is required"],
      },
      email: {
        type: String,
        required: [true, "Applicant email is required"],
        match: [
          /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
          "Please add a valid email",
        ],
      },
      phone: {
        type: String,
        required: [true, "Applicant phone is required"],
      },
    },
    resume: {
      type: String, // URL to resume file in Cloudinary
      required: [true, "Resume is required"],
    },
    coverLetter: {
      type: String,
      required: [true, "Cover letter is required"],
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "interviewed", "rejected", "hired"],
      default: "pending",
    },
    notes: {
      type: String,
    },
    interviewDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate applications
JobApplicationSchema.index(
  { jobId: 1, "applicant.userId": 1 },
  { unique: true }
);

module.exports = mongoose.model("JobApplication", JobApplicationSchema);
