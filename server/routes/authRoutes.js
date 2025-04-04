const express = require("express");
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
} = require("../controllers/authController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// All auth routes restricted to admin, therapist, and receptionist roles
router.post("/login", loginValidation, login);
router.post(
  "/logout",
  protect,
  authorize("admin", "receptionist", "therapist"),
  logout
);
router.get(
  "/me",
  protect,
  authorize("admin", "receptionist", "therapist"),
  getMe
);
router.put(
  "/update-profile",
  protect,
  authorize("admin", "receptionist", "therapist"),
  updateProfileValidation,
  updateProfile
);
router.put(
  "/change-password",
  protect,
  authorize("admin", "receptionist", "therapist"),
  changePasswordValidation,
  changePassword
);

// Admin-only route for creating staff accounts
router.post(
  "/register-staff",
  protect,
  authorize("admin"),
  registerValidation,
  register
);

module.exports = router;
