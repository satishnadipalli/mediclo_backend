const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const emailController = require("../controllers/emailController");
const recipeController = require("../controllers/recipeController");
const workshopController = require("../controllers/workshopController");

const isAdmin = [auth.protect, auth.authorize("admin")];

//send motivational email
router.post(
  "/email/motivation",
  isAdmin,
  emailController.motivationEmailValidation,
  emailController.sendMotivationalQuote
);

// create-new-recipe
router.post(
  "/create-recipes",
  isAdmin,
  recipeController.validateRecipe,
  recipeController.createRecipe
);

// create-new-workshop
router.post(
  "/create-workshops",
  isAdmin,
  workshopController.validateWorkshop,
  workshopController.createWorkshop
);

module.exports = router;
