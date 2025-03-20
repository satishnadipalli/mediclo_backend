const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    instructor: {
      type: String,
    },
    price: {
      type: Number,
    },
    description: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
    videos: [
      {
        url: {
          type: String,
        },
        title: {
          type: String,
        },
        duration: {
          type: Number, // Duration in seconds
        },
      },
    ],
    category: {
      type: String,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    ratings: [
      {
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    averageRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    isPremium: {
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

// Calculate average rating when ratings are modified
CourseSchema.pre("save", function (next) {
  if (this.ratings && this.ratings.length > 0) {
    this.averageRating =
      this.ratings.reduce((total, rating) => total + rating.rating, 0) /
      this.ratings.length;
  } else {
    this.averageRating = undefined;
  }
  next();
});

module.exports = mongoose.model("Course", CourseSchema);
