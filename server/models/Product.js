const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "none"],
      default: "none",
    },
    discountPercentage: {
      type: Number,
      default: 0,
    },
    taxClass: {
      type: String,
      enum: ["standard", "reduced", "zero"],
      default: "standard",
    },
    vatAmount: {
      type: Number,
      default: 20, // Default UK VAT rate
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        alt: String,
        isMain: {
          type: Boolean,
          default: false,
        },
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "discontinued"],
      default: "draft",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
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
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Update timestamp and calculate discounted price
ProductSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Calculate discounted price if discount is applied
  if (this.discountType === "percentage" && this.discountPercentage > 0) {
    this.discountedPrice =
      this.price - this.price * (this.discountPercentage / 100);
  } else if (this.discountType === "fixed" && this.discountPercentage > 0) {
    this.discountedPrice = this.price - this.discountPercentage;
    if (this.discountedPrice < 0) this.discountedPrice = 0;
  } else {
    this.discountedPrice = this.price;
  }

  next();
});

// Indexes for search
ProductSchema.index({ name: "text", description: "text" });
ProductSchema.index({ category: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ status: 1 });

module.exports = mongoose.model("Product", ProductSchema);
