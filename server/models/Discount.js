const mongoose = require("mongoose");

const DiscountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  usageLimit: {
    type: Number,
    default: null,
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Method to check if discount is valid
DiscountSchema.methods.isValid = function () {
  const now = new Date();
  return (
    this.isActive &&
    now >= this.startDate &&
    now <= this.endDate &&
    (this.usageLimit === null || this.usageCount < this.usageLimit)
  );
};

// Method to calculate discount amount
DiscountSchema.methods.calculateDiscount = function (subtotal) {
  if (!this.isValid()) {
    return 0;
  }

  let discountAmount = subtotal * (this.discountValue / 100);
  return discountAmount;
};

// Indexes
DiscountSchema.index({ isActive: 1 });
DiscountSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model("Discount", DiscountSchema);
