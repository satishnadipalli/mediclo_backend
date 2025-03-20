const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    username: {
      type: String,
    },
    itemType: {
      type: String,
      enum: ["course", "webinar"],
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "itemType",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent user from submitting more than one feedback per item
FeedbackSchema.index({ user: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model("Feedback", FeedbackSchema);
