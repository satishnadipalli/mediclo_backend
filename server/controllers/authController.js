const User = require("../models/User");
const { generateToken } = require("../config/jwt");
const { body, check, validationResult } = require("express-validator");

// Validation rules
exports.registerValidation = [
  body("email", "Please include a valid email").isEmail(),
  body("password", "Password must be at least 6 characters").isLength({
    min: 6,
  }),
  body("firstName", "First name is required").notEmpty(),
  body("lastName", "Last name is required").notEmpty(),
  body(
    "role",
    "Role must be admin, therapist, receptionist, staff, parent or member"
  )
    .optional()
    .isIn(["admin", "therapist", "staff", "receptionist", "parent", "member"])
    .withMessage(
      "Invalid role specified - role must be admin, therapist, staff, receptionist, parent or member"
    ),
];

exports.loginValidation = [
  check("email", "Please include a valid email").isEmail(),
  check("password", "Password is required").exists(),
];

exports.updateProfileValidation = [
  check("email", "Please include a valid email").optional().isEmail(),
  check("firstName", "First name is required").optional().notEmpty(),
  check("lastName", "Last name is required").optional().notEmpty(),
  check("phone", "Phone number is not valid").optional().isMobilePhone(),
];

exports.changePasswordValidation = [
  check("currentPassword", "Current password is required").notEmpty(),
  check("newPassword", "New password must be at least 6 characters").isLength({
    min: 6,
  }),
];

// @desc    Register user
// @route   POST /api/auth/register
// @access  Admin only
exports.register = async (req, res, next) => {
  console.log("Request Body:", req.body);
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, password, firstName, lastName, role, phone } = req.body;

    //Find existing user
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: "Email already in use",
      });
    }

    // Determine role
    let userRole = "parent"; // default for public signups

    // If role is specified and valid, use that role
    if (
      role &&
      [
        "admin",
        "therapist",
        "staff",
        "receptionist",
        "parent",
        "member",
      ].includes(role)
    ) {
      userRole = role;
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: userRole,
      phone,
    });

    // Create token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        membership: user.membership,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Staff only
exports.login = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // // Verify user has appropriate role
    // if (!["admin", "therapist", "receptionist", "staff"].includes(user.role)) {
    //   return res.status(403).json({
    //     success: false,
    //     error: "Unauthorized access. Only staff members can login.",
    //   });
    // }

    // // Check if password matches
    // const isMatch = await user.matchPassword(password);

    // if (!isMatch) {
    //   return res.status(401).json({
    //     success: false,
    //     error: "Invalid credentials",
    //   });
    // }

    // Create token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        membership: user.membership,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const fieldsToUpdate = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
    };

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};
