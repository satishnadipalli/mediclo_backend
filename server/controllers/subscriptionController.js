const Subscription = require("../models/Subscription");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const { body, param, validationResult } = require("express-validator");

// Validation middleware
exports.validateSubscription = [
  body("user").optional(),
  body("name").notEmpty().withMessage("Please add a name"),
  body("email")
    .notEmpty()
    .withMessage("Please add an email")
    .isEmail()
    .withMessage("Please add a valid email"),
  body("plan").notEmpty().withMessage("Please select a plan"),
  body("currentTier").optional(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];

exports.validateSubscriptionPlan = [
  body("name")
    .notEmpty()
    .withMessage("Please add a plan name")
    .isLength({ max: 50 })
    .withMessage("Plan name cannot be more than 50 characters"),
  body("description").notEmpty().withMessage("Please add a plan description"),
  body("price")
    .notEmpty()
    .withMessage("Please add a price")
    .isNumeric()
    .withMessage("Price must be a number")
    .custom((value) => value >= 0)
    .withMessage("Price must be at least 0"),
  body("billingCycle")
    .notEmpty()
    .withMessage("Please select a billing cycle")
    .isIn(["monthly", "quarterly", "biannual", "annual"])
    .withMessage("Invalid billing cycle"),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Invalid status value"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];

// Validation middleware for public subscription
exports.validatePublicSubscription = [
  body("email")
    .notEmpty()
    .withMessage("Please add an email")
    .isEmail()
    .withMessage("Please add a valid email"),
  body("name").notEmpty().withMessage("Please provide your full name"),
  body("phone").notEmpty().withMessage("Please provide your phone number"),
  body("planId").notEmpty().withMessage("Please select a subscription plan"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];

// @desc    Get all subscriptions
// @route   GET /api/subscriptions
// @access  Private/Admin
exports.getSubscriptions = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit"];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Finding resource
    let query = Subscription.find(JSON.parse(queryStr))
      .populate({
        path: "user",
        select: "firstName lastName email",
      })
      .populate("plan");

    // Select Fields
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
    const total = await Subscription.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const subscriptions = await query;

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
      count: subscriptions.length,
      pagination,
      data: subscriptions,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single subscription
// @route   GET /api/subscriptions/:id
// @access  Private/Admin
exports.getSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate({
        path: "user",
        select: "firstName lastName email",
      })
      .populate("plan");

    if (!subscription) {
      return next(
        new ErrorResponse(
          `Subscription not found with id of ${req.params.id}`,
          404
        )
      );
    }

    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new subscription
// @route   POST /api/subscriptions
// @access  Private/Admin
exports.createSubscription = async (req, res, next) => {
  try {
    // Check if plan exists
    const plan = await SubscriptionPlan.findById(req.body.plan);
    if (!plan) {
      return next(
        new ErrorResponse(
          `Subscription plan not found with id of ${req.body.plan}`,
          404
        )
      );
    }

    // Only check user if provided
    if (req.body.user) {
      // Check if user exists
      const user = await User.findById(req.body.user);
      if (!user) {
        return next(
          new ErrorResponse(`User not found with id of ${req.body.user}`, 404)
        );
      }

      // Check if user already has an active subscription
      const existingSubscription = await Subscription.findOne({
        user: req.body.user,
        isActive: true,
      });

      if (existingSubscription) {
        return next(
          new ErrorResponse(`User already has an active subscription`, 400)
        );
      }
    } else {
      // If no user, check if email already has an active subscription
      const existingSubscription = await Subscription.findOne({
        email: req.body.email,
        isActive: true,
      });

      if (existingSubscription) {
        return next(
          new ErrorResponse(
            `This email already has an active subscription`,
            400
          )
        );
      }
    }

    // Calculate end date and next renewal date based on billing cycle
    const startDate = req.body.startDate
      ? new Date(req.body.startDate)
      : new Date();
    let endDate = new Date(startDate);
    let nextRenewalDate = new Date(startDate);

    switch (plan.billingCycle) {
      case "monthly":
        endDate.setMonth(endDate.getMonth() + 1);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
        break;
      case "quarterly":
        endDate.setMonth(endDate.getMonth() + 3);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 3);
        break;
      case "biannual":
        endDate.setMonth(endDate.getMonth() + 6);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 6);
        break;
      case "annual":
        endDate.setFullYear(endDate.getFullYear() + 1);
        nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
    }

    // Add grace period days to end date if it exists
    if (plan.gracePeriod) {
      endDate.setDate(endDate.getDate() + plan.gracePeriod);
    }

    // Create subscription with current tier if not provided
    const subscriptionData = {
      ...req.body,
      startDate,
      endDate,
      nextRenewalDate,
      currentTier: req.body.currentTier || plan.name,
    };

    const subscription = await Subscription.create(subscriptionData);

    res.status(201).json({
      success: true,
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update subscription
// @route   PUT /api/subscriptions/:id
// @access  Private/Admin
exports.updateSubscription = async (req, res, next) => {
  try {
    let subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return next(
        new ErrorResponse(
          `Subscription not found with id of ${req.params.id}`,
          404
        )
      );
    }

    subscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete subscription
// @route   DELETE /api/subscriptions/:id
// @access  Private/Admin
exports.deleteSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return next(
        new ErrorResponse(
          `Subscription not found with id of ${req.params.id}`,
          404
        )
      );
    }

    await subscription.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Renew subscription
// @route   PUT /api/subscriptions/:id/renew
// @access  Private/Admin
exports.renewSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id).populate(
      "plan"
    );

    if (!subscription) {
      return next(
        new ErrorResponse(
          `Subscription not found with id of ${req.params.id}`,
          404
        )
      );
    }

    // Calculate new end date and next renewal date
    const startDate = new Date();
    let endDate = new Date(startDate);
    let nextRenewalDate = new Date(startDate);

    switch (subscription.plan.billingCycle) {
      case "monthly":
        endDate.setMonth(endDate.getMonth() + 1);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
        break;
      case "quarterly":
        endDate.setMonth(endDate.getMonth() + 3);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 3);
        break;
      case "biannual":
        endDate.setMonth(endDate.getMonth() + 6);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 6);
        break;
      case "annual":
        endDate.setFullYear(endDate.getFullYear() + 1);
        nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
    }

    // Update subscription
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.nextRenewalDate = nextRenewalDate;
    subscription.paymentStatus = "paid";
    subscription.isActive = true;
    subscription.autoRenew = true;

    // Add to payment history
    subscription.paymentHistory.push({
      amount: subscription.plan.price,
      status: "successful",
      paymentMethod: req.body.paymentMethod || "card",
      transactionId: req.body.transactionId,
      date: Date.now(),
    });

    await subscription.save();

    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
exports.getSubscriptionPlans = async (req, res, next) => {
  try {
    // Only show active plans to public
    const query = { status: "active" };

    const plans = await SubscriptionPlan.find(query).sort("order");

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single subscription plan
// @route   GET /api/subscriptions/plans/:id
// @access  Public
exports.getSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return next(
        new ErrorResponse(
          `Subscription plan not found with id of ${req.params.id}`,
          404
        )
      );
    }

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new subscription plan
// @route   POST /api/subscriptions/plans
// @access  Private/Admin
exports.createSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.create(req.body);

    res.status(201).json({
      success: true,
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update subscription plan
// @route   PUT /api/subscriptions/plans/:id
// @access  Private/Admin
exports.updateSubscriptionPlan = async (req, res, next) => {
  try {
    let plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return next(
        new ErrorResponse(
          `Subscription plan not found with id of ${req.params.id}`,
          404
        )
      );
    }

    plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete subscription plan
// @route   DELETE /api/subscriptions/plans/:id
// @access  Private/Admin
exports.deleteSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return next(
        new ErrorResponse(
          `Subscription plan not found with id of ${req.params.id}`,
          404
        )
      );
    }

    // Check if plan is being used by any subscriptions
    const subscriptionsUsingPlan = await Subscription.countDocuments({
      plan: req.params.id,
      isActive: true,
    });

    if (subscriptionsUsingPlan > 0) {
      return next(
        new ErrorResponse(
          `Cannot delete plan. It is being used by ${subscriptionsUsingPlan} active subscriptions.`,
          400
        )
      );
    }

    await plan.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a subscription for public user (no login required)
// @route   POST /api/subscriptions/public
// @access  Public
exports.createPublicSubscription = async (req, res, next) => {
  try {
    const { name, email, phone, planId } = req.body;

    // Check if plan exists
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: "Subscription plan not found",
      });
    }

    // Check if email already has an active subscription
    const existingSubscription = await Subscription.findOne({
      email,
      isActive: true,
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: "This email already has an active subscription",
        data: {
          planName: existingSubscription.currentTier,
          endDate: existingSubscription.endDate,
          daysRemaining: Math.max(
            0,
            Math.ceil(
              (new Date(existingSubscription.endDate) - new Date()) /
                (1000 * 60 * 60 * 24)
            )
          ),
        },
      });
    }

    // Calculate end date and next renewal date based on billing cycle
    const startDate = new Date();
    let endDate = new Date(startDate);
    let nextRenewalDate = new Date(startDate);

    switch (plan.billingCycle) {
      case "monthly":
        endDate.setMonth(endDate.getMonth() + 1);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
        break;
      case "quarterly":
        endDate.setMonth(endDate.getMonth() + 3);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 3);
        break;
      case "biannual":
        endDate.setMonth(endDate.getMonth() + 6);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 6);
        break;
      case "annual":
        endDate.setFullYear(endDate.getFullYear() + 1);
        nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
    }

    // Add grace period days to end date
    if (plan.gracePeriod) {
      endDate.setDate(endDate.getDate() + plan.gracePeriod);
    }

    // Create subscription
    const subscription = await Subscription.create({
      name,
      email,
      phone,
      plan: planId,
      startDate,
      endDate,
      nextRenewalDate,
      currentTier: plan.name,
      paymentStatus: "paid", // Assuming payment is successful
      isActive: true,
      autoRenew: true,
      paymentHistory: [
        {
          amount: plan.price,
          status: "successful",
          paymentMethod: "card", // Placeholder for payment method
          date: Date.now(),
        },
      ],
    });

    // Generate a simplified response object
    const subscriptionDetails = {
      name,
      email,
      planName: plan.name,
      price: plan.price,
      billingCycle: plan.billingCycle,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      features: plan.features,
      gracePeriod: plan.gracePeriod || 0,
      daysRemaining: Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)),
    };

    res.status(201).json({
      success: true,
      message: `Successfully subscribed to ${
        plan.name
      } plan. Your subscription is valid until ${endDate.toLocaleDateString()}.`,
      data: subscriptionDetails,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Check subscription status by email
// @route   GET /api/subscriptions/check/:email
// @access  Public
exports.checkSubscriptionByEmail = async (req, res, next) => {
  try {
    const email = req.params.email;

    // Validate email format
    if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid email address",
      });
    }

    const subscription = await Subscription.findOne({
      email,
      isActive: true,
    }).populate("plan");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "No active subscription found for this email",
      });
    }

    // Prepare response data with relevant info only
    const subscriptionData = {
      name: subscription.name,
      email: subscription.email,
      planName: subscription.currentTier,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      isExpired: new Date() > subscription.endDate,
      daysRemaining: Math.max(
        0,
        Math.ceil(
          (new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)
        )
      ),
      status: subscription.paymentStatus,
      features: subscription.plan.features,
    };

    res.status(200).json({
      success: true,
      data: subscriptionData,
    });
  } catch (err) {
    next(err);
  }
};
