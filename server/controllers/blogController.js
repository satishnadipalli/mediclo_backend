const Blog = require("../models/Blog");
const { check, validationResult } = require("express-validator");
const { cloudinary } = require("../config/cloudinary");

// Validation rules
exports.createBlogValidation = [
  check("title", "Title is required").notEmpty().isLength({ max: 100 }),
  check("description", "Description cannot be more than 500 characters")
    .optional()
    .isLength({ max: 500 }),
  check("content", "Content is required").notEmpty(),
  check("category", "Category is required").notEmpty(),
  check("tags", "Tags must be an array").optional().isArray(),
  check("isPublished", "isPublished must be a boolean").optional().isBoolean(),
];

exports.updateBlogValidation = [
  check("title", "Title is required")
    .optional()
    .notEmpty()
    .isLength({ max: 100 }),
  check("description", "Description cannot be more than 500 characters")
    .optional()
    .isLength({ max: 500 }),
  check("content", "Content is required").optional().notEmpty(),
  check("category", "Category is required").optional().notEmpty(),
  check("tags", "Tags must be an array").optional().isArray(),
  check("isPublished", "isPublished must be a boolean").optional().isBoolean(),
];

// @desc    Get all blogs
// @route   GET /api/blogs
// @access  Public
exports.getBlogs = async (req, res, next) => {
  try {
    // Add filtering and pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    let query = {};

    // Filter by category if provided
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Filter by tag if provided
    if (req.query.tag) {
      query.tags = req.query.tag;
    }

    // Filter by published status
    if (!req.user || req.user.role !== "admin") {
      query.isPublished = true;
    }

    // Get total count for pagination
    const total = await Blog.countDocuments(query);

    // Execute query with pagination
    const blogs = await Blog.find(query)
      .sort({ publishDate: -1 })
      .skip(startIndex)
      .limit(limit);

    // Pagination result
    const pagination = {
      total,
      pages: Math.ceil(total / limit),
      page,
      limit,
    };

    res.status(200).json({
      success: true,
      count: blogs.length,
      pagination,
      data: blogs,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single blog
// @route   GET /api/blogs/:id
// @access  Public
exports.getBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Blog not found",
      });
    }

    res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create blog
// @route   POST /api/blogs
// @access  Private/Admin
exports.createBlog = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Create the blog with the provided data
    // featuredImage should now be provided as a URL in the request body
    const blog = await Blog.create(req.body);

    res.status(201).json({
      success: true,
      data: blog,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update blog
// @route   PUT /api/blogs/:id
// @access  Private/Admin
exports.updateBlog = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Blog not found",
      });
    }

    blog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete blog
// @route   DELETE /api/blogs/:id
// @access  Private/Admin
exports.deleteBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Blog not found",
      });
    }

    // Delete image from Cloudinary if it exists
    if (
      blog.featuredImage &&
      blog.featuredImage !==
        "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg"
    ) {
      try {
        // Extract public_id from the URL
        const urlParts = blog.featuredImage.split("/");
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split(".")[0];

        if (publicId) {
          await cloudinary.uploader.destroy(`8senses/blogs/${publicId}`);
        }
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
      }
    }

    await blog.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get blogs by category
// @route   GET /api/blogs/category/:category
// @access  Public
exports.getBlogsByCategory = async (req, res, next) => {
  try {
    const validCategories = [
      "Parenting",
      "Child Development",
      "Therapy Tips",
      "Success Stories",
      "News",
      "Other",
    ];

    if (!validCategories.includes(req.params.category)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category specified",
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    const query = {
      category: req.params.category,
      isPublished: true,
    };

    const total = await Blog.countDocuments(query);

    const blogs = await Blog.find(query)
      .sort({ publishDate: -1 })
      .skip(startIndex)
      .limit(limit);

    const pagination = {
      total,
      pages: Math.ceil(total / limit),
      page,
      limit,
    };

    res.status(200).json({
      success: true,
      count: blogs.length,
      pagination,
      data: blogs,
    });
  } catch (err) {
    next(err);
  }
};
