const User = require("../models/User");
const { check, validationResult } = require("express-validator");
const Recipe = require("../models/Recipe");
const Workshop = require("../models/Workshop");
const Webinar = require("../models/Webinar");
const Email = require("../models/Email");
const DetoxPlan = require("../models/DetoxPlan");

// Validation rules
exports.updateUserValidation = [
  check("email", "Please include a valid email").optional().isEmail(),
  check("firstName", "First name is required").optional().notEmpty(),
  check("lastName", "Last name is required").optional().notEmpty(),
  check("role", "Role must be admin, therapist, parent, or staff")
    .optional()
    .isIn(["admin", "therapist", "parent", "staff"]),
  check("isActive", "isActive must be a boolean").optional().isBoolean(),
];

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};
// @desc    Get users by role
// @route   GET /api/users/role/:role
// @access  Private/Admin
exports.getUsersByRole = async (req, res, next) => {
  try {
    const users = await User.find({ role: req.params.role });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Activate user account
// @route   PUT /api/users/:id/activate
// @access  Private/Admin
exports.activateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Deactivate user account
// @route   PUT /api/users/:id/deactivate
// @access  Private/Admin
exports.deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get personalized dashboard content for user
// @route   GET /api/users/dashboard
// @access  Private
exports.getUserDashboard = async (req, res, next) => {
  try {
    const isSubscribed =
      req.user?.subscriptionEnd &&
      new Date(req.user.subscriptionEnd) > new Date();

    const userData = {
      name: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      membership: req.user.membership || null,
      subscriptionStart: req.user.subscriptionStart || null,
      subscriptionEnd: req.user.subscriptionEnd || null,
    };

    let recipes = [];
    let workshops = [];
    let detoxPlans = [];

    if (isSubscribed) {
      recipes = await Recipe.find().sort({ createdAt: -1 }).limit(4);

      workshops = await Workshop.find().sort({ createdAt: -1 }).limit(4);

      detoxPlans = await DetoxPlan.find().sort({ createdAt: -1 }).limit(4);
    }

    const webinars = await Webinar.find(
      isSubscribed ? {} : { status: "upcoming" }
    )
      .sort({ date: -1 })
      .limit(4);

    // Get latest 3 motivational emails for the user
    const emails = await Email.find({
      userId: req.user._id,
      category: "motivation",
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .select("subject content createdAt");

    res.status(200).json({
      success: true,
      data: {
        isSubscribed,
        user: userData,
        recipes,
        workshops,
        webinars,
        emails,
        detoxPlans,
      },
    });
  } catch (err) {
    next(err);
  }
};
