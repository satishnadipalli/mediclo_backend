const mongoose = require("mongoose");

const RecipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please add description"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["Breakfast", "Lunch", "Dinner", "Dessert", "Snack"],
      required: [true, "Please add a category"],
    },
    image: {
      type: String,
      default: "/placeholder.svg?height=200&width=300",
    },
    prepTime: {
      type: String,
      required: [true, "Please add prep time"],
    },
    cookTime: {
      type: String,
      required: [true, "Please add cook time"],
    },
    servings: {
      type: Number,
      required: [true, "Please add servings"],
    },
    ingredients: [
      {
        type: String,
        required: true,
      },
    ],
    instructions: [
      {
        type: String,
        required: true,
      },
    ],
    nutritionFacts: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
    },
    downloads: {
      type: Number,
      default: 0,
    },
    isGlutenFree: {
      type: Boolean,
      default: true,
    },
    tags: [
      {
        type: String,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for efficient searches
RecipeSchema.index({ title: "text", category: 1 });
RecipeSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model("Recipe", RecipeSchema);
