const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
    },
    categoryType: {
  type: String,
  enum: [
    "Therapy Type",
    "Age Group",
    "Learning Type"
  ],
  default: "Therapy Type",
},


    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for subcategories
CategorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

// Indexes
CategorySchema.index({ parent: 1 });
CategorySchema.index({ categoryType: 1 });

module.exports = mongoose.model("Category", CategorySchema);
