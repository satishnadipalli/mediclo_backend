const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  getServicesByCategory,
  createServiceValidation,
  updateServiceValidation,
} = require("../controllers/serviceController");

const router = express.Router();

// Public routes
router.get("/", getServices);
router.get("/:id", getService);
router.get("/category/:category", getServicesByCategory);

// Protected routes - admin only
router.post(
  "/",
  protect,
  authorize("admin"),
  createServiceValidation,
  createService
);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  updateServiceValidation,
  updateService
);
router.delete("/:id", protect, authorize("admin"), deleteService);

module.exports = router;
