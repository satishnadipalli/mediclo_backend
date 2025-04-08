const { validationResult, check } = require("express-validator");
const Discount = require("../models/Discount");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules
exports.createDiscountValidation = [
  check("code")
    .notEmpty()
    .withMessage("Discount code is required")
    .isLength({ min: 3, max: 20 })
    .withMessage("Code must be between 3 and 20 characters"),

  check("discountValue")
    .notEmpty()
    .withMessage("Discount percentage is required")
    .isNumeric()
    .withMessage("Value must be a number")
    .custom((value) => {
      if (value <= 0 || value > 100) {
        throw new Error("Percentage discount must be between 0 and 100");
      }
      return true;
    }),

  check("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  check("endDate")
    .notEmpty()
    .withMessage("End date is required")
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((value, { req }) => {
      const startDate = req.body.startDate
        ? new Date(req.body.startDate)
        : new Date();
      const endDate = new Date(value);
      if (endDate <= startDate) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),

  check("usageLimit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Usage limit must be at least 1"),
];

exports.updateDiscountValidation = [
  check("code")
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage("Code must be between 3 and 20 characters"),

  check("discountValue")
    .optional()
    .isNumeric()
    .withMessage("Value must be a number")
    .custom((value) => {
      if (value <= 0 || value > 100) {
        throw new Error("Percentage discount must be between 0 and 100");
      }
      return true;
    }),

  check("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  check("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((value, { req }) => {
      const startDate = req.body.startDate
        ? new Date(req.body.startDate)
        : req.discount
        ? req.discount.startDate
        : new Date();
      const endDate = new Date(value);
      if (endDate <= startDate) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),

  check("usageLimit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Usage limit must be at least 1"),

  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

// @desc    Get all discounts
// @route   GET /api/discounts
// @access  Private/Admin
exports.getDiscounts = async (req, res, next) => {
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
    let query = Discount.find(JSON.parse(queryStr));

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
    const total = await Discount.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const discounts = await query;

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
      count: discounts.length,
      pagination,
      data: discounts,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single discount
// @route   GET /api/discounts/:id
// @access  Private/Admin
exports.getDiscount = async (req, res, next) => {
  try {
    const discount = await Discount.findById(req.params.id);

    if (!discount) {
      return next(
        new ErrorResponse(`Discount not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: discount,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Validate discount code
// @route   POST /api/discounts/validate
// @access  Public
exports.validateDiscount = async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;

    if (!code) {
      return next(new ErrorResponse("Please provide a discount code", 400));
    }

    const discount = await Discount.findOne({ code: code.toUpperCase() });

    if (!discount) {
      return next(new ErrorResponse(`Discount code ${code} is invalid`, 404));
    }

    // Check each validation condition separately for better error messages
    if (!discount.isActive) {
      return next(
        new ErrorResponse(`Discount code ${code} is not active`, 400)
      );
    }

    const now = new Date();
    if (now < discount.startDate) {
      return next(
        new ErrorResponse(`Discount code ${code} is not yet valid`, 400)
      );
    }

    if (now > discount.endDate) {
      return next(new ErrorResponse(`Discount code ${code} has expired`, 400));
    }

    if (
      discount.usageLimit !== null &&
      discount.usageCount >= discount.usageLimit
    ) {
      return next(
        new ErrorResponse(
          `Discount code ${code} usage limit has been reached`,
          400
        )
      );
    }

    // Check minimum purchase requirement
    if (subtotal && subtotal < discount.minPurchase) {
      return next(
        new ErrorResponse(
          `Minimum purchase of $${discount.minPurchase} required for this discount`,
          400
        )
      );
    }

    // Calculate discount amount if subtotal is provided
    let discountAmount = null;
    if (subtotal) {
      discountAmount = discount.calculateDiscount(subtotal);
    }

    res.status(200).json({
      success: true,
      data: {
        discount,
        discountAmount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new discount
// @route   POST /api/discounts
// @access  Private/Admin
exports.createDiscount = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Add user to req.body
    req.body.createdBy = req.user.id;

    // Convert code to uppercase
    req.body.code = req.body.code.toUpperCase();

    // Create discount
    const discount = await Discount.create(req.body);

    res.status(201).json({
      success: true,
      data: discount,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update discount
// @route   PUT /api/discounts/:id
// @access  Private/Admin
exports.updateDiscount = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let discount = await Discount.findById(req.params.id);

    if (!discount) {
      return next(
        new ErrorResponse(`Discount not found with id of ${req.params.id}`, 404)
      );
    }

    // Convert code to uppercase if provided
    if (req.body.code) {
      req.body.code = req.body.code.toUpperCase();
    }

    // Update discount
    discount = await Discount.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: discount,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete discount
// @route   DELETE /api/discounts/:id
// @access  Private/Admin
exports.deleteDiscount = async (req, res, next) => {
  try {
    const discount = await Discount.findById(req.params.id);

    if (!discount) {
      return next(
        new ErrorResponse(`Discount not found with id of ${req.params.id}`, 404)
      );
    }

    await discount.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};
