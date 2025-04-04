const express = require("express");
const {
  getSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  renewSubscription,
  getSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  validateSubscription,
  validateSubscriptionPlan,
  validatePublicSubscription,
  createPublicSubscription,
  checkSubscriptionByEmail,
} = require("../controllers/subscriptionController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.get("/plans", getSubscriptionPlans);
router.get("/plans/:id", getSubscriptionPlan);
router.post("/public", validatePublicSubscription, createPublicSubscription);
router.get("/check/:email", checkSubscriptionByEmail);

// Protected admin-only routes
router.use(protect, authorize("admin"));

// Admin only routes
router.get("/", getSubscriptions);
router.get("/:id", getSubscription);
router.post("/", validateSubscription, createSubscription);
router.put("/:id", validateSubscription, updateSubscription);
router.delete("/:id", deleteSubscription);
router.put("/:id/renew", renewSubscription);
router.post("/plans", validateSubscriptionPlan, createSubscriptionPlan);
router.put("/plans/:id", validateSubscriptionPlan, updateSubscriptionPlan);
router.delete("/plans/:id", deleteSubscriptionPlan);

module.exports = router;
