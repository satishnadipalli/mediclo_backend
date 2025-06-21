const Subscription = require("../models/Subscription");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const User = require("../models/User");
const { validationResult, body } = require("express-validator");

/**********************
 * VALIDATION
 **********************/

exports.validateCreateSubscription = [
  body("plan")
    .notEmpty()
    .withMessage("Plan ID is required")
    .isMongoId()
    .withMessage("Invalid plan ID format"),
  body("paymentMethod")
    .optional()
    .isIn(["card", "cash", "insurance"])
    .withMessage("Invalid payment method"),
  body("transactionId").optional().isString(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

/**********************
 * UTILITIES
 **********************/

//Helper to calculate subscription dates based on plan's billing cycle
function calculateDates(plan, startDate = new Date()) {
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
  if (plan.gracePeriod) {
    endDate.setDate(endDate.getDate() + plan.gracePeriod);
  }
  return { startDate, endDate, nextRenewalDate };
}

/**********************
 * PUBLIC ROUTES
 **********************/
/**
 * @desc    Get all active subscription plans with pagination and filters
 * @route   GET /api/subscriptions/plans
 * @access  Public
 */
exports.getSubscriptionPlans = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    let queryObj = { status: "active" };

    if (req.query.billingCycle) {
      queryObj.billingCycle = req.query.billingCycle;
    }

    const total = await SubscriptionPlan.countDocuments(queryObj);
    const plans = await SubscriptionPlan.find(queryObj)
      .sort("order")
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: plans.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: plans,
    });
  } catch (err) {
    console.error("Fetch plans error:", err);
    next(err);
  }
};

/**
 * @desc    Get a single subscription plan by ID
 * @route   GET /api/subscriptions/plans/:id
 * @access  Public
 */
exports.getSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }
    res.status(200).json({ success: true, data: plan });
  } catch (error) {
    console.error("Get plan error:", error);
    next(error);
  }
};

/**********************
 * USER/ADMIN ROUTES
 **********************/

/**
 * @desc    Create a subscription
 * @route   POST /api/subscriptions
 * @access  Private (User)
 */
exports.createSubscription = async (req, res, next) => {
  try {
    const { plan: planId } = req.body;
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }

    const existing = await Subscription.findOne({
      user: req.user._id,
      isActive: true,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "User already has an active subscription",
      });
    }

    const { startDate, endDate, nextRenewalDate } = calculateDates(plan);

    const subscription = await Subscription.create({
      user: req.user._id,
      name: req.user.firstName,
      email: req.user.email,
      phone: req.user.phone,
      currentTier: plan.name,
      plan: plan._id,
      startDate,
      endDate,
      nextRenewalDate,
      paymentStatus: "paid",
      isActive: true,
      autoRenew: true,
      paymentHistory: [
        {
          amount: plan.price,
          status: "successful",
          paymentMethod: req.body.paymentMethod || "card",
          transactionId: req.body.transactionId || "",
        },
      ],
    });

    req.user.membership = plan.name.toLowerCase();
    req.user.subscriptionStart = startDate;
    req.user.subscriptionEnd = endDate;
    await req.user.save();

    res.status(201).json({ success: true, data: subscription });
  } catch (err) {
    console.error("Create subscription error:", err);
    next(err);
  }
};

/**
 * @desc    Renew subscription
 * @route   POST /api/subscriptions/:id/renew
 * @access  Private (User or Admin)
 */
exports.renewSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id).populate(
      "plan"
    );
    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, error: "Subscription not found" });
    }

    // Allow only the owner or admin
    if (
      req.user.role !== "admin" &&
      String(subscription.user) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to renew this subscription",
      });
    }

    const { startDate, endDate, nextRenewalDate } = calculateDates(
      subscription.plan
    );

    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.nextRenewalDate = nextRenewalDate;
    subscription.paymentStatus = "paid";
    subscription.isActive = true;

    subscription.paymentHistory.push({
      amount: subscription.plan.price,
      status: "successful",
      paymentMethod: req.body.paymentMethod || "card",
      transactionId: req.body.transactionId || "",
    });

    await subscription.save();

    if (subscription.user) {
      await User.findByIdAndUpdate(subscription.user, {
        membership: subscription.plan.name.toLowerCase(),
        subscriptionStart: startDate,
        subscriptionEnd: endDate,
      });
    }

    res.status(200).json({ success: true, data: subscription });
  } catch (err) {
    console.error("Renew subscription error:", err);
    next(err);
  }
};

/**
 * @desc    Cancel subscription
 * @route   POST /api/subscriptions/:id/cancel
 * @access  Private (User)
 */
exports.cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, error: "Subscription not found" });
    }

    if (String(subscription.user) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to cancel this subscription",
      });
    }

    subscription.isActive = false;
    subscription.paymentStatus = "cancelled";
    await subscription.save();

    res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: subscription,
    });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    next(err);
  }
};

/**
 * @desc    Create a new subscription plan
 * @route   POST /api/subscriptions/plans
 * @access  Private (Admin)
 */
exports.createSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.create(req.body);
    res.status(201).json({
      success: true,
      data: plan,
    });
  } catch (err) {
    console.error("Create plan error:", err);
    next(err);
  }
};

/**
 * @desc    Update an existing subscription plan
 * @route   PUT /api/subscriptions/plans/:id
 * @access  Private/Admin
 */
exports.updateSubscriptionPlan = async (req, res, next) => {
  try {
    let plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
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
    console.error("Update plan error:", err);
    next(err);
  }
};

/**
 * @desc    Delete a subscription plan if not in use
 * @route   DELETE /api/subscriptions/plans/:id
 * @access  Private/Admin
 */
exports.deleteSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }

    // Prevent deletion if plan is in use
    const activeSubs = await Subscription.countDocuments({
      plan: plan._id,
      isActive: true,
    });
    if (activeSubs > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete. Plan is used by ${activeSubs} active subscription(s).`,
      });
    }

    await plan.deleteOne();
    res.status(200).json({
      success: true,
      message: "Plan deleted successfully",
      data: {},
    });
  } catch (err) {
    console.error("Delete plan error:", err);
    next(err);
  }
};
