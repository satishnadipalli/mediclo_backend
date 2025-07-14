const cloudinary = require("cloudinary").v2

// Configure Cloudinary (ensure these are loaded from environment variables)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

exports.signUpload = (req, res) => {
  try {
    const { folder, resource_type } = req.body

    if (!folder || !resource_type) {
      return res.status(400).json({ error: "Missing folder or resource_type in request body" })
    }

    const timestamp = Math.round(new Date().getTime() / 1000)
    const params = {
      timestamp: timestamp,
      folder: folder,
      resource_type: resource_type,
    }

    const signature = cloudinary.utils.api_sign_request(params, cloudinary.config().api_secret)

    res.json({
      signature,
      timestamp,
      api_key: cloudinary.config().api_key,
      cloud_name: cloudinary.config().cloud_name,
    })
  } catch (error) {
    console.error("Error generating Cloudinary signature:", error)
    res.status(500).json({ error: "Failed to generate Cloudinary signature" })
  }
}