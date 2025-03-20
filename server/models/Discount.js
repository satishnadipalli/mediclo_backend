const mongoose = require("mongoose");

const DiscountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  description: {
    type: String,
  },
  type: {
    type: String,
    enum: ["percentage", "fixed", "shipping"],
    required: true,
  },
  value: {
    type: Number,
    required: true,
    min: 0,
  },
  minPurchase: {
    type: Number,
    default: 0,
  },
  maxDiscount: {
    type: Number,
    default: null,
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
  applicableProducts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
  ],
  applicableCategories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
  ],
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
  if (!this.isValid() || subtotal < this.minPurchase) {
    return 0;
  }

  let discountAmount = 0;

  if (this.type === "percentage") {
    discountAmount = subtotal * (this.value / 100);
  } else if (this.type === "fixed") {
    discountAmount = this.value;
  }

  // Apply max discount if set
  if (this.maxDiscount !== null && discountAmount > this.maxDiscount) {
    discountAmount = this.maxDiscount;
  }

  return discountAmount;
};

// Indexes
DiscountSchema.index({ isActive: 1 });
DiscountSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model("Discount", DiscountSchema);
