const express = require("express");
const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");
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
router.use(protect);
router.use(authorize("admin"));

router.post("/", createServiceValidation, createService);
router.put("/:id", updateServiceValidation, updateService);
router.delete("/:id", deleteService);

module.exports = router;
