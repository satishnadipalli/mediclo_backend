const express = require("express");
const { check } = require("express-validator");
const {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  updateUserValidation,
  getUsersByRole,
  activateUser,
  deactivateUser,
  getUserDashboard,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const User = require("../models/User");

const router = express.Router();

// All routes are protected and require admin access
router.use(protect);
router.get("/dashboard", getUserDashboard); //dashboard data for subscribed user
router.use(authorize("admin"));

// GET /api/users - Get all users
router.route("/").get(getUsers);

// GET /api/users/:id - Get single user
// PUT /api/users/:id - Update user
// DELETE /api/users/:id - Delete user
router
  .route("/:id")
  .get(getUser)
  .put(updateUserValidation, validateRequest, updateUser)
  .delete(deleteUser);

// GET /api/users/role/:role - Get all users with a specific role
router.route("/role/:role").get(getUsersByRole);

// PUT /api/users/:id/activate - Activate a user account
router.route("/:id/activate").put(activateUser);

// PUT /api/users/:id/deactivate - Deactivate a user account
router.route("/:id/deactivate").put(deactivateUser);

//Get Recipes

module.exports = router;
