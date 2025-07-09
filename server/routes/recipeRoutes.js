const express = require("express");
const {
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getAllRecipes,
  getUserRecipes,
  getSingleRecipe,
  validateRecipe,
  getSingleRecipeAdmin,
} = require("../controllers/recipeController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin-only routes (STATIC FIRST)
router.get("/all", protect, authorize("admin"), getAllRecipes);
router.get("/admin/:id", protect, authorize("admin"), getSingleRecipeAdmin);
router.post("/", protect, authorize("admin"), validateRecipe, createRecipe);
router.put("/:id", protect, authorize("admin"), updateRecipe);
router.delete("/:id", protect, authorize("admin"), deleteRecipe);

// Subscribed users
router.get("/", protect, getUserRecipes);
router.get("/:id", protect, getSingleRecipe);

module.exports = router;
