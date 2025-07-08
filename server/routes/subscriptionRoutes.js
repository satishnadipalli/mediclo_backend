const express = require("express");
const {
  getSubscriptionPlans,
  getSubscriptionPlan,
  createSubscription,
  renewSubscription,
  cancelSubscription,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  validateCreatePlan,
  getAllSubscribers,
  getSubscriberDetails,
} = require("../controllers/subscriptionController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

/* PUBLIC ROUTES */
router.get("/plans", getSubscriptionPlans);
router.get("/plans/:id", getSubscriptionPlan);

// USER ROUTES (need login)
router.use(protect);
router.post("/", createSubscription);
router.post("/:id/renew", renewSubscription);
router.post("/:id/cancel", cancelSubscription);

// Protected admin-only routes
router.post(
  "/plans",
  validateCreatePlan,
  authorize("admin"),
  createSubscriptionPlan
);
router.put("/plans/:id", authorize("admin"), updateSubscriptionPlan);
router.delete("/plans/:id", authorize("admin"), deleteSubscriptionPlan);
router.get("/members", authorize("admin"), getAllSubscribers);
router.get("/members/:id", authorize("admin"), getSubscriberDetails);

module.exports = router;
