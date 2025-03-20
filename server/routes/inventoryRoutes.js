const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getInventoryItems,
  getInventoryItem,
  getProductInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getLowStockItems,
  updateStock,
  createInventoryValidation,
  updateInventoryValidation,
  updateStockValidation,
} = require("../controllers/inventoryController");

const router = express.Router();

// All inventory routes are protected
router.use(protect);
router.use(authorize("admin"));

router.get("/", getInventoryItems);
router.get("/low-stock", getLowStockItems);
router.get("/product/:productId", getProductInventory);
router.get("/:id", getInventoryItem);
router.post("/", createInventoryValidation, createInventoryItem);
router.put("/stock", updateStockValidation, updateStock);
router.put("/:id", updateInventoryValidation, updateInventoryItem);
router.delete("/:id", deleteInventoryItem);

module.exports = router;
