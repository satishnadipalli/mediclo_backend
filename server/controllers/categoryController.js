const { validationResult, check } = require("express-validator");
const Category = require("../models/Category");
const Product = require("../models/Product");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules
exports.createCategoryValidation = [
  check("name")
    .notEmpty()
    .withMessage("Category name is required")
    .isLength({ max: 50 })
    .withMessage("Category name cannot be more than 50 characters"),

  check("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot be more than 500 characters"),

  check("categoryType")
    .optional()
    .isIn(["Therapy Type", "Age Group", "Learning Type"])
    .withMessage(
      "Category type must be Therapy Type, Age Group, or Learning Type"
    ),

  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

exports.updateCategoryValidation = [
  check("name")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Category name cannot be more than 50 characters"),

  check("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot be more than 500 characters"),

  check("categoryType")
    .optional()
    .isIn(["product", "blog", "service", "other"])
    .withMessage("Category type must be product, blog, service, or other"),

  check("image").optional().isURL().withMessage("Image must be a valid URL"),

  check("parent")
    .optional()
    .isMongoId()
    .withMessage("Invalid parent category ID"),

  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

// Validation for assigning products to category
exports.assignProductsValidation = [
  check("products")
    .notEmpty()
    .withMessage("Products array is required")
    .isArray()
    .withMessage("Products must be an array"),

  check("products.*").isMongoId().withMessage("Each product ID must be valid"),
];

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort("name");

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get category tree
// @route   GET /api/categories/tree
// @access  Public
exports.getCategoryTree = async (req, res, next) => {
  try {
    // Get all parent categories
    const parentCategories = await Category.find({ parent: null })
      .populate({
        path: "subcategories",
        select: "name",
      })
      .sort("name");

    res.status(200).json({
      success: true,
      count: parentCategories.length,
      data: parentCategories,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
exports.getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id).populate({
      path: "subcategories",
      select: "name",
    });

    if (!category) {
      return next(
        new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get category by name
// @route   GET /api/categories/name/:name
// @access  Public
exports.getCategoryByName = async (req, res, next) => {
  try {
    const category = await Category.findOne({
      name: req.params.name,
      isActive: true,
    }).populate({
      path: "subcategories",
      select: "name",
    });

    if (!category) {
      return next(
        new ErrorResponse(
          `Category not found with name of ${req.params.name}`,
          404
        )
      );
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private/Admin
exports.createCategory = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Check if parent category exists
    if (req.body.parent) {
      const parentCategory = await Category.findById(req.body.parent);
      if (!parentCategory) {
        return next(
          new ErrorResponse(
            `Parent category not found with id of ${req.body.parent}`,
            404
          )
        );
      }
    }

    // Create category
    const category = await Category.create(req.body);

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(
        new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
      );
    }

    // Check if parent category exists
    if (req.body.parent) {
      const parentCategory = await Category.findById(req.body.parent);
      if (!parentCategory) {
        return next(
          new ErrorResponse(
            `Parent category not found with id of ${req.body.parent}`,
            404
          )
        );
      }

      // Prevent circular reference
      if (req.body.parent === req.params.id) {
        return next(
          new ErrorResponse("Category cannot be a parent of itself", 400)
        );
      }
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedCategory,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(
        new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
      );
    }

    // Check if category has subcategories
    const subcategories = await Category.find({ parent: req.params.id });
    if (subcategories.length > 0) {
      return next(
        new ErrorResponse("Cannot delete category with subcategories", 400)
      );
    }

    // Check if category has products
    const products = await Product.find({ category: req.params.id });
    if (products.length > 0) {
      return next(
        new ErrorResponse(
          "Cannot delete category with associated products",
          400
        )
      );
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Assign products to category
// @route   PUT /api/categories/:id/products
// @access  Private/Admin
exports.assignProducts = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(
        new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
      );
    }

    // Validate all products exist
    const { products } = req.body;

    // Fix: Use find instead of countDocuments to avoid $in operator issues
    const existingProducts = await Product.find({
      _id: { $in: products },
    });

    if (existingProducts.length !== products.length) {
      return res.status(400).json({
        success: false,
        error: "One or more product IDs are invalid",
      });
    }

    // Update the category's products
    category.products = products;
    await category.save();

    // Also update each product to have this category
    await Product.updateMany(
      { _id: { $in: products } },
      { category: category._id }
    );

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    next(err);
  }
};
