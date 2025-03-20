const Feedback = require("../models/Feedback");
const Course = require("../models/Course");
const Webinar = require("../models/Webinar");
const ErrorResponse = require("../utils/errorResponse");
const { body, param, validationResult } = require("express-validator");

// Validation middleware
exports.validateFeedback = [
  body("itemType")
    .notEmpty()
    .withMessage("Please select item type")
    .isIn(["course", "webinar"])
    .withMessage("Invalid item type"),
  body("itemId").notEmpty().withMessage("Please select a course or webinar"),
  body("rating")
    .notEmpty()
    .withMessage("Please provide a rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("comment").notEmpty().withMessage("Please provide feedback comments"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];

// @desc    Get all feedback
// @route   GET /api/feedback
// @access  Private/Admin
exports.getAllFeedback = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit"];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Finding resource
    let query = Feedback.find(JSON.parse(queryStr)).populate({
      path: "user",
      select: "firstName lastName email",
    });

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Feedback.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const feedback = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: feedback.length,
      pagination,
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get my feedback
// @route   GET /api/feedback/me
// @access  Private
exports.getMyFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.find({ user: req.user.id });

    res.status(200).json({
      success: true,
      count: feedback.length,
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single feedback
// @route   GET /api/feedback/:id
// @access  Private/Admin
exports.getFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id).populate({
      path: "user",
      select: "firstName lastName email",
    });

    if (!feedback) {
      return next(
        new ErrorResponse(`Feedback not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new feedback
// @route   POST /api/feedback
// @access  Private
exports.createFeedback = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.user = req.user.id;
    req.body.username = `${req.user.firstName} ${req.user.lastName}`;

    // Check if item exists
    let itemModel;
    if (req.body.itemType === "course") {
      itemModel = Course;
    } else if (req.body.itemType === "webinar") {
      itemModel = Webinar;
    } else {
      return next(new ErrorResponse(`Invalid item type`, 400));
    }

    const item = await itemModel.findById(req.body.itemId);
    if (!item) {
      return next(
        new ErrorResponse(
          `${
            req.body.itemType.charAt(0).toUpperCase() +
            req.body.itemType.slice(1)
          } not found with id of ${req.body.itemId}`,
          404
        )
      );
    }

    // Check if user has already submitted feedback for this item
    const existingFeedback = await Feedback.findOne({
      user: req.user.id,
      itemId: req.body.itemId,
    });

    if (existingFeedback) {
      return next(
        new ErrorResponse(
          `You have already submitted feedback for this ${req.body.itemType}`,
          400
        )
      );
    }

    const feedback = await Feedback.create(req.body);

    // Add rating to item's ratings array also
    item.ratings.push({
      rating: req.body.rating,
      comment: req.body.comment,
      user: req.user.id,
    });
    await item.save();

    res.status(201).json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update feedback
// @route   PUT /api/feedback/:id
// @access  Private
exports.updateFeedback = async (req, res, next) => {
  try {
    let feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return next(
        new ErrorResponse(`Feedback not found with id of ${req.params.id}`, 404)
      );
    }

    // Make sure user is feedback owner or admin
    if (feedback.user.toString() !== req.user.id && req.user.role !== "admin") {
      return next(
        new ErrorResponse(
          `User ${req.user.id} is not authorized to update this feedback`,
          401
        )
      );
    }

    feedback = await Feedback.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Update the rating in the item's ratings array as well
    let itemModel;
    if (feedback.itemType === "course") {
      itemModel = Course;
    } else if (feedback.itemType === "webinar") {
      itemModel = Webinar;
    }

    const item = await itemModel.findById(feedback.itemId);
    if (item) {
      const ratingIndex = item.ratings.findIndex(
        (rating) => rating.user.toString() === req.user.id
      );
      if (ratingIndex !== -1) {
        item.ratings[ratingIndex].rating = req.body.rating;
        item.ratings[ratingIndex].comment = req.body.comment;
        await item.save();
      }
    }

    res.status(200).json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete feedback
// @route   DELETE /api/feedback/:id
// @access  Private
exports.deleteFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return next(
        new ErrorResponse(`Feedback not found with id of ${req.params.id}`, 404)
      );
    }

    // Make sure user is feedback owner or admin
    if (feedback.user.toString() !== req.user.id && req.user.role !== "admin") {
      return next(
        new ErrorResponse(
          `User ${req.user.id} is not authorized to delete this feedback`,
          401
        )
      );
    }

    // Remove the rating from the item's ratings array as well
    let itemModel;
    if (feedback.itemType === "course") {
      itemModel = Course;
    } else if (feedback.itemType === "webinar") {
      itemModel = Webinar;
    }

    const item = await itemModel.findById(feedback.itemId);
    if (item) {
      const ratingIndex = item.ratings.findIndex(
        (rating) => rating.user.toString() === feedback.user.toString()
      );
      if (ratingIndex !== -1) {
        item.ratings.splice(ratingIndex, 1);
        await item.save();
      }
    }

    await feedback.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get feedback for a specific item
// @route   GET /api/feedback/item/:itemType/:itemId
// @access  Public
exports.getItemFeedback = async (req, res, next) => {
  try {
    const { itemType, itemId } = req.params;

    // Validate item type
    if (!["course", "webinar"].includes(itemType)) {
      return next(new ErrorResponse(`Invalid item type`, 400));
    }

    // Check if item exists
    let itemModel;
    if (itemType === "course") {
      itemModel = Course;
    } else if (itemType === "webinar") {
      itemModel = Webinar;
    }

    const item = await itemModel.findById(itemId);
    if (!item) {
      return next(
        new ErrorResponse(
          `${
            itemType.charAt(0).toUpperCase() + itemType.slice(1)
          } not found with id of ${itemId}`,
          404
        )
      );
    }

    // Get all published feedback for this item
    const feedback = await Feedback.find({
      itemType,
      itemId,
      isPublished: true,
    }).populate({
      path: "user",
      select: "firstName lastName",
    });

    res.status(200).json({
      success: true,
      count: feedback.length,
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle feedback publication status
// @route   PUT /api/feedback/:id/publish
// @access  Private/Admin
exports.togglePublishStatus = async (req, res, next) => {
  try {
    let feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return next(
        new ErrorResponse(`Feedback not found with id of ${req.params.id}`, 404)
      );
    }

    feedback.isPublished = !feedback.isPublished;
    await feedback.save();

    res.status(200).json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
};
