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
const { validateRequest } = require("../middleware/validationMiddleware");

const router = express.Router();

// ✅ Public routes (no auth required)
router.post("/register", registerValidation, validateRequest, register);
router.post("/login", loginValidation, validateRequest, login);

// ✅ Authenticated routes (any logged-in user: parent, member, staff, admin)
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);

router.put(
  "/update-profile",
  protect,
  updateProfileValidation,
  validateRequest,
  updateProfile
);
router.put(
  "/change-password",
  protect,
  changePasswordValidation,
  validateRequest,
  changePassword
);

// Admin-only route for creating staff accounts
router.post(
  "/register-staff",
  protect,
  authorize("admin"),
  registerValidation,
  validateRequest,
  register
);

module.exports = router;
