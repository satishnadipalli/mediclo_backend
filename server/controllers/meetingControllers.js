const Meeting = require("../models/Meeting");
// @desc    Get all meetings
// @route   GET /api/meetings
exports.getMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({});
    res.status(200).json({ success: true, data: meetings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get single meeting by ID
// @route   GET /api/meetings/:id
exports.getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }
    res.status(200).json({ success: true, data: meeting });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Create new meeting
// @route   POST /api/meetings
exports.createMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.create(req.body);
    res.status(201).json({ success: true, data: meeting });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(400)
        .json({ success: false, error: "Meeting link already exists" });
    }
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Update meeting by ID
// @route   PUT /api/meetings/:id
exports.updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }
    res.status(200).json({ success: true, data: meeting });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(400)
        .json({ success: false, error: "Meeting link already exists" });
    }
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Delete meeting by ID
// @route   DELETE /api/meetings/:id
exports.deleteMeeting = async (req, res) => {
  try {
    const deletedMeeting = await Meeting.deleteOne({ _id: req.params.id });

    if (deletedMeeting.deletedCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
