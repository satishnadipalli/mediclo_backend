const express = require("express");
const {
  getSubscriptions,
  getMySubscription,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  cancelSubscription,
  renewSubscription,
  getSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  validateSubscription,
  validateSubscriptionPlan,
} = require("../controllers/subscriptionController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.get("/plans", getSubscriptionPlans);
router.get("/plans/:id", getSubscriptionPlan);

// Protected routes
router.use(protect);

// User routes (require authentication)
router.get("/me", getMySubscription);
router.put("/:id/cancel", cancelSubscription);

// Admin only routes
router.get("/", authorize("admin"), getSubscriptions);
router.get("/:id", authorize("admin"), getSubscription);
router.post("/", authorize("admin"), validateSubscription, createSubscription);
router.put(
  "/:id",
  authorize("admin"),
  validateSubscription,
  updateSubscription
);
router.delete("/:id", authorize("admin"), deleteSubscription);
router.put("/:id/renew", authorize("admin"), renewSubscription);
router.post(
  "/plans",
  authorize("admin"),
  validateSubscriptionPlan,
  createSubscriptionPlan
);
router.put(
  "/plans/:id",
  authorize("admin"),
  validateSubscriptionPlan,
  updateSubscriptionPlan
);
router.delete("/plans/:id", authorize("admin"), deleteSubscriptionPlan);

module.exports = router;
