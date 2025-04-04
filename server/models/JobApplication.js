const mongoose = require("mongoose");

const JobApplicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: [true, "Job ID is required"],
    },
    // Fields for authenticated users (original model)
    applicant: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: function () {
          return !this.isPublicSubmission;
        },
      },
      name: {
        type: String,
        required: function () {
          return !this.isPublicSubmission;
        },
      },
      email: {
        type: String,
        required: function () {
          return !this.isPublicSubmission;
        },
        match: [
          /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
          "Please add a valid email",
        ],
      },
      phone: {
        type: String,
        required: function () {
          return !this.isPublicSubmission;
        },
      },
    },
    // Fields for public submissions
    isPublicSubmission: {
      type: Boolean,
      default: false,
    },
    firstName: {
      type: String,
      required: function () {
        return this.isPublicSubmission;
      },
    },
    lastName: {
      type: String,
      required: function () {
        return this.isPublicSubmission;
      },
    },
    email: {
      type: String,
      required: function () {
        return this.isPublicSubmission;
      },
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    phone: {
      type: String,
      required: function () {
        return this.isPublicSubmission;
      },
    },
    // Common fields
    resume: {
      type: String, // URL to resume file in Cloudinary
      required: function () {
        return !this.isPublicSubmission; // Not requiring for public submissions
      },
    },
    coverLetter: {
      type: String,
      required: function () {
        return !this.isPublicSubmission; // Not requiring for public submissions
      },
    },
    experience: {
      type: String,
    },
    education: {
      type: String,
    },
    skills: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: [
        "pending",
        "received",
        "reviewed",
        "interviewed",
        "rejected",
        "hired",
      ],
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

// Updated index to handle both authenticated and public submissions
JobApplicationSchema.index(
  { jobId: 1, email: 1 },
  { unique: true, partialFilterExpression: { isPublicSubmission: true } }
);

JobApplicationSchema.index(
  { jobId: 1, "applicant.userId": 1 },
  { unique: true, partialFilterExpression: { isPublicSubmission: false } }
);

module.exports = mongoose.model("JobApplication", JobApplicationSchema);
