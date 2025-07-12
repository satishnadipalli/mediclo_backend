const mongoose = require("mongoose")

const WorkshopSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please add a description"],
    },
    instructor: {
      type: String,
      required: [true, "Please add an instructor name"],
    },
    date: {
      type: Date,
      required: [true, "Please add a date"],
    },
    startTime: {
      type: String,
      required: [true, "Please add a start time"],
    },
    endTime: {
      type: String,
      required: [true, "Please add an end time"],
    },
    location: {
      type: String,
      required: [true, "Please add a location"],
    },
    maxParticipants: {
      type: Number,
      default: 20,
    },
    currentParticipants: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
    },
    memberDiscount: {
      type: Number,
      default: 20, // 20% discount for premium members
    },
    category: {
      type: String,
      enum: ["cooking", "fitness", "wellness", "mindfulness", "nutrition"],
      required: [true, "Please add a category"],
    },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      default: "upcoming",
    },
    image: {
      type: String,
      default: "/placeholder.svg?height=200&width=300",
    },
    materials: [
      {
        type: String,
      },
    ],
    prerequisites: [
      {
        type: String,
      },
    ],
    registeredUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for available spots
WorkshopSchema.virtual("availableSpots").get(function () {
  return this.maxParticipants - this.currentParticipants
})

// Index for efficient queries
WorkshopSchema.index({ date: 1, status: 1 })
WorkshopSchema.index({ category: 1 })

module.exports = mongoose.model("Workshop", WorkshopSchema);
