const { validationResult, check } = require("express-validator");
const Shipping = require("../models/Shipping");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules
exports.createShippingValidation = [
  check("name")
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 100 })
    .withMessage("Name cannot be more than 100 characters"),

  check("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot be more than 500 characters"),

  check("price")
    .notEmpty()
    .withMessage("Price is required")
    .isNumeric()
    .withMessage("Price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  check("estimatedDeliveryDays.min")
    .notEmpty()
    .withMessage("Minimum delivery days is required")
    .isInt({ min: 0 })
    .withMessage("Minimum delivery days must be a positive integer"),

  check("estimatedDeliveryDays.max")
    .notEmpty()
    .withMessage("Maximum delivery days is required")
    .isInt({ min: 0 })
    .withMessage("Maximum delivery days must be a positive integer")
    .custom((value, { req }) => {
      if (value < req.body.estimatedDeliveryDays.min) {
        throw new Error(
          "Maximum delivery days must be greater than or equal to minimum delivery days"
        );
      }
      return true;
    }),

  check("regions").optional().isArray().withMessage("Regions must be an array"),

  check("regions.*.country")
    .optional()
    .notEmpty()
    .withMessage("Country is required for each region"),

  check("regions.*.additionalPrice")
    .optional()
    .isNumeric()
    .withMessage("Additional price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Additional price must be a positive number"),

  check("freeShippingThreshold")
    .optional()
    .isNumeric()
    .withMessage("Free shipping threshold must be a number")
    .isFloat({ min: 0 })
    .withMessage("Free shipping threshold must be a positive number"),

  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

exports.updateShippingValidation = [
  check("name")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Name cannot be more than 100 characters"),

  check("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot be more than 500 characters"),

  check("price")
    .optional()
    .isNumeric()
    .withMessage("Price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  check("estimatedDeliveryDays.min")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Minimum delivery days must be a positive integer"),

  check("estimatedDeliveryDays.max")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Maximum delivery days must be a positive integer")
    .custom((value, { req }) => {
      if (
        req.body.estimatedDeliveryDays &&
        req.body.estimatedDeliveryDays.min &&
        value < req.body.estimatedDeliveryDays.min
      ) {
        throw new Error(
          "Maximum delivery days must be greater than or equal to minimum delivery days"
        );
      }
      return true;
    }),

  check("regions").optional().isArray().withMessage("Regions must be an array"),

  check("regions.*.country")
    .optional()
    .notEmpty()
    .withMessage("Country is required for each region"),

  check("regions.*.additionalPrice")
    .optional()
    .isNumeric()
    .withMessage("Additional price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Additional price must be a positive number"),

  check("freeShippingThreshold")
    .optional()
    .isNumeric()
    .withMessage("Free shipping threshold must be a number")
    .isFloat({ min: 0 })
    .withMessage("Free shipping threshold must be a positive number"),

  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

// @desc    Get all shipping methods
// @route   GET /api/shipping
// @access  Public
exports.getShippingMethods = async (req, res, next) => {
  try {
    const shippingMethods = await Shipping.find({ isActive: true }).sort(
      "price"
    );

    res.status(200).json({
      success: true,
      count: shippingMethods.length,
      data: shippingMethods,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all shipping methods (admin)
// @route   GET /api/shipping/admin
// @access  Private/Admin
exports.getAllShippingMethods = async (req, res, next) => {
  try {
    const shippingMethods = await Shipping.find().sort("price");

    res.status(200).json({
      success: true,
      count: shippingMethods.length,
      data: shippingMethods,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single shipping method
// @route   GET /api/shipping/:id
// @access  Public
exports.getShippingMethod = async (req, res, next) => {
  try {
    const shippingMethod = await Shipping.findById(req.params.id);

    if (!shippingMethod) {
      return next(
        new ErrorResponse(
          `Shipping method not found with id of ${req.params.id}`,
          404
        )
      );
    }

    res.status(200).json({
      success: true,
      data: shippingMethod,
    });
  } catch (err) {
    next(err);
  }
};

// Validation for calculating shipping cost
exports.calculateShippingCostValidation = [
  check("shippingMethodId")
    .notEmpty()
    .withMessage("Shipping method ID is required")
    .isMongoId()
    .withMessage("Invalid shipping method ID"),

  check("subtotal")
    .notEmpty()
    .withMessage("Subtotal is required")
    .isNumeric()
    .withMessage("Subtotal must be a number")
    .isFloat({ min: 0 })
    .withMessage("Subtotal must be a positive number"),

  check("country")
    .notEmpty()
    .withMessage("Country is required")
    .isString()
    .withMessage("Country must be a string"),

  check("state").optional().isString().withMessage("State must be a string"),
];

// @desc    Calculate shipping cost
// @route   POST /api/shipping/calculate
// @access  Public
exports.calculateShippingCost = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { shippingMethodId, subtotal, country, state } = req.body;

    if (!shippingMethodId) {
      return next(
        new ErrorResponse("Please provide a shipping method ID", 400)
      );
    }

    if (!country) {
      return next(new ErrorResponse("Please provide a country", 400));
    }

    const shippingMethod = await Shipping.findById(shippingMethodId);

    if (!shippingMethod) {
      return next(
        new ErrorResponse(
          `Shipping method not found with id of ${shippingMethodId}`,
          404
        )
      );
    }

    if (!shippingMethod.isActive) {
      return next(new ErrorResponse("Shipping method is not active", 400));
    }

    // Calculate shipping cost
    const cost = shippingMethod.calculateCost(subtotal || 0, country, state);

    res.status(200).json({
      success: true,
      data: {
        shippingMethod,
        cost,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new shipping method
// @route   POST /api/shipping
// @access  Private/Admin
exports.createShippingMethod = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Create shipping method
    const shippingMethod = await Shipping.create(req.body);

    res.status(201).json({
      success: true,
      data: shippingMethod,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update shipping method
// @route   PUT /api/shipping/:id
// @access  Private/Admin
exports.updateShippingMethod = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let shippingMethod = await Shipping.findById(req.params.id);

    if (!shippingMethod) {
      return next(
        new ErrorResponse(
          `Shipping method not found with id of ${req.params.id}`,
          404
        )
      );
    }

    // Update shipping method
    shippingMethod = await Shipping.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: shippingMethod,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete shipping method
// @route   DELETE /api/shipping/:id
// @access  Private/Admin
exports.deleteShippingMethod = async (req, res, next) => {
  try {
    const shippingMethod = await Shipping.findById(req.params.id);

    if (!shippingMethod) {
      return next(
        new ErrorResponse(
          `Shipping method not found with id of ${req.params.id}`,
          404
        )
      );
    }

    await shippingMethod.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// Validation rules for updating shipping status
exports.updateShippingStatusValidation = [
  check("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["pending", "shipped", "delivered", "cancelled"])
    .withMessage("Status must be pending, shipped, delivered, or cancelled"),

  check("trackingNumber")
    .optional()
    .isString()
    .withMessage("Tracking number must be a string"),

  check("assignedTo")
    .optional()
    .isMongoId()
    .withMessage("Invalid user ID for assignedTo"),

  check("shippingDate")
    .optional()
    .isISO8601()
    .withMessage("Shipping date must be a valid date format"),
];

// @desc    Update shipping status
// @route   PUT /api/shipping/:id/status
// @access  Private/Admin
exports.updateShippingStatus = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let shipping = await Shipping.findById(req.params.id);

    if (!shipping) {
      return next(
        new ErrorResponse(`Shipping not found with id of ${req.params.id}`, 404)
      );
    }

    // Update status and relevant fields
    const { status, trackingNumber, assignedTo, shippingDate } = req.body;

    // Update fields
    shipping.status = status;

    if (trackingNumber) {
      shipping.trackingNumber = trackingNumber;
    }

    if (assignedTo) {
      shipping.assignedTo = assignedTo;
    }

    // If status is shipped and no shipping date is provided, use current date
    if (status === "shipped" && !shipping.shippingDate) {
      shipping.shippingDate = shippingDate || new Date();
    }

    // If status is delivered and no delivery date is provided, use current date
    if (status === "delivered" && !shipping.deliveryDate) {
      shipping.deliveryDate = new Date();
    }

    await shipping.save();

    res.status(200).json({
      success: true,
      data: shipping,
    });
  } catch (err) {
    next(err);
  }
};
