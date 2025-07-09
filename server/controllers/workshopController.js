const Workshop = require("../models/Workshop");
const ErrorResponse = require("../utils/errorResponse");
const { body, validationResult } = require("express-validator");

// ----------------- VALIDATIONS -----------------
exports.validateWorkshop = [
  body("title")
    .notEmpty()
    .withMessage("Workshop title is required")
    .isLength({ max: 100 })
    .withMessage("Title must be less than 100 characters"),

  body("date").notEmpty().withMessage("Date is required"),

  body("startTime").notEmpty().withMessage("startTime is required"),

  body("endTime").notEmpty().withMessage("endTime is required"),

  body("location").notEmpty().withMessage("Location is required"),

  body("description").notEmpty().withMessage("Description is required"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

// ----------------- ADMIN ROUTES -----------------

// @desc    Create a new workshop
// @route   POST /api/workshops
// @access  Private/Admin
exports.createWorkshop = async (req, res, next) => {
  try {
    const workshop = await Workshop.create(req.body);
    res.status(201).json({ success: true, data: workshop });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a workshop
// @route   PUT /api/workshops/:id
// @access  Private/Admin
exports.updateWorkshop = async (req, res, next) => {
  try {
    let workshop = await Workshop.findById(req.params.id);
    if (!workshop) return next(new ErrorResponse("Workshop not found", 404));

    workshop = await Workshop.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: workshop });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a workshop
// @route   DELETE /api/workshops/:id
// @access  Private/Admin
exports.deleteWorkshop = async (req, res, next) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    if (!workshop) return next(new ErrorResponse("Workshop not found", 404));

    await workshop.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all workshops (admin)
// @route   GET /api/workshops/all
// @access  Private/Admin
exports.getAllWorkshops = async (req, res, next) => {
  try {
    const workshops = await Workshop.find().sort("-date");
    res
      .status(200)
      .json({ success: true, count: workshops.length, data: workshops });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single workshop (Admin)
// @route   GET /api/workshops/admin/:id
// @access  Private/Admin
exports.getSingleWorkshopAdmin = async (req, res, next) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    if (!workshop) {
      return res
        .status(404)
        .json({ success: false, message: "Workshop not found" });
    }

    res.status(200).json({ success: true, data: workshop });
  } catch (err) {
    next(err);
  }
};

// ----------------- SUBSCRIBED USERS -----------------

// @desc    Get workshops for subscribed users
// @route   GET /api/workshops
// @access  Private/Subscribed User
exports.getUserWorkshops = async (req, res) => {
  try {
    //Ensure user has a valid membership plan and its still active
    const { membership, subscriptionEnd } = req.user;

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You must be a subscribed member to view workshops",
      });
    }

    if (new Date(subscriptionEnd) < new Date()) {
      return res.status(403).json({
        success: false,
        error:
          "Your subscription has expired. Please renew to access workshops.",
      });
    }

    // Fetch all workshops
    const workshops = await Workshop.find({}).sort({ date: 1 });

    res.status(200).json({
      success: true,
      count: workshops.length,
      data: workshops,
    });
  } catch (error) {
    console.error("Error fetching workshops:", err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get single workshop
// @route   GET /api/workshops/:id
// @access  Private/Subscribed User
exports.getSingleWorkshop = async (req, res) => {
  try {
    //Check for active subscription
    const { membership, subscriptionEnd } = req.user;

    if (!membership || new Date(subscriptionEnd) < new Date()) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only for subscribed users.",
      });
    }

    //Fetch workshop
    const workshop = await Workshop.findById(req.params.id);

    if (!workshop) {
      return res.status(404).json({
        success: false,
        message: "Workshop not found",
      });
    }

    res.status(200).json({
      success: true,
      data: workshop,
    });
  } catch (error) {
    console.error("Error fetching single workshop:", err.message);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// @desc    Register subscribed user for a workshop
// @route   POST /api/workshops/:id/register
// @access  Private/Subscribed User
exports.registerForWorkshop = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const workshopId = req.params.id;

    const workshop = await Workshop.findById(workshopId);
    if (!workshop) {
      return res
        .status(404)
        .json({ success: false, message: "Workshop not found" });
    }

    // Check if user has a valid membership and subscriptionEnd is in the future
    const isSubscribed =
      req.user.membership &&
      req.user.subscriptionEnd &&
      new Date(req.user.subscriptionEnd) > new Date();

    if (!isSubscribed) {
      return res.status(403).json({
        success: false,
        message: "Only subscribed users can register for workshops.",
      });
    }

    // Already registered?
    if (workshop.registeredUsers.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: "You are already registered for this workshop.",
      });
    }

    // Check availability
    if (workshop.currentParticipants >= workshop.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: "This workshop has reached full capacity.",
      });
    }

    // Register the user
    workshop.registeredUsers.push(userId);
    workshop.currentParticipants += 1;
    await workshop.save();

    res.status(200).json({
      success: true,
      message: "Successfully registered for the workshop.",
      data: {
        workshopId: workshop._id,
        title: workshop.title,
        availableSpots: workshop.maxParticipants - workshop.currentParticipants,
      },
    });
  } catch (err) {
    next(err);
  }
};
