const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a video title"],
      trim: true,
    },
    url: {
      type: String,
      required: [true, "Please add a video URL"],
    },
    duration: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
    },
    isPreview: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
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
    summary: {
      type: String,
      maxlength: [500, "Summary cannot be more than 500 characters"],
    },
    instructor: {
      type: String,
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
      min: [0, "Price must be at least 0"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
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
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "all-levels"],
      default: "all-levels",
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
    videos: [VideoSchema],
    prerequisites: {
      type: [String],
      default: [],
    },
    objectives: {
      type: [String],
      default: [],
    },
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

// Create slug from course title
CourseSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-");
  }
  next();
});

// Cascade delete enrollments when a course is deleted
CourseSchema.pre("remove", async function (next) {
  await this.model("CourseEnrollment").deleteMany({ courseId: this._id });
  next();
});

// Virtual field for total video count
CourseSchema.virtual("videoCount").get(function () {
  return this.videos ? this.videos.length : 0;
});

// Virtual field for total course duration
CourseSchema.virtual("totalDuration").get(function () {
  return this.videos
    ? this.videos.reduce((total, video) => total + (video.duration || 0), 0)
    : 0;
});

// Add indexes for common queries
CourseSchema.index({ category: 1 });
CourseSchema.index({ status: 1 });
CourseSchema.index({ featured: 1 });

module.exports = mongoose.model("Course", CourseSchema);
