const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getBlogs,
  getBlog,
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogsByCategory,
  addComment,
  likeBlog,
  createBlogValidation,
  updateBlogValidation,
  commentValidation,
} = require("../controllers/blogController");

const router = express.Router();

// Public routes
router.get("/", getBlogs);
router.get("/category/:category", getBlogsByCategory);
router.get("/:id", getBlog);

// Protected routes
router.use(protect);

// Routes for all authenticated users
router.post("/:id/comments", commentValidation, addComment);
router.put("/:id/like", likeBlog);

// Routes for admins and therapists
router.post(
  "/",
  authorize("admin", "therapist"),
  createBlogValidation,
  createBlog
);

router.put(
  "/:id",
  authorize("admin", "therapist"),
  updateBlogValidation,
  updateBlog
);

router.delete("/:id", authorize("admin", "therapist"), deleteBlog);

module.exports = router;
