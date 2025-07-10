const DetoxPlan = require("../models/DetoxPlan");
const { check, validationResult } = require("express-validator");

// Validation
exports.validateDetoxPlan = [
  check("title", "Title is required").notEmpty(),
  check("description", "Description is required").notEmpty(),
  check("duration", "Duration is required").notEmpty(),
];

// ──────────────── ADMIN CONTROLLERS ────────────────

// @desc    Create detox plan
exports.createDetoxPlan = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { title, description, duration, meals } = req.body;

    const detoxPlan = await DetoxPlan.create({
      title,
      description,
      duration,
      meals,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: detoxPlan });
  } catch (err) {
    next(err);
  }
};

// @desc    Update detox plan
exports.updateDetoxPlan = async (req, res, next) => {
  try {
    const detoxPlan = await DetoxPlan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!detoxPlan)
      return res.status(404).json({ success: false, message: "Not found" });

    res.status(200).json({ success: true, data: detoxPlan });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete detox plan
exports.deleteDetoxPlan = async (req, res, next) => {
  try {
    const detoxPlan = await DetoxPlan.findByIdAndDelete(req.params.id);

    if (!detoxPlan)
      return res.status(404).json({ success: false, message: "Not found" });

    res.status(200).json({ success: true, message: "Detox plan deleted" });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all detox plans (admin)
exports.getAllDetoxPlansAdmin = async (req, res, next) => {
  try {
    const detoxPlans = await DetoxPlan.find().sort({ createdAt: -1 });
    res
      .status(200)
      .json({ success: true, count: detoxPlans.length, data: detoxPlans });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single detox plan (admin)
exports.getSingleDetoxAdmin = async (req, res, next) => {
  try {
    const detoxPlan = await DetoxPlan.findById(req.params.id);
    if (!detoxPlan)
      return res.status(404).json({ success: false, message: "Not found" });

    res.status(200).json({ success: true, data: detoxPlan });
  } catch (err) {
    next(err);
  }
};

// ──────────────── USER CONTROLLERS ────────────────

// @desc    Get detox plans for subscribed users
exports.getUserDetoxPlans = async (req, res, next) => {
  try {
    const user = req.user;
    const now = new Date();

    const isSubscribed =
      user.subscriptionStart &&
      user.subscriptionEnd &&
      user.subscriptionStart <= now &&
      user.subscriptionEnd >= now;

    if (!isSubscribed) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Subscription required.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const total = await DetoxPlan.countDocuments();
    const plans = await DetoxPlan.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: plans.length,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single detox plan by ID (user)
exports.getSingleUserDetoxPlan = async (req, res, next) => {
  try {
    const user = req.user;
    const now = new Date();

    const isSubscribed =
      user.subscriptionStart &&
      user.subscriptionEnd &&
      user.subscriptionStart <= now &&
      user.subscriptionEnd >= now;

    if (!isSubscribed) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Subscription required.",
      });
    }

    const plan = await DetoxPlan.findById(req.params.id);
    if (!plan)
      return res.status(404).json({ success: false, message: "Not found" });

    res.status(200).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
};
