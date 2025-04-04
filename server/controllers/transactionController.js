const { validationResult, check } = require("express-validator");
const Transaction = require("../models/Transaction");
const Order = require("../models/Order");
const ErrorResponse = require("../utils/errorResponse");

// Validation rules
exports.createTransactionValidation = [
  check("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid order ID"),

  check("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isNumeric()
    .withMessage("Amount must be a number")
    .custom((value) => value > 0)
    .withMessage("Amount must be greater than 0"),

  check("currency")
    .notEmpty()
    .withMessage("Currency is required")
    .isString()
    .withMessage("Currency must be a string"),

  check("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isString()
    .withMessage("Payment method must be a string"),

  check("status")
    .optional()
    .isIn(["pending", "completed", "failed", "refunded"])
    .withMessage("Invalid status value"),

  check("transactionDate")
    .optional()
    .isISO8601()
    .withMessage("Transaction date must be a valid date"),
];

exports.updateTransactionValidation = [
  check("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["pending", "completed", "failed", "refunded"])
    .withMessage("Invalid status value"),

  check("amount")
    .optional()
    .isNumeric()
    .withMessage("Amount must be a number")
    .custom((value) => value > 0)
    .withMessage("Amount must be greater than 0"),

  check("transactionDate")
    .optional()
    .isISO8601()
    .withMessage("Transaction date must be a valid date"),
];

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private/Admin
exports.getTransactions = async (req, res, next) => {
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
    let query = Transaction.find(JSON.parse(queryStr))
      .populate({
        path: "order",
        select: "orderNumber total",
      })
      .populate({
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
    const total = await Transaction.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const transactions = await query;

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
      count: transactions.length,
      pagination,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get transactions by user ID
// @route   GET /api/transactions/user/:userId
// @access  Private/Admin
exports.getUserTransactions = async (req, res, next) => {
  try {
    // Admin can retrieve transactions for any user
    if (!req.params.userId) {
      return next(new ErrorResponse("Please provide a user ID", 400));
    }

    const transactions = await Transaction.find({ user: req.params.userId })
      .populate({
        path: "order",
        select: "orderNumber total",
      })
      .sort("-createdAt");

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private/Admin
exports.getTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate({
        path: "order",
        select: "orderNumber total items shippingAddress",
      })
      .populate({
        path: "user",
        select: "name email",
      });

    if (!transaction) {
      return next(
        new ErrorResponse(
          `Transaction not found with id of ${req.params.id}`,
          404
        )
      );
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private/Admin
exports.createTransaction = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Check if order exists
    const order = await Order.findById(req.body.order);
    if (!order) {
      return next(
        new ErrorResponse(`Order not found with id of ${req.body.order}`, 404)
      );
    }

    // Set user from order if not provided
    if (!req.body.user) {
      req.body.user = order.user;
    }

    // Create transaction
    const transaction = await Transaction.create(req.body);

    // Update order status if transaction is completed
    if (transaction.status === "completed") {
      order.status = "processing";
      await order.save();
    }

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private/Admin
exports.updateTransaction = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return next(
        new ErrorResponse(
          `Transaction not found with id of ${req.params.id}`,
          404
        )
      );
    }

    // Update transaction
    transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Update order status if transaction status changes
    if (req.body.status) {
      const order = await Order.findById(transaction.order);

      if (order) {
        if (req.body.status === "completed" && order.status === "pending") {
          order.status = "processing";
          await order.save();
        } else if (
          req.body.status === "failed" &&
          order.status === "processing"
        ) {
          order.status = "pending";
          await order.save();
        } else if (
          req.body.status === "refunded" &&
          (order.status === "processing" ||
            order.status === "shipped" ||
            order.status === "delivered")
        ) {
          order.status = "refunded";
          await order.save();
        }
      }
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Process refund
// @route   POST /api/transactions/:id/refund
// @access  Private/Admin
exports.processRefund = async (req, res, next) => {
  try {
    const { amount, reason } = req.body;

    if (!amount) {
      return next(new ErrorResponse("Please provide a refund amount", 400));
    }

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return next(
        new ErrorResponse(
          `Transaction not found with id of ${req.params.id}`,
          404
        )
      );
    }

    if (transaction.status !== "completed") {
      return next(
        new ErrorResponse("Only completed transactions can be refunded", 400)
      );
    }

    // Validate refund amount
    if (amount > transaction.amount) {
      return next(
        new ErrorResponse("Refund amount cannot exceed transaction amount", 400)
      );
    }

    // Calculate total refunded amount including previous refunds
    const totalRefunded =
      transaction.refundDetails.reduce(
        (sum, refund) => sum + refund.amount,
        0
      ) + amount;

    if (totalRefunded > transaction.amount) {
      return next(
        new ErrorResponse(
          "Total refund amount cannot exceed transaction amount",
          400
        )
      );
    }

    // Add refund details
    transaction.refundDetails.push({
      amount,
      reason: reason || "Refund requested",
      date: Date.now(),
    });

    // Update transaction status
    if (totalRefunded === transaction.amount) {
      transaction.status = "refunded";
    } else {
      transaction.status = "partially_refunded";
    }

    await transaction.save();

    // Update order status
    const order = await Order.findById(transaction.order);
    if (order) {
      if (totalRefunded === transaction.amount) {
        order.status = "refunded";
      } else {
        // You might want to add a 'partially_refunded' status to the Order model
        order.notes = `${
          order.notes ? order.notes + ". " : ""
        }Partially refunded: $${totalRefunded}`;
      }
      await order.save();
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
};
