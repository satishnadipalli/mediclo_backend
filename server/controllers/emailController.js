const { check, validationResult } = require("express-validator");
const User = require("../models/User");
const Email = require("../models/Email");
const sendEmail = require("../utils/mailer");
// const weeklyMotivation = require("../emails/weeklyMotivation");
const membershipReminder = require("../emails/membershipReminder");

// Validation
exports.motivationEmailValidation = [
  check("subject", "Subject is required").notEmpty(),
  check("content", "Content is required").notEmpty(),
];

// @desc    Send motivational quote to all subscribed users
// @route   POST /api/admin/email/motivation
// @access  Private/Admin
// @desc    Send motivational email to all subscribed users
exports.sendMotivationalQuote = async (req, res, next) => {
  try {
    const { subject, content } = req.body;

    if (!subject || !content) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const now = new Date();
    const subscribedUsers = await User.find({
      subscriptionStart: { $lte: now },
      subscriptionEnd: { $gte: now },
    });

    if (subscribedUsers.length === 0) {
      return res.status(200).json({
        success: false,
        message: "No subscribed users found.",
      });
    }

    // Send to all
    for (const user of subscribedUsers) {
      await sendEmail({
        to: user.email,
        subject,
        html: `<p>${content}</p>`,
      });
      console.log("Email sent:", `<${user.email}>`);
    }

    // Save only once in DB
    await Email.create({
      subject,
      content,
      category: "motivation",
      sentToCount: subscribedUsers.length,
    });

    res.status(200).json({
      success: true,
      message: `Motivational email sent to ${subscribedUsers.length} users.`,
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

// @desc    Send renewal reminder to a specific user
// @route   POST /api/emails/send-renewal/:userId
// @access  Private/Admin
exports.sendRenewalReminder = async (req, res, next) => {
  try {
    console.log("Received request to send renewal reminder.");
    console.log("User ID from request params:", req.params.userId); // <-- Add this
    
    const user = await User.findById(req.params.userId);
    
    console.log("User found by ID:", user); // <-- This is already there, but crucial
    
    if (!user) {
      console.log("Error: User not found for ID:", req.params.userId); // <-- Add this
      return res.status(404).json({
        success: false,
        message: "User not found", // Simplified message for clarity
      });
    }

    console.log("User subscriptionEnd:", user.subscriptionEnd); // <-- Add this
    
    if (!user.subscriptionEnd) {
      console.log("Error: Subscription end date missing for user:", user._id); // <-- Add this
      return res.status(404).json({
        success: false,
        message: "Subscription end date missing", // Simplified message for clarity
      });
    }
    
    // If both checks pass, proceed with email sending
    await sendEmail({
      to: user.email,
      subject: "Your Membership Renewal Reminder",
      html: membershipReminder(
        user.firstName || user.fullName || "User",
        user.subscriptionEnd.toDateString()
      ),
    });
    
    console.log("Email sent:", `<${user.email}>`);
    res.status(200).json({
      success: true,
      message: "Renewal email sent successfully",
    });
  } catch (err) {
    console.error("Error in sendRenewalReminder:", err); // <-- Add this for general errors
    next(err);
  }
};