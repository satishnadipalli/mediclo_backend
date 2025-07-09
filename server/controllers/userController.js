const User = require("../models/User");
const { check, validationResult } = require("express-validator");

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

    let dashboardData = {
      isSubscribed,
      user: {
        name: req.user.fullName,
        email: req.user.email,
        role: req.user.role,
        membership: req.user.membership,
      },
    };

    if (isSubscribed) {
      const [recipes, workshops, webinars] = await Promise.all([
        require("../models/Recipe").find().sort("-createdAt"),
        require("../models/Workshop").find().sort("-createdAt"),
        require("../models/Webinar").find().sort("-date"),
      ]);

      dashboardData.recipes = recipes;
      dashboardData.workshops = workshops;
      dashboardData.webinars = webinars;
    } else {
      const webinars = await require("../models/Webinar")
        .find({
          status: "upcoming",
          date: { $gte: new Date() },
        })
        .sort("date");

      dashboardData.webinars = webinars;
    }

    res.status(200).json({ success: true, data: dashboardData });
  } catch (err) {
    next(err);
  }
};
