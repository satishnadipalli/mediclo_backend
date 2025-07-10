const { check, validationResult } = require("express-validator");
const User = require("../models/User");
const Email = require("../models/Email");
const sendEmail = require("../utils/mailer");
const weeklyMotivation = require("../emails/weeklyMotivation");

// Validation
exports.motivationEmailValidation = [
  check("subject", "Subject is required").notEmpty(),
  check("content", "Content is required").notEmpty(),
];

// @desc    Send motivational quote to all subscribed users
// @route   POST /api/admin/email/motivation
// @access  Private/Admin
exports.sendMotivationalQuote = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { subject, content } = req.body;
    const now = new Date();

    const users = await User.find({
      isActive: true,
      subscriptionStart: { $lte: now },
      subscriptionEnd: { $gte: now },
      email: { $ne: null },
    });

    let count = 0;

    for (const user of users) {
      const html = weeklyMotivation(user.firstName, content);

      await sendEmail({ to: user.email, subject, html });

      await Email.create({
        userId: user._id,
        subject,
        content,
        category: "motivation",
      });

      count++;
    }

    res.status(200).json({
      success: true,
      message: `Motivational email sent to ${count} users.`,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all motivational emails for a user
// @route   GET /api/emails
// @access  Private/Subscribed User
exports.getAllEmails = async (req, res, next) => {
  try {
    const user = req.user;

    const now = new Date();
    const isSubscribed =
      user.subscriptionStart &&
      user.subscriptionEnd &&
      user.subscriptionStart <= now &&
      user.subscriptionEnd >= now;

    if (!isSubscribed) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only for subscribed users.",
      });
    }

    const emails = await Email.find({ userId: user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: emails,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single motivational email by ID
// @route   GET /api/emails/:id
// @access  Private/Subscribed User
exports.getSingleEmail = async (req, res, next) => {
  try {
    const email = await Email.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!email) {
      return res.status(404).json({
        success: false,
        message: "Email not found",
      });
    }

    res.status(200).json({
      success: true,
      data: email,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get latest 3 motivational emails for a user
// @route   GET /api/emails/recent
// @access  Private/Subscribed User
exports.getRecentEmails = async (req, res, next) => {
  try {
    const user = req.user;

    // Only allow subscribed users
    const now = new Date();
    const isSubscribed =
      user.subscriptionStart &&
      user.subscriptionEnd &&
      user.subscriptionStart <= now &&
      user.subscriptionEnd >= now;

    if (!isSubscribed) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only for subscribed users.",
      });
    }

    const emails = await Email.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(3);

    res.status(200).json({
      success: true,
      data: emails,
    });
  } catch (err) {
    next(err);
  }
};
