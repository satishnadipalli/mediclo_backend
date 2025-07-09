const Recipe = require("../models/Recipe");
const ErrorResponse = require("../utils/errorResponse");
const { body, validationResult } = require("express-validator");

// ----------------- VALIDATIONS -----------------
exports.validateRecipe = [
  body("title")
    .notEmpty()
    .withMessage("Recipe title is required")
    .isLength({ max: 100 })
    .withMessage("Title must be less than 100 characters"),

  body("ingredients")
    .isArray({ min: 1 })
    .withMessage("Please provide at least one ingredient"),

  body("description").notEmpty().withMessage("Description is required"),

  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isIn(["Breakfast", "Lunch", "Dinner", "Dessert", "Snack"])
    .withMessage(
      "Invalid category. Choose from Breakfast, Lunch, Dinner, Dessert, or Snack"
    ),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

// ----------------- ADMIN ROUTES -----------------

// @desc    Create a new recipe
// @route   POST /api/recipes
// @access  Private/Admin
exports.createRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.create(req.body);
    res.status(201).json({ success: true, data: recipe });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a recipe
// @route   PUT /api/recipes/:id
// @access  Private/Admin
exports.updateRecipe = async (req, res, next) => {
  try {
    let recipe = await Recipe.findById(req.params.id);
    if (!recipe) return next(new ErrorResponse("Recipe not found", 404));

    recipe = await Recipe.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: recipe });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a recipe
// @route   DELETE /api/recipes/:id
// @access  Private/Admin
exports.deleteRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return next(new ErrorResponse("Recipe not found", 404));

    await recipe.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all recipes (admin)
// @route   GET /api/recipes/all
// @access  Private/Admin
exports.getAllRecipes = async (req, res, next) => {
  try {
    const recipes = await Recipe.find().sort("-createdAt");
    res
      .status(200)
      .json({ success: true, count: recipes.length, data: recipes });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single recipe (Admin)
// @route   GET /api/recipes/admin/:id
// @access  Private/Admin
exports.getSingleRecipeAdmin = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res
        .status(404)
        .json({ success: false, message: "Recipe not found" });
    }

    res.status(200).json({ success: true, data: recipe });
  } catch (err) {
    next(err);
  }
};

// ----------------- SUBSCRIBED USERS -----------------

// @desc    Get all recipes for subscribed users
// @route   GET /api/recipes
// @access  Private/Subscribed User
exports.getUserRecipes = async (req, res, next) => {
  try {
    const isSubscribed =
      req.user.membership &&
      req.user.subscriptionEnd &&
      new Date(req.user.subscriptionEnd) > new Date();

    if (!isSubscribed) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only for subscribed users.",
      });
    }
    const recipes = await Recipe.find().sort("-createdAt");
    res
      .status(200)
      .json({ success: true, count: recipes.length, data: recipes });
  } catch (error) {
    next(err);
  }
};

// @desc    Get single recipe
// @route   GET /api/recipes/:id
// @access  Private/Subscribed User
exports.getSingleRecipe = async (req, res, next) => {
  try {
    const isSubscribed =
      req.user.membership &&
      req.user.subscriptionEnd &&
      new Date(req.user.subscriptionEnd) > new Date();

    if (!isSubscribed) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only for subscribed users.",
      });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return next(new ErrorResponse("Recipe not found", 404));

    res.status(200).json({ success: true, data: recipe });
  } catch (err) {
    next(err);
  }
};
