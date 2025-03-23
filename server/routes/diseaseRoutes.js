const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getDiseases,
  getDisease,
  createDisease,
  updateDisease,
  deleteDisease,
  getDiseaseCategories,
  createDiseaseValidation,
  updateDiseaseValidation,
} = require("../controllers/diseaseController");

const router = express.Router();

// Public routes
router.get("/", getDiseases);
router.get("/categories", getDiseaseCategories);
router.get("/:id", getDisease);

// Admin only routes
router.post(
  "/",
  protect,
  authorize("admin"),
  createDiseaseValidation,
  createDisease
);

router.put(
  "/:id",
  protect,
  authorize("admin"),
  updateDiseaseValidation,
  updateDisease
);

router.delete("/:id", protect, authorize("admin"), deleteDisease);

module.exports = router;
