const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getProducts,
  getProduct,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getProductsByCategory,
  createProductValidation,
  updateProductValidation,
} = require("../controllers/productController");

const router = express.Router();

// Public routes
router.get("/", getProducts);
router.get("/featured", getFeaturedProducts);
router.get("/category/:categoryId", getProductsByCategory);
router.get("/slug/:slug", getProductBySlug);
router.get("/:id", getProduct);

// Protected routes
router.use(protect);
router.use(authorize("admin"));

router.post("/", createProductValidation, createProduct);
router.put("/:id", updateProductValidation, updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
