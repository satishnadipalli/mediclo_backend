const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "Please add a video URL"],
    }
  },
  { _id: false }
);

const CourseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a course title"],
      unique: true,
      trim: true,
      maxlength: [100, "Course title cannot be more than 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      required: [true, "Please add a course description"],
    },
    instructor: {
      type: String,
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
      min: [0, "Price must be at least 0"],
    },
    duration: {
      type: String,
      default: "Self-paced",
    },
    thumbnail: {
      type: String,
      required: [true, "Please upload a thumbnail image"],
    },
    category: {
      type: String,
      required: [true, "Please select a category"],
      enum: [
        "therapy",
        "mental health",
        "parenting",
        "education",
        "counseling",
        "wellness",
        "other",
      ],
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived", "active"],
      default: "draft",
    },
    enrollmentsCount: {
      type: Number,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    videos: [VideoSchema], // Array of just video URLs
    tags: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Slug, delete hook, and virtuals remain the same

module.exports = mongoose.model("Course", CourseSchema);
