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
