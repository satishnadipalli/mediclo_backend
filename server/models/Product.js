const mongoose = require("mongoose");
const slugify = require("slugify");

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: String,
    description: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
    },
    discountedPrice: {
      type: Number,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "none"],
      default: "none",
    },
    discountValue: {
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
    tags: [String],
    features: [String],
    specifications: [
      {
        name: String,
        value: String,
      },
    ],
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

// Create product slug from the name
ProductSchema.pre("save", function (next) {
  this.slug = slugify(this.name, { lower: true });
  this.updatedAt = Date.now();

  // Calculate discounted price if discount is applied
  if (this.discountType === "percentage" && this.discountValue > 0) {
    this.discountedPrice = this.price - this.price * (this.discountValue / 100);
  } else if (this.discountType === "fixed" && this.discountValue > 0) {
    this.discountedPrice = this.price - this.discountValue;
    if (this.discountedPrice < 0) this.discountedPrice = 0;
  } else {
    this.discountedPrice = this.price;
  }

  next();
});

// Cascade delete inventory when a product is deleted
ProductSchema.pre("remove", async function (next) {
  await this.model("Inventory").deleteMany({ product: this._id });
  next();
});

// Virtual for inventory
ProductSchema.virtual("inventory", {
  ref: "Inventory",
  localField: "_id",
  foreignField: "product",
  justOne: true,
});

// Indexes for search
ProductSchema.index({ name: "text", description: "text", tags: "text" });
ProductSchema.index({ category: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ slug: 1 });
ProductSchema.index({ status: 1 });

module.exports = mongoose.model("Product", ProductSchema);
