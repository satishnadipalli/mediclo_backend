const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getBlogs,
  getBlog,
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogsByCategory,
 
  createBlogValidation,
  updateBlogValidation,
  
} = require("../controllers/blogController");

const router = express.Router();

// Public routes - read-only access
router.get("/", getBlogs);
router.get("/category/:category", getBlogsByCategory);
router.get("/:id", getBlog);

// Admin-only routes
router.use(protect, authorize("admin"));

// Routes for admin only
router.post("/", createBlogValidation, createBlog);
router.put("/:id", updateBlogValidation, updateBlog);
router.delete("/:id", deleteBlog);


module.exports = router;
