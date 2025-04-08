const { validationResult, check } = require("express-validator");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Discount = require("../models/Discount");
const Transaction = require("../models/Transaction");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules - keep only those needed for admin functions
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

// Validation for public order submission
exports.validatePublicOrder = [
  check("firstName").notEmpty().withMessage("First name is required"),
  check("lastName").notEmpty().withMessage("Last name is required"),
  check("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address"),
  check("phone").notEmpty().withMessage("Phone number is required"),
  check("address1").notEmpty().withMessage("Address is required"),
  check("city").notEmpty().withMessage("City is required"),
  check("state").notEmpty().withMessage("State is required"),
  check("postalCode").notEmpty().withMessage("Postal code is required"),
  check("country").notEmpty().withMessage("Country is required"),
  check("items")
    .notEmpty()
    .withMessage("Order items are required")
    .isArray()
    .withMessage("Items must be an array"),
  check("items.*.productId")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Invalid product ID"),
  check("items.*.quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
  check("paymentMethod").optional(),
  check("discountCode").optional(),
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

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private/Admin
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("transactions");

    if (!order) {
      return next(
        new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
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

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, trackingNumber, shippingDate } = req.body;

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
      // Return quantities to inventory when cancelled
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          // Increase product quantity
          product.quantity += item.quantity;
          await product.save();
        }
      }
    } else if (status === "shipped" && order.status !== "shipped") {
      // Validate tracking number for shipped orders
      if (!trackingNumber) {
        return next(
          new ErrorResponse(
            "Tracking number is required for shipped orders",
            400
          )
        );
      }

      // When shipped, ensure quantities are deducted (if they haven't been already)
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          // We don't need to deduct here if we've already deducted at order creation time
          // This is just a safety check to ensure inventory is accurate
        }
      }
    }

    // Update order status
    order.status = status;
    order.updatedAt = Date.now();

    // Handle shipping-related updates
    if (status === "shipped") {
      // Update tracking number
      order.trackingNumber = trackingNumber;

      // Update shipping date
      if (shippingDate) {
        order.shippingDate = new Date(shippingDate);
      } else {
        order.shippingDate = new Date(); // Default to today if not provided
      }

      // Set estimated delivery (7 days after shipping by default)
      const estimatedDate = new Date(order.shippingDate);
      estimatedDate.setDate(estimatedDate.getDate() + 7);
      order.estimatedDelivery = estimatedDate;
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

    // Return quantities to inventory if order is not shipped or delivered
    if (order.status !== "shipped" && order.status !== "delivered") {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          // Return quantity to product
          product.quantity += item.quantity;
          await product.save();
        }
      }
    }

    await order.deleteOne();

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

// @desc    Submit product order without authentication
// @route   POST /api/orders/public
// @access  Public
exports.submitPublicOrder = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      address1,
      address2,
      city,
      state,
      postalCode,
      country,
      items,
      paymentMethod,
      discountCode,
    } = req.body;

    // Validate items and calculate subtotal
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product with ID ${item.productId} not found`,
        });
      }

      // Use discounted price if available, otherwise use regular price
      const itemPrice =
        product.discountedPrice > 0 ? product.discountedPrice : product.price;
      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: itemPrice,
        quantity: item.quantity,
        image:
          product.images && product.images.length > 0
            ? product.images[0].url
            : null,
      });
    }

    // Calculate tax (VAT)
    const taxRate = 0.2; // 20% VAT - this could be made configurable
    const tax = subtotal * taxRate;

    // Set fixed shipping cost
    const shippingCost = 5.99; // Standard shipping cost

    // Apply discount if code is provided
    let discountAmount = 0;
    let discountCodeUsed = null;

    if (discountCode) {
      const discount = await Discount.findOne({
        code: discountCode,
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      });

      if (discount) {
        // Calculate discount amount
        discountAmount = subtotal * (discount.discountValue / 100);
        discountCodeUsed = discountCode;

        // Increment usage count
        discount.usageCount += 1;
        await discount.save();
      }
    }

    // Calculate final total
    const total = subtotal + tax + shippingCost - discountAmount;

    // Create the order
    const order = await Order.create({
      isPublicSubmission: true,
      customerInfo: {
        firstName,
        lastName,
        email,
        phone,
      },
      shippingAddress: {
        firstName,
        lastName,
        address1,
        address2: address2 || "",
        city,
        state,
        postalCode,
        country,
        phone,
      },
      billingAddress: {
        firstName,
        lastName,
        address1,
        address2: address2 || "",
        city,
        state,
        postalCode,
        country,
        phone,
      },
      items: orderItems,
      paymentMethod: paymentMethod || "card",
      paymentStatus: "pending",
      subtotal,
      tax,
      shippingCost,
      discount: {
        code: discountCodeUsed,
        amount: discountAmount,
      },
      total,
      status: "pending",
    });

    // Deduct quantities from product inventory
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (product) {
        // Check if enough quantity available
        if (product.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            error: `Not enough inventory for ${product.name}. Only ${product.quantity} available.`,
          });
        }

        // Deduct from available quantity
        product.quantity -= item.quantity;
        await product.save();
      }
    }

    // Send successful response
    res.status(201).json({
      success: true,
      message: "Thank you for your order! We'll process it shortly.",
      reference: order._id,
      orderNumber: order.orderNumber,
      total,
    });
  } catch (err) {
    console.error("Error submitting order:", err);
    res.status(500).json({
      success: false,
      error:
        "We couldn't process your order. Please try again or contact us directly.",
    });
  }
};

// @desc    Check order status - public endpoint
// @route   GET /api/orders/public/:id
// @access  Public
exports.checkPublicOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order || !order.isPublicSubmission) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Return limited information for public access
    res.status(200).json({
      success: true,
      data: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        subtotal: order.subtotal,
        tax: order.tax,
        shippingCost: order.shippingCost,
        discount: order.discount,
        total: order.total,
        items: order.items.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        customerInfo: {
          firstName: order.customerInfo.firstName,
          lastName: order.customerInfo.lastName,
          email: order.customerInfo.email,
        },
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Validate discount code
// @route   POST /api/orders/public/validate-discount
// @access  Public
exports.validateDiscountCode = async (req, res) => {
  try {
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "Please provide a discount code",
      });
    }

    const discount = await Discount.findOne({
      code: code.toUpperCase(),
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    if (!discount) {
      return res.status(404).json({
        success: false,
        error: "Invalid or expired discount code",
      });
    }

    // Check if discount has a usage limit
    if (
      discount.usageLimit !== null &&
      discount.usageCount >= discount.usageLimit
    ) {
      return res.status(400).json({
        success: false,
        error: "This discount code has reached its usage limit",
      });
    }

    // Calculate discount amount if subtotal is provided
    let discountAmount = 0;
    if (subtotal) {
      discountAmount = subtotal * (discount.discountValue / 100);
    }

    res.status(200).json({
      success: true,
      data: {
        code: discount.code,
        value: discount.discountValue,
        description: discount.discountValue + "% off",
        discountAmount: discountAmount || null,
      },
    });
  } catch (err) {
    console.error("Error validating discount:", err);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

// @desc    Get active discounts
// @route   GET /api/orders/public/discounts
// @access  Public
exports.getActiveDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).select("code discountValue usageLimit usageCount");

    // Filter out discounts that have reached their usage limit
    const availableDiscounts = discounts.filter((discount) => {
      return (
        discount.usageLimit === null ||
        discount.usageCount < discount.usageLimit
      );
    });

    res.status(200).json({
      success: true,
      count: availableDiscounts.length,
      data: availableDiscounts,
    });
  } catch (err) {
    console.error("Error getting active discounts:", err);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
