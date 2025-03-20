const { validationResult, check } = require("express-validator");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const Discount = require("../models/Discount");
const Transaction = require("../models/Transaction");
const Shipping = require("../models/Shipping");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules
exports.createOrderValidation = [
  check("items")
    .notEmpty()
    .withMessage("Items are required")
    .isArray()
    .withMessage("Items must be an array"),

  check("items.*.product")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Invalid product ID"),

  check("items.*.quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  check("shippingAddress.firstName")
    .notEmpty()
    .withMessage("First name is required"),

  check("shippingAddress.lastName")
    .notEmpty()
    .withMessage("Last name is required"),

  check("shippingAddress.address1")
    .notEmpty()
    .withMessage("Address is required"),

  check("shippingAddress.city").notEmpty().withMessage("City is required"),

  check("shippingAddress.state").notEmpty().withMessage("State is required"),

  check("shippingAddress.postalCode")
    .notEmpty()
    .withMessage("Postal code is required"),

  check("shippingAddress.country")
    .notEmpty()
    .withMessage("Country is required"),

  check("paymentMethod").notEmpty().withMessage("Payment method is required"),

  check("shippingMethod")
    .notEmpty()
    .withMessage("Shipping method is required")
    .isMongoId()
    .withMessage("Invalid shipping method ID"),

  check("discount.code")
    .optional()
    .isString()
    .withMessage("Discount code must be a string"),
];

exports.updateOrderValidation = [
  // Add validation rules here
];

exports.updateOrderStatusValidation = [
  check("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn([
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ])
    .withMessage("Invalid status value"),

  check("trackingNumber")
    .optional()
    .isString()
    .withMessage("Tracking number must be a string"),

  check("estimatedDelivery")
    .optional()
    .isISO8601()
    .withMessage("Estimated delivery must be a valid date"),
];

exports.refundOrderValidation = [
  check("reason").notEmpty().withMessage("Reason for refund is required"),

  check("amount")
    .notEmpty()
    .withMessage("Refund amount is required")
    .isNumeric()
    .withMessage("Refund amount must be a number")
    .custom((value, { req }) => value > 0)
    .withMessage("Refund amount must be greater than 0"),

  check("isFullRefund")
    .optional()
    .isBoolean()
    .withMessage("isFullRefund must be a boolean"),
];

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = async (req, res, next) => {
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
    let query = Order.find(JSON.parse(queryStr)).populate({
      path: "user",
      select: "name email",
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
      query = query.sort("-createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Order.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const orders = await query;

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
      count: orders.length,
      pagination,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user orders
// @route   GET /api/orders/user
// @access  Private
exports.getUserOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort("-createdAt");

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({
        path: "user",
        select: "name email",
      })
      .populate("transactions");

    if (!order) {
      return next(
        new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
      );
    }

    // Make sure user is order owner or admin
    if (
      order.user._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(
        new ErrorResponse("Not authorized to access this order", 403)
      );
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
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
    req.body.user = req.user.id;

    // Validate items and calculate subtotal
    let subtotal = 0;
    const items = [];

    for (const item of req.body.items) {
      // Check if product exists
      const product = await Product.findById(item.product);
      if (!product) {
        return next(
          new ErrorResponse(`Product not found with id of ${item.product}`, 404)
        );
      }

      // Check if product is in stock
      const inventory = await Inventory.findOne({ product: item.product });
      if (!inventory || inventory.quantity < item.quantity) {
        return next(
          new ErrorResponse(
            `Product ${product.name} is out of stock or has insufficient quantity`,
            400
          )
        );
      }

      // Add product details to item
      const orderItem = {
        product: product._id,
        name: product.name,
        price:
          product.discountedPrice > 0 ? product.discountedPrice : product.price,
        quantity: item.quantity,
        image:
          product.images.length > 0
            ? product.images.find((img) => img.isMain)?.url ||
              product.images[0].url
            : null,
      };

      // Calculate item total
      subtotal += orderItem.price * orderItem.quantity;

      items.push(orderItem);
    }

    // Apply discount if provided
    let discountAmount = 0;
    if (req.body.discount && req.body.discount.code) {
      const discount = await Discount.findOne({
        code: req.body.discount.code.toUpperCase(),
      });

      if (!discount) {
        return next(
          new ErrorResponse(
            `Discount code ${req.body.discount.code} is invalid`,
            400
          )
        );
      }

      // Check each validation condition separately for better error messages
      if (!discount.isActive) {
        return next(
          new ErrorResponse(
            `Discount code ${req.body.discount.code} is not active`,
            400
          )
        );
      }

      const now = new Date();
      if (now < discount.startDate) {
        return next(
          new ErrorResponse(
            `Discount code ${req.body.discount.code} is not yet valid`,
            400
          )
        );
      }

      if (now > discount.endDate) {
        return next(
          new ErrorResponse(
            `Discount code ${req.body.discount.code} has expired`,
            400
          )
        );
      }

      if (
        discount.usageLimit !== null &&
        discount.usageCount >= discount.usageLimit
      ) {
        return next(
          new ErrorResponse(
            `Discount code ${req.body.discount.code} usage limit has been reached`,
            400
          )
        );
      }

      // Check minimum purchase requirement
      if (subtotal < discount.minPurchase) {
        return next(
          new ErrorResponse(
            `Minimum purchase of $${discount.minPurchase} required for this discount`,
            400
          )
        );
      }

      // Calculate discount amount
      discountAmount = discount.calculateDiscount(subtotal);

      // Increment usage count
      discount.usageCount += 1;
      await discount.save();
    }

    // Calculate shipping cost
    let shippingCost = 0;
    if (req.body.shippingMethod) {
      const shipping = await Shipping.findById(req.body.shippingMethod);

      if (!shipping) {
        return next(
          new ErrorResponse(
            `Shipping method not found with id of ${req.body.shippingMethod}`,
            404
          )
        );
      }

      if (!shipping.isActive) {
        return next(new ErrorResponse(`Shipping method is not active`, 400));
      }

      // Calculate shipping cost
      shippingCost = shipping.calculateCost(
        subtotal,
        req.body.shippingAddress.country,
        req.body.shippingAddress.state
      );

      // Store shipping method name
      req.body.shippingMethod = shipping.name;
    }

    // Calculate tax (example: 10%)
    const taxRate = 0.1;
    const tax = (subtotal - discountAmount) * taxRate;

    // Calculate total
    const total = subtotal - discountAmount + tax + shippingCost;

    // Create order
    const order = await Order.create({
      user: req.user.id,
      items,
      shippingAddress: req.body.shippingAddress,
      billingAddress: req.body.billingAddress || req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod,
      shippingMethod: req.body.shippingMethod,
      subtotal,
      tax,
      shippingCost,
      discount: {
        code: req.body.discount?.code,
        amount: discountAmount,
      },
      total,
      status: "pending",
      notes: req.body.notes,
    });

    // Update inventory
    for (const item of items) {
      const inventory = await Inventory.findOne({ product: item.product });
      inventory.reservedQuantity += item.quantity;
      await inventory.save();
    }

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return next(new ErrorResponse("Please provide a status", 400));
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return next(
        new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
      );
    }

    // Handle inventory changes based on status change
    if (status === "cancelled" && order.status !== "cancelled") {
      // Return reserved quantities to inventory
      for (const item of order.items) {
        const inventory = await Inventory.findOne({ product: item.product });
        if (inventory) {
          inventory.reservedQuantity -= item.quantity;
          await inventory.save();
        }
      }
    } else if (status === "shipped" && order.status !== "shipped") {
      // Deduct quantities from inventory when shipped
      for (const item of order.items) {
        const inventory = await Inventory.findOne({ product: item.product });
        if (inventory) {
          inventory.quantity -= item.quantity;
          inventory.reservedQuantity -= item.quantity;
          await inventory.save();
        }
      }
    }

    // Update order status
    order.status = status;
    order.updatedAt = Date.now();

    if (status === "shipped" && req.body.trackingNumber) {
      order.trackingNumber = req.body.trackingNumber;
    }

    if (status === "shipped" && req.body.estimatedDelivery) {
      order.estimatedDelivery = new Date(req.body.estimatedDelivery);
    }

    await order.save();

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private/Admin
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return next(
        new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
      );
    }

    // Check if order has transactions
    const transactions = await Transaction.find({ order: req.params.id });
    if (transactions.length > 0) {
      return next(
        new ErrorResponse(
          "Cannot delete order with associated transactions",
          400
        )
      );
    }

    // Return reserved quantities to inventory if order is not shipped or delivered
    if (order.status !== "shipped" && order.status !== "delivered") {
      for (const item of order.items) {
        const inventory = await Inventory.findOne({ product: item.product });
        if (inventory) {
          inventory.reservedQuantity -= item.quantity;
          await inventory.save();
        }
      }
    }

    await order.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Process refund for an order
// @route   POST /api/orders/:id/refund
// @access  Private/Admin
exports.processRefund = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return next(
        new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
      );
    }

    // Check if order is already refunded
    if (order.status === "refunded") {
      return next(new ErrorResponse(`Order has already been refunded`, 400));
    }

    // Get transactions related to this order
    const transactions = await Transaction.find({ order: req.params.id });

    if (transactions.length === 0) {
      return next(
        new ErrorResponse(`No transactions found for this order`, 404)
      );
    }

    // Find the successful transaction
    const successfulTransaction = transactions.find(
      (t) => t.status === "successful"
    );

    if (!successfulTransaction) {
      return next(
        new ErrorResponse(`No successful transaction found for this order`, 404)
      );
    }

    const { reason, amount, isFullRefund = false } = req.body;

    // Validate refund amount against order total
    if (!isFullRefund && amount > order.total) {
      return next(
        new ErrorResponse(`Refund amount cannot exceed order total`, 400)
      );
    }

    const refundAmount = isFullRefund ? order.total : amount;

    // Create refund transaction
    const refundTransaction = await Transaction.create({
      order: order._id,
      user: order.user,
      customerName: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
      amount: -refundAmount, // Negative amount for refunds
      paymentMethod: successfulTransaction.paymentMethod,
      status: "successful",
      paymentDetails: {
        originalTransactionId: successfulTransaction.transactionId,
        refundReason: reason,
      },
    });

    // Update the successful transaction
    successfulTransaction.status = "refunded";
    successfulTransaction.refundDetails.push({
      amount: refundAmount,
      reason,
      date: new Date(),
    });

    await successfulTransaction.save();

    // Update order status
    order.status = isFullRefund ? "refunded" : "partially_refunded";
    await order.save();

    res.status(200).json({
      success: true,
      data: {
        order,
        refundTransaction,
      },
    });
  } catch (err) {
    next(err);
  }
};
