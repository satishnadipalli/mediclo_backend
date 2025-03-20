const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getShippingMethods,
  getAllShippingMethods,
  getShippingMethod,
  calculateShippingCost,
  createShippingMethod,
  updateShippingMethod,
  deleteShippingMethod,
  updateShippingStatus,
  createShippingValidation,
  updateShippingValidation,
  updateShippingStatusValidation,
  calculateShippingCostValidation,
} = require("../controllers/shippingController");

const router = express.Router();

// Public routes
router.get("/", getShippingMethods);
router.get("/:id", getShippingMethod);
router.post(
  "/calculate",
  calculateShippingCostValidation,
  calculateShippingCost
);

// Protected routes
router.use(protect);
router.use(authorize("admin"));

router.get("/admin", getAllShippingMethods);
router.post("/", createShippingValidation, createShippingMethod);
router.put("/:id", updateShippingValidation, updateShippingMethod);
router.put("/:id/status", updateShippingStatusValidation, updateShippingStatus);
router.delete("/:id", deleteShippingMethod);

module.exports = router;
