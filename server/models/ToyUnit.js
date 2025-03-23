const mongoose = require("mongoose");

const ToyUnitSchema = new mongoose.Schema(
  {
    toyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Toy",
      required: [true, "Toy ID is required"],
    },
    unitNumber: {
      type: Number,
      required: [true, "Unit number is required"],
    },
    condition: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Needs Repair", "Damaged"],
      default: "Good",
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    currentBorrower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ToyBorrowing",
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create compound index for toyId and unitNumber to ensure uniqueness
ToyUnitSchema.index({ toyId: 1, unitNumber: 1 }, { unique: true });

// Virtual for borrowing history
ToyUnitSchema.virtual("borrowingHistory", {
  ref: "ToyBorrowing",
  localField: "_id",
  foreignField: "toyUnitId",
  justOne: false,
});

module.exports = mongoose.model("ToyUnit", ToyUnitSchema);
