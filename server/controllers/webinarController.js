const Webinar = require("../models/Webinar");
const ErrorResponse = require("../utils/errorResponse");
const { body, param, validationResult } = require("express-validator");

// Validation middleware
exports.validateWebinar = [
  body("title")
    .notEmpty()
    .withMessage("Please add a webinar title")
    .isLength({ max: 100 })
    .withMessage("Webinar title cannot be more than 100 characters"),
  body("speaker").notEmpty().withMessage("Please add a speaker name"),
  body("date").notEmpty().withMessage("Please select a start date"),
  body("duration")
    .notEmpty()
    .withMessage("Please select webinar duration")
    .isNumeric()
    .withMessage("Duration must be a number"),
  body("startTime").notEmpty().withMessage("Please select a start time"),
  body("maxRegistrations")
    .notEmpty()
    .withMessage("Please select maximum registrations")
    .isInt({ min: 1 })
    .withMessage("Maximum registrations must be at least 1"),
  body("status")
    .optional()
    .isIn(["scheduled", "live", "completed", "cancelled"])
    .withMessage("Invalid status value"),
  body("url").notEmpty().withMessage("Please add a webinar URL"),
  body("thumbnail").notEmpty().withMessage("Please upload a webinar thumbnail"),
  body("description")
    .notEmpty()
    .withMessage("Please add a webinar description"),
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

exports.validateWebinarRating = [
  body("rating")
    .notEmpty()
    .withMessage("Please provide a rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("comment").notEmpty().withMessage("Please provide a comment"),
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

exports.validateWebinarStatus = [
  body("status")
    .notEmpty()
    .withMessage("Please provide a status")
    .isIn(["scheduled", "live", "completed", "cancelled"])
    .withMessage("Invalid status value"),
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

// @desc    Get all webinars
// @route   GET /api/webinars
// @access  Public
exports.getWebinars = async (req, res, next) => {
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
    let query = Webinar.find(JSON.parse(queryStr));

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
      query = query.sort("-date"); // Sort by date descending by default
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Webinar.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const webinars = await query;

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
      count: webinars.length,
      pagination,
      data: webinars,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get upcoming webinars
// @route   GET /api/webinars/upcoming
// @access  Public
exports.getUpcomingWebinars = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Finding upcoming webinars with available slots
    const webinars = await Webinar.find({
      date: { $gte: today },
      status: { $in: ["scheduled"] },
    }).sort("date");

    res.status(200).json({
      success: true,
      count: webinars.length,
      data: webinars,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single webinar
// @route   GET /api/webinars/:id
// @access  Public
exports.getWebinar = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: webinar,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new webinar
// @route   POST /api/webinars
// @access  Private/Admin
exports.createWebinar = async (req, res, next) => {
  try {
    const webinar = await Webinar.create(req.body);

    res.status(201).json({
      success: true,
      data: webinar,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update webinar
// @route   PUT /api/webinars/:id
// @access  Private/Admin
exports.updateWebinar = async (req, res, next) => {
  try {
    let webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    webinar = await Webinar.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: webinar,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete webinar
// @route   DELETE /api/webinars/:id
// @access  Private/Admin
exports.deleteWebinar = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    await webinar.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Register for webinar
// @route   POST /api/webinars/:id/register
// @access  Private
exports.registerForWebinar = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    // Check if webinar is full
    if (webinar.registeredUsers.length >= webinar.maxRegistrations) {
      return next(new ErrorResponse(`Webinar registration is full`, 400));
    }

    // Check if user is already registered
    const alreadyRegistered = webinar.registeredUsers.some(
      (registration) => registration.user.toString() === req.user.id
    );

    if (alreadyRegistered) {
      return next(
        new ErrorResponse(`You are already registered for this webinar`, 400)
      );
    }

    // Add user to registeredUsers array
    webinar.registeredUsers.push({
      user: req.user.id,
      registeredAt: Date.now(),
    });

    await webinar.save();

    res.status(200).json({
      success: true,
      data: webinar,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel registration for webinar
// @route   DELETE /api/webinars/:id/register
// @access  Private
exports.cancelRegistration = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    // Find registration index
    const registrationIndex = webinar.registeredUsers.findIndex(
      (registration) => registration.user.toString() === req.user.id
    );

    if (registrationIndex === -1) {
      return next(
        new ErrorResponse(`You are not registered for this webinar`, 400)
      );
    }

    // Remove registration from array
    webinar.registeredUsers.splice(registrationIndex, 1);
    await webinar.save();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update webinar status
// @route   PUT /api/webinars/:id/status
// @access  Private/Admin
exports.updateWebinarStatus = async (req, res, next) => {
  try {
    let webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    webinar.status = req.body.status;
    await webinar.save();

    res.status(200).json({
      success: true,
      data: webinar,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get registered users for webinar
// @route   GET /api/webinars/:id/registrations
// @access  Private/Admin
exports.getWebinarRegistrations = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id).populate({
      path: "registeredUsers.user",
      select: "firstName lastName email",
    });

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      count: webinar.registeredUsers.length,
      data: webinar.registeredUsers,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add rating to webinar
// @route   POST /api/webinars/:id/ratings
// @access  Private
exports.addWebinarRating = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    // Check if user is registered for the webinar
    const isRegistered = webinar.registeredUsers.some(
      (registration) => registration.user.toString() === req.user.id
    );

    if (!isRegistered) {
      return next(
        new ErrorResponse(
          `You must be registered for the webinar to rate it`,
          400
        )
      );
    }

    // Check if user already rated the webinar
    const existingRating = webinar.ratings.find(
      (rating) => rating.user.toString() === req.user.id
    );

    if (existingRating) {
      return next(
        new ErrorResponse(`You have already rated this webinar`, 400)
      );
    }

    // Add rating to ratings array
    const ratingData = {
      rating: req.body.rating,
      comment: req.body.comment,
      user: req.user.id,
    };

    webinar.ratings.push(ratingData);
    await webinar.save();

    res.status(200).json({
      success: true,
      data: webinar,
    });
  } catch (err) {
    next(err);
  }
};
