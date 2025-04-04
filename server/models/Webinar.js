const mongoose = require("mongoose");

const WebinarSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
    },
    speaker: {
      type: String,
      required: [true, "Please add a speaker name"],
    },
    date: {
      type: Date,
      required: [true, "Please add a date"],
    },
    duration: {
      type: Number, // Duration in minutes
      required: [true, "Please add a duration"],
    },
    startTime: {
      type: String,
      required: [true, "Please add a start time"],
    },
    maxRegistrations: {
      type: Number,
      default: 100,
    },
    status: {
      type: String,
      enum: ["upcoming", "live", "completed", "cancelled"],
      default: "upcoming",
    },
    url: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
    description: {
      type: String,
      required: [true, "Please add a description"],
    },
    tags: {
      type: [String],
      default: [],
    },
    participantsCount: {
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

// Virtual for available slots
WebinarSchema.virtual("availableSlots").get(function () {
  return this.maxRegistrations - this.participantsCount;
});

// Index for efficient queries
WebinarSchema.index({ status: 1, date: 1 });
WebinarSchema.index({ date: 1 }); // For date-based sorting and filtering

module.exports = mongoose.model("Webinar", WebinarSchema);
