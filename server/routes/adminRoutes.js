const express = require("express");
const router = express.Router();

const sendMotivationalQuote = require("../controllers/emailControllers");
const {
  createRecipe,
  createRecipeValidation,
} = require("../controllers/recipeController");

const {
  createWorkshop,
  createWorkshopValidation,
} = require("../controllers/workshopController");

router.post("/email/motivation", sendMotivationalQuote);
router.post("/recipes", isAdmin, createRecipeValidation, createRecipe);
router.post("/workshops", isAdmin, createWorkshopValidation, createWorkshop);
