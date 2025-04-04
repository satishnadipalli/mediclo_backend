const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getProducts,
  getProduct,
  getProductByName,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  getFeaturedProducts,
  getProductsByCategory,
  getLowStockProducts,
  getAllProductsInventory,
  createProductValidation,
  updateProductValidation,
} = require("../controllers/productController");

// Public routes
router.get("/", getProducts);
router.get("/featured", getFeaturedProducts);
router.get("/category/:categoryId", getProductsByCategory);
router.get("/name/:name", getProductByName);
router.get("/:id", getProduct);

// Admin-only protected endpoints
router
  .route("/admin")
  .post(protect, authorize("admin"), createProductValidation, createProduct);

// Inventory management
router.get(
  "/admin/inventory",
  protect,
  authorize("admin"),
  getLowStockProducts
);

router.get(
  "/admin/all-inventory",
  protect,
  authorize("admin"),
  getAllProductsInventory
);

router
  .route("/admin/:id")
  .put(protect, authorize("admin"), updateProductValidation, updateProduct)
  .delete(protect, authorize("admin"), deleteProduct);

// Stock update endpoint
router.put("/admin/:id/stock", protect, authorize("admin"), updateProductStock);

module.exports = router;
