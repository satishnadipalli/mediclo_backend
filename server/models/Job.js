const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a job title"],
      trim: true,
    },
    department: {
      type: String,
      required: [true, "Please add a department"],
      enum: ["Therapy", "Administration", "Management", "Education", "Other"],
    },
    type: {
      type: String,
      required: [true, "Please add job type"],
      enum: ["Full-time", "Part-time", "Contract", "Internship"],
    },
    location: {
      type: String,
      required: [true, "Please add job location"],
    },
    description: {
      type: String,
      required: [true, "Please add job description"],
    },
    requirements: {
      type: [String],
      required: [true, "Please add job requirements"],
    },
    responsibilities: {
      type: [String],
      required: [true, "Please add job responsibilities"],
    },
    qualifications: {
      type: [String],
      required: [true, "Please add job qualifications"],
    },
    salary: {
      min: {
        type: Number,
      },
      max: {
        type: Number,
      },
      currency: {
        type: String,
        default: "USD",
      },
      isVisible: {
        type: Boolean,
        default: false,
      },
    },
    benefits: {
      type: [String],
      default: [],
    },
    applicationDeadline: {
      type: Date,
      required: [true, "Please add application deadline"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    applicationCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for applications
JobSchema.virtual("applications", {
  ref: "JobApplication",
  localField: "_id",
  foreignField: "jobId",
  justOne: false,
});

// Index for searching
JobSchema.index({ title: "text", description: "text" });

module.exports = mongoose.model("Job", JobSchema);