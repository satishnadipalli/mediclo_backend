const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getCategories,
  getCategoryTree,
  getCategory,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  createCategoryValidation,
  updateCategoryValidation,
  assignProducts,
  assignProductsValidation,
} = require("../controllers/categoryController");

const router = express.Router();

// Public routes
router.get("/", getCategories);
router.get("/tree", getCategoryTree);
router.get("/slug/:slug", getCategoryBySlug);
router.get("/:id", getCategory);

// Protected routes
router.use(protect);
router.use(authorize("admin"));

router.post("/", createCategoryValidation, createCategory);
router.put("/:id", updateCategoryValidation, updateCategory);
router.put("/:id/products", assignProductsValidation, assignProducts);
router.delete("/:id", deleteCategory);

module.exports = router;
