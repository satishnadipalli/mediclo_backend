const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getGalleryImages,
  getGalleryImage,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  getGalleryStats,
  galleryValidation,
} = require("../controllers/galleryController");

const router = express.Router();

// Public routes
router.get("/", getGalleryImages);
router.get("/:id", getGalleryImage);

// Admin only routes
router.get("/stats/summary", protect, authorize("admin"), getGalleryStats);
router.post(
  "/",
  protect,
  authorize("admin"),
  galleryValidation,
  createGalleryImage
);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  galleryValidation,
  updateGalleryImage
);
router.delete("/:id", protect, authorize("admin"), deleteGalleryImage);

module.exports = router;
