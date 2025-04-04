const { validationResult, check } = require("express-validator");
const Product = require("../models/Product");
const Category = require("../models/Category");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules
exports.createProductValidation = [
  check("name")
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ max: 100 })
    .withMessage("Product name cannot be more than 100 characters"),

  check("sku")
    .optional()
    .isLength({ max: 50 })
    .withMessage("SKU cannot be more than 50 characters"),

  check("barcode")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Barcode cannot be more than 50 characters"),

  check("quantity")
    .optional()
    .isNumeric()
    .withMessage("Quantity must be a number")
    .custom((value) => value >= 0)
    .withMessage("Quantity must be greater than or equal to 0"),

  check("description")
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ max: 2000 })
    .withMessage("Description cannot be more than 2000 characters"),

  check("shortDescription")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Short description cannot be more than 200 characters"),

  check("price")
    .notEmpty()
    .withMessage("Price is required")
    .isNumeric()
    .withMessage("Price must be a number")
    .custom((value) => value >= 0)
    .withMessage("Price must be greater than or equal to 0"),

  check("discountType")
    .optional()
    .isIn(["percentage", "fixed", "none"])
    .withMessage("Discount type must be percentage, fixed, or none"),

  check("discountPercentage")
    .optional()
    .isNumeric()
    .withMessage("Discount percentage must be a number")
    .custom((value) => value >= 0)
    .withMessage("Discount percentage must be greater than or equal to 0"),

  check("category")
    .notEmpty()
    .withMessage("Category is required")
    .isMongoId()
    .withMessage("Invalid category ID"),

  check("images").optional().isArray().withMessage("Images must be an array"),

  check("status")
    .optional()
    .isIn(["draft", "active", "inactive", "discontinued"])
    .withMessage("Status must be draft, active, inactive, or discontinued"),

  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  check("isFeatured")
    .optional()
    .isBoolean()
    .withMessage("isFeatured must be a boolean"),
];

exports.updateProductValidation = [
  check("name")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Product name cannot be more than 100 characters"),

  check("sku")
    .optional()
    .isLength({ max: 50 })
    .withMessage("SKU cannot be more than 50 characters"),

  check("barcode")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Barcode cannot be more than 50 characters"),

  check("quantity")
    .optional()
    .isNumeric()
    .withMessage("Quantity must be a number")
    .custom((value) => value >= 0)
    .withMessage("Quantity must be greater than or equal to 0"),

  check("description")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Description cannot be more than 2000 characters"),

  check("shortDescription")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Short description cannot be more than 200 characters"),

  check("price")
    .optional()
    .isNumeric()
    .withMessage("Price must be a number")
    .custom((value) => value >= 0)
    .withMessage("Price must be greater than or equal to 0"),

  check("discountType")
    .optional()
    .isIn(["percentage", "fixed", "none"])
    .withMessage("Discount type must be percentage, fixed, or none"),

  check("discountPercentage")
    .optional()
    .isNumeric()
    .withMessage("Discount percentage must be a number")
    .custom((value) => value >= 0)
    .withMessage("Discount percentage must be greater than or equal to 0"),

  check("category").optional().isMongoId().withMessage("Invalid category ID"),

  check("images").optional().isArray().withMessage("Images must be an array"),

  check("status")
    .optional()
    .isIn(["draft", "active", "inactive", "discontinued"])
    .withMessage("Status must be draft, active, inactive, or discontinued"),

  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  check("isFeatured")
    .optional()
    .isBoolean()
    .withMessage("isFeatured must be a boolean"),
];

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    // Build query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit", "search"];
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Finding resource
    let query = Product.find(JSON.parse(queryStr)).populate({
      path: "category",
      select: "name",
    });

    // Search functionality
    if (req.query.search) {
      query = query.find({ $text: { $search: req.query.search } });
    }

    // Select fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Fix: Create a clean query object for countDocuments to prevent $$in error
    let countQuery = {};
    if (req.query.search) {
      countQuery.$text = { $search: req.query.search };
    }
    // Add any other filter conditions manually
    if (reqQuery.isActive) countQuery.isActive = reqQuery.isActive;
    if (reqQuery.isFeatured) countQuery.isFeatured = reqQuery.isFeatured;
    if (reqQuery.category) countQuery.category = reqQuery.category;
    if (reqQuery.status) countQuery.status = reqQuery.status;

    const total = await Product.countDocuments(countQuery);

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const products = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: products.length,
      pagination,
      data: products,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate({
      path: "category",
      select: "name",
    });

    if (!product) {
      return next(
        new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get product by name
// @route   GET /api/products/name/:name
// @access  Public
exports.getProductByName = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      name: req.params.name,
      isActive: true,
    }).populate("category");

    if (!product) {
      return next(
        new ErrorResponse(
          `Product not found with name of ${req.params.name}`,
          404
        )
      );
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
exports.getFeaturedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isFeatured: true, isActive: true })
      .populate({
        path: "category",
        select: "name",
      })
      .limit(8);

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:categoryId
// @access  Public
exports.getProductsByCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.categoryId);

    if (!category) {
      return next(
        new ErrorResponse(
          `Category not found with id of ${req.params.categoryId}`,
          404
        )
      );
    }

    // Get all subcategories
    const subcategories = await Category.find({
      parent: req.params.categoryId,
    });
    const categoryIds = [
      req.params.categoryId,
      ...subcategories.map((cat) => cat._id),
    ];

    // Log categoryIds to ensure they are valid
    console.log("Category IDs:", categoryIds);

    // Build query
    const reqQuery = { ...req.query, category: { $in: categoryIds } };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit", "search"];
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc), but avoid replacing $in
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, (match) => `$${match}`);

    // Log the final query string
    console.log("Query String:", queryStr);

    // Finding resource
    let query = Product.find(JSON.parse(queryStr)).populate({
      path: "category",
      select: "name",
    });

    // Search functionality
    if (req.query.search) {
      query = query.find({ $text: { $search: req.query.search } });
    }

    // Select fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Fix: Create a clean query object for countDocuments to prevent $$in error
    let countQuery = { category: { $in: categoryIds } };
    if (req.query.search) {
      countQuery.$text = { $search: req.query.search };
    }

    // Log the count query
    console.log("Count Query:", countQuery);

    const total = await Product.countDocuments(countQuery);

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const products = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: products.length,
      pagination,
      data: products,
    });
  } catch (err) {
    console.error("Error in getProductsByCategory:", err);
    next(err);
  }
};

// @desc    Create new product
// @route   POST /api/products/admin
// @access  Private/Admin
exports.createProduct = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Add user to request body if not provided
    if (!req.body.createdBy) {
      req.body.createdBy = req.user.id;
    }

    // Create product
    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update product
// @route   PUT /api/products/admin/:id
// @access  Private/Admin
exports.updateProduct = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let product = await Product.findById(req.params.id);

    if (!product) {
      return next(
        new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
      );
    }

    // Update product
    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/admin/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(
        new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
      );
    }

    // Check if product is being used in any orders
    const Order = require("../models/Order");
    const orderCount = await Order.countDocuments({
      "items.product": product._id,
    });

    if (orderCount > 0) {
      // Instead of deleting, just mark as discontinued and inactive
      product.status = "discontinued";
      product.isActive = false;
      await product.save();

      return res.status(200).json({
        success: true,
        message: "Product marked as discontinued as it's used in orders",
        data: product,
      });
    }

    // Delete the product
    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update product stock level only
// @route   PUT /api/products/admin/:id/stock
// @access  Private/Admin
exports.updateProductStock = async (req, res, next) => {
  try {
    const { quantity } = req.body;

    // Validate the quantity
    if (
      quantity === undefined ||
      !Number.isInteger(parseInt(quantity)) ||
      parseInt(quantity) < 0
    ) {
      return next(
        new ErrorResponse(
          "Please provide a valid quantity as a non-negative integer",
          400
        )
      );
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(
        new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
      );
    }

    // Update only the quantity field
    product.quantity = parseInt(quantity);
    await product.save();

    res.status(200).json({
      success: true,
      message: "Stock level updated successfully",
      data: {
        id: product._id,
        name: product.name,
        quantity: product.quantity,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get products with low stock
// @route   GET /api/products/admin/inventory
// @access  Private/Admin
exports.getLowStockProducts = async (req, res, next) => {
  try {
    const lowStockThreshold = parseInt(req.query.threshold) || 5; // Default threshold is 5

    // Find products with quantity below threshold
    const products = await Product.find({
      quantity: { $lte: lowStockThreshold },
      status: { $ne: "discontinued" }, // Exclude discontinued products
    })
      .select("name category quantity status")
      .populate({
        path: "category",
        select: "name",
      })
      .sort("quantity");

    // Create response with stock status indicators
    const productsWithStatus = products.map((product) => {
      let stockStatus = "In Stock";

      if (product.quantity === 0) {
        stockStatus = "Out of Stock";
      } else if (product.quantity <= lowStockThreshold / 2) {
        stockStatus = "Low Stock";
      }

      return {
        _id: product._id,
        name: product.name,
        category: product.category,
        quantity: product.quantity,
        stockStatus: stockStatus,
      };
    });

    res.status(200).json({
      success: true,
      count: products.length,
      data: productsWithStatus,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all products with stock status for inventory management
// @route   GET /api/products/admin/all-inventory
// @access  Private/Admin
exports.getAllProductsInventory = async (req, res, next) => {
  try {
    const lowStockThreshold = parseInt(req.query.threshold) || 5; // Default threshold is 5

    // Get all active products with inventory info
    const products = await Product.find({
      status: { $ne: "discontinued" }, // Exclude discontinued products
    })
      .select("name category quantity status")
      .populate({
        path: "category",
        select: "name",
      })
      .sort("name");

    // Create response with stock status indicators
    const productsWithStatus = products.map((product) => {
      let stockStatus = "In Stock";

      if (product.quantity === 0) {
        stockStatus = "Out of Stock";
      } else if (product.quantity <= lowStockThreshold) {
        stockStatus = "Low Stock";
      }

      return {
        _id: product._id,
        name: product.name,
        category: product.category.name,
        quantity: product.quantity,
        status: product.status,
        stockStatus: stockStatus,
      };
    });

    res.status(200).json({
      success: true,
      count: products.length,
      data: productsWithStatus,
    });
  } catch (err) {
    next(err);
  }
};
