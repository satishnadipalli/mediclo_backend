const mongoose = require("mongoose");

const CourseEnrollmentSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course ID is required"],
    },
    // For authenticated users
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return !this.isPublicSubmission;
      },
    },
    // For public enrollments
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
      required: [true, "Email is required"],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    phone: {
      type: String,
    },
    isPublicSubmission: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["enrolled", "completed", "dropped", "pending"],
      default: "enrolled",
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completedLessons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lesson",
      },
    ],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded", "failed"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["card", "bank_transfer", "cash", "other"],
      default: "card",
    },
    transactionId: {
      type: String,
    },
    certificateIssued: {
      type: Boolean,
      default: false,
    },
    certificateUrl: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index to prevent duplicate enrollments
CourseEnrollmentSchema.index({ courseId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("CourseEnrollment", CourseEnrollmentSchema);
