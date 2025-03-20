const { validationResult, check } = require("express-validator");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules
exports.createInventoryValidation = [
  check("product")
    .notEmpty()
    .withMessage("Product is required")
    .isMongoId()
    .withMessage("Invalid product ID"),

  check("sku")
    .notEmpty()
    .withMessage("SKU is required")
    .isString()
    .withMessage("SKU must be a string"),

  check("barcode")
    .optional()
    .isString()
    .withMessage("Barcode must be a string"),

  check("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),

  check("lowStockThreshold")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Low stock threshold must be a positive integer"),

  check("location")
    .optional()
    .isString()
    .withMessage("Location must be a string"),
];

exports.updateInventoryValidation = [
  check("product").optional().isMongoId().withMessage("Invalid product ID"),

  check("sku").optional().isString().withMessage("SKU must be a string"),

  check("barcode")
    .optional()
    .isString()
    .withMessage("Barcode must be a string"),

  check("quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),

  check("lowStockThreshold")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Low stock threshold must be a positive integer"),

  check("location")
    .optional()
    .isString()
    .withMessage("Location must be a string"),
];

// Add stock update validation
exports.updateStockValidation = [
  check("productId").optional().isMongoId().withMessage("Invalid product ID"),

  check("productName")
    .optional()
    .isString()
    .withMessage("Product name must be a string"),

  check("newStock")
    .notEmpty()
    .withMessage("New stock level is required")
    .isInt({ min: 0 })
    .withMessage("Stock level must be a non-negative integer"),

  check("notes").optional().isString().withMessage("Notes must be a string"),
];

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private/Admin
exports.getInventoryItems = async (req, res, next) => {
  try {
    // Build query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit"];
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Finding resource
    let query = Inventory.find(JSON.parse(queryStr)).populate({
      path: "product",
      select: "name price images",
    });

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
      query = query.sort("-updatedAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Inventory.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const inventoryItems = await query;

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
      count: inventoryItems.length,
      pagination,
      data: inventoryItems,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single inventory item
// @route   GET /api/inventory/:id
// @access  Private/Admin
exports.getInventoryItem = async (req, res, next) => {
  try {
    const inventoryItem = await Inventory.findById(req.params.id).populate({
      path: "product",
      select: "name price images",
    });

    if (!inventoryItem) {
      return next(
        new ErrorResponse(
          `Inventory item not found with id of ${req.params.id}`,
          404
        )
      );
    }

    res.status(200).json({
      success: true,
      data: inventoryItem,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get inventory for a product
// @route   GET /api/inventory/product/:productId
// @access  Private/Admin
exports.getProductInventory = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId);

    if (!product) {
      return next(
        new ErrorResponse(
          `Product not found with id of ${req.params.productId}`,
          404
        )
      );
    }

    const inventoryItem = await Inventory.findOne({
      product: req.params.productId,
    });

    if (!inventoryItem) {
      return next(
        new ErrorResponse(
          `Inventory not found for product with id of ${req.params.productId}`,
          404
        )
      );
    }

    res.status(200).json({
      success: true,
      data: inventoryItem,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new inventory item
// @route   POST /api/inventory
// @access  Private/Admin
exports.createInventoryItem = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Check if product exists
    const product = await Product.findById(req.body.product);
    if (!product) {
      return next(
        new ErrorResponse(
          `Product not found with id of ${req.body.product}`,
          404
        )
      );
    }

    // Check if inventory already exists for this product
    const existingInventory = await Inventory.findOne({
      product: req.body.product,
    });
    if (existingInventory) {
      return next(
        new ErrorResponse(
          `Inventory already exists for product with id of ${req.body.product}`,
          400
        )
      );
    }

    // Create inventory item
    const inventoryItem = await Inventory.create(req.body);

    res.status(201).json({
      success: true,
      data: inventoryItem,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
// @access  Private/Admin
exports.updateInventoryItem = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let inventoryItem = await Inventory.findById(req.params.id);

    if (!inventoryItem) {
      return next(
        new ErrorResponse(
          `Inventory item not found with id of ${req.params.id}`,
          404
        )
      );
    }

    // Update inventory item
    inventoryItem = await Inventory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: inventoryItem,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Private/Admin
exports.deleteInventoryItem = async (req, res, next) => {
  try {
    const inventoryItem = await Inventory.findById(req.params.id);

    if (!inventoryItem) {
      return next(
        new ErrorResponse(
          `Inventory item not found with id of ${req.params.id}`,
          404
        )
      );
    }

    await inventoryItem.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
// @access  Private/Admin
exports.getLowStockItems = async (req, res, next) => {
  try {
    const inventoryItems = await Inventory.find().populate({
      path: "product",
      select: "name price images",
    });

    // Filter items that are low in stock
    const lowStockItems = inventoryItems.filter((item) => item.isLowStock());

    res.status(200).json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update stock level
// @route   PUT /api/inventory/stock
// @access  Private/Admin
exports.updateStock = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { productId, productName, newStock, notes } = req.body;

    let inventory;

    // Find inventory item either by product ID or product name
    if (productId) {
      inventory = await Inventory.findOne({ product: productId });
    } else if (productName) {
      inventory = await Inventory.findOne({
        productName: { $regex: new RegExp(productName, "i") },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Either productId or productName is required",
      });
    }

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: "Inventory item not found",
      });
    }

    // Update the stock level
    await inventory.updateStock(newStock, req.user.id, notes);

    res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (err) {
    next(err);
  }
};
