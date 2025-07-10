const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const controller = require("../controllers/detoxController");

const isAdmin = [protect, authorize("admin")];

//Admin Routes
router.post(
  "/create-detox",
  isAdmin,
  controller.validateDetoxPlan,
  controller.createDetoxPlan
);

router.put("/detox-plan/:id", isAdmin, controller.updateDetoxPlan);
router.delete("/detox-plan/:id", isAdmin, controller.deleteDetoxPlan);
router.get("/detox-plans", isAdmin, controller.getAllDetoxPlansAdmin);
router.get("/detox-plan/:id", isAdmin, controller.getSingleDetoxAdmin);

//Subscribed User routes
router.get("/user/detox-plans", protect, controller.getUserDetoxPlans);
router.get("/user/detox-plan/:id", protect, controller.getSingleUserDetoxPlan);

module.exports = router;
