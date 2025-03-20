const mongoose = require("mongoose");

const WebinarSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    speaker: {
      type: String,
    },
    date: {
      type: Date,
    },
    duration: {
      type: Number, // Duration in minutes
    },
    startTime: {
      type: String,
    },
    maxRegistrations: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["scheduled", "live", "completed", "cancelled"],
      default: "scheduled",
    },
    url: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
    registeredUsers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        registeredAt: {
          type: Date,
          default: Date.now,
        },
        attended: {
          type: Boolean,
          default: false,
        },
      },
    ],
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
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Calculate average rating when ratings are modified
WebinarSchema.pre("save", function (next) {
  if (this.ratings && this.ratings.length > 0) {
    this.averageRating =
      this.ratings.reduce((total, rating) => total + rating.rating, 0) /
      this.ratings.length;
  } else {
    this.averageRating = undefined;
  }
  next();
});

// Virtual for number of registrations
WebinarSchema.virtual("registrationCount").get(function () {
  return this.registeredUsers ? this.registeredUsers.length : 0;
});

// Virtual for available slots
WebinarSchema.virtual("availableSlots").get(function () {
  return this.maxRegistrations - this.registrationCount;
});

module.exports = mongoose.model("Webinar", WebinarSchema);
