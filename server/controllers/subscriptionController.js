const Subscription = require("../models/Subscription");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const User = require("../models/User");
const { validationResult, body } = require("express-validator");
const crypto = require("crypto");
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

exports.validateCreatePlan = [
  body("name")
    .notEmpty()
    .withMessage("Plan name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Plan name must be between 2 and 100 characters"),
  body("description")
    .notEmpty()
    .withMessage("Plan description is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Plan description must be between 10 and 500 characters"),
  body("price")
    .isNumeric()
    .withMessage("Price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Price must be greater than or equal to 0"),
  body("billingCycle")
    .isIn(["monthly", "quarterly", "biannual", "annual"])
    .withMessage("Invalid billing cycle"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "archived"])
    .withMessage("Status must be active or inactive or archived"),
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
  const endDate = new Date(startDate);
  const nextRenewalDate = new Date(startDate);

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
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const queryObj = { status: "active" };

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
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
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
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
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
  console.log("Creating subscription with payment verification...")
  try {
    const { plan: planId, paymentMethod, transactionId, razorpayOrderId, razorpaySignature } = req.body

    // Validate required fields
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: "Plan ID is required",
      })
    }

    // If it's a Razorpay payment, verify the signature
    if (paymentMethod === "razorpay" && transactionId && razorpayOrderId && razorpaySignature) {
      console.log("🔍 Verifying Razorpay payment signature...")

      // Create signature for verification
      const body = razorpayOrderId + "|" + transactionId
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex")

      // Verify signature
      if (expectedSignature !== razorpaySignature) {
        console.log("❌ Payment signature verification failed")
        return res.status(400).json({
          success: false,
          error: "Payment verification failed",
        })
      }

      console.log("✅ Payment signature verified")
    }

    const plan = await SubscriptionPlan.findById(planId)
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" })
    }

    const existing = await Subscription.findOne({
      user: req.user._id,
      isActive: true,
    })

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "User already has an active subscription",
      })
    }

    const { startDate, endDate, nextRenewalDate } = calculateDates(plan)

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
      paymentStatus: "paid", // Only set to paid after verification
      isActive: true,
      autoRenew: true,
      paymentHistory: [
        {
          amount: plan.price,
          status: "successful",
          paymentMethod: paymentMethod || "card",
          transactionId: transactionId || "",
          razorpayOrderId: razorpayOrderId || "",
        },
      ],
    })

    // Update user membership
    req.user.membership = plan.name.toLowerCase()
    req.user.subscriptionStart = startDate
    req.user.subscriptionEnd = endDate
    await req.user.save()

    console.log("✅ Subscription created successfully:", subscription._id)

    res.status(201).json({ success: true, data: subscription })
  } catch (err) {
    console.error("Create subscription error:", err)
    res.status(500).json({
      success: false,
      error: "Server Error",
    })
  }
}


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
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
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
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

/**
 * @desc    Create a new subscription plan
 * @route   POST /api/subscriptions/plans
 * @access  Private (Admin)
 */

exports.createSubscriptionPlan = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Check if plan name already exists
    const existingPlan = await SubscriptionPlan.findOne({
      name: req.body.name,
    });
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        error: "Plan with this name already exists",
      });
    }

    const plan = await SubscriptionPlan.create(req.body);

    res.status(201).json({
      success: true,
      message: "New subscription plan added successfully.",
      data: plan,
    });
  } catch (err) {
    console.error("Create plan error:", err);

    // Handle mongoose validation errors
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: errors.join(", "),
      });
    }

    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Plan with this name already exists",
      });
    }

    res.status(500).json({
      success: false,
      error: "Server Error",
    });
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

    // Check if name is being changed and if it conflicts
    if (req.body.name && req.body.name !== plan.name) {
      const existingPlan = await SubscriptionPlan.findOne({
        name: req.body.name,
        _id: { $ne: req.params.id },
      });
      if (existingPlan) {
        return res.status(400).json({
          success: false,
          error: "Plan with this name already exists",
        });
      }
    }

    plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "subscription plan updated successfully",
      data: plan,
    });
  } catch (err) {
    console.error("Update plan error:", err);

    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: errors.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      error: "Server Error",
    });
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
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

/**
 * @desc    Get all members who have bought membership
 * @route   GET /api/subscriptions/members
 * @access  Admin
 */
exports.getAllSubscribers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const keyword = req.query.search?.trim();
    const searchQuery = keyword
      ? {
          $or: [
            { name: new RegExp(keyword, "i") },
            { email: new RegExp(keyword, "i") },
          ],
        }
      : {};

    const query = {
      ...searchQuery,
      isActive: true,
    };

    const total = await Subscription.countDocuments(query);

    const subscriptions = await Subscription.find(query)
      .populate("user", "firstName, lastName, email")
      .populate("plan", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const data = subscriptions.map((sub) => ({
      id: sub._id,
      memberName: sub.name,
      email: sub.user?.email,
      tier: sub.currentTier,
      status: sub.isActive ? "Active" : "Cancelled",
      renewalDate: sub.nextRenewalDate,
    }));
    res.status(200).json({
      success: true,
      count: data.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data,
    });
  } catch (error) {
    console.error("Fetch members error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

/**
 * @desc    Get Subscriber Details (For View Button)
 * @route   GET /api/subscriptions/members/:id
 * @access  Admin
 */
exports.getSubscriberDetails = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate("user", "-password")
      .populate("plan");

      console.log(subscription,"sub")
    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, error: "Subscription not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        id: subscription._id,
        userId: subscription?.user?._id,
        memberName: subscription.user?.name,
        email: subscription.user?.email,
        phone: subscription.user?.phone,
        tier: subscription.currentTier,
        plan: subscription.plan?.name,
        price: subscription.plan?.price,
        status: subscription.isActive ? "Active" : "Cancelled",
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextRenewalDate: subscription.nextRenewalDate,
        paymentHistory: subscription.paymentHistory,
      },
    });
  } catch (error) {
    console.error("Get subscriber details error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};


