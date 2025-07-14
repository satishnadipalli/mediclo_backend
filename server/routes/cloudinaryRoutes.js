const express = require("express")
const router = express.Router()
const cloudinaryController = require("../controllers/cloudinaryController")

// Route to get a signed upload URL for Cloudinary
router.post("/cloudinary-sign-upload", cloudinaryController.signUpload)

module.exports = router
