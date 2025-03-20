const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create a function to generate a Multer middleware for different folders
const createCloudinaryStorage = (
  folder,
  fileTypes = ["jpg", "jpeg", "png", "gif"]
) => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `8senses/${folder}`,
      allowed_formats: fileTypes,
      resource_type: "auto",
    },
  });

  return multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  });
};

// Create specific upload middlewares for different purposes
const blogImageUpload = createCloudinaryStorage("blogs");
const profileImageUpload = createCloudinaryStorage("profiles");
const productImageUpload = createCloudinaryStorage("products");
const categoryImageUpload = createCloudinaryStorage("categories");
const resumeUpload = createCloudinaryStorage("resumes", ["pdf", "doc", "docx"]);
const courseThumbnailUpload = createCloudinaryStorage("courses/thumbnails");
const webinarThumbnailUpload = createCloudinaryStorage("webinars/thumbnails");

// Video upload with larger file size limit
const createVideoStorage = (folder) => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `8senses/${folder}`,
      allowed_formats: ["mp4", "mov", "avi", "wmv", "mkv"],
      resource_type: "video",
    },
  });

  return multer({
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit for videos
  });
};

const courseVideoUpload = createVideoStorage("courses/videos");

// Create a middleware wrapper to handle errors for blog images
const uploadMiddleware = (req, res, next) => {
  blogImageUpload.single("featuredImage")(req, res, function (err) {
    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    next();
  });
};

module.exports = {
  cloudinary,
  blogImageUpload,
  profileImageUpload,
  productImageUpload,
  categoryImageUpload,
  resumeUpload,
  courseThumbnailUpload,
  courseVideoUpload,
  webinarThumbnailUpload,
  uploadMiddleware,
};
