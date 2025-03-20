const ErrorResponse = require("../utils/errorResponse");

// @desc    Upload image to Cloudinary
// @route   POST /api/upload
// @access  Private/Admin/Therapist
exports.uploadBlogImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a file",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
        public_id: req.file.filename, // The public_id is typically the filename in Cloudinary
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload product image
// @route   POST /api/upload/product
// @access  Private/Admin
exports.uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a file",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload category image
// @route   POST /api/upload/category
// @access  Private/Admin
exports.uploadCategoryImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a file",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload course thumbnail
// @route   POST /api/upload/course/thumbnail
// @access  Private/Admin
exports.uploadCourseThumbnail = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a course thumbnail",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload course video
// @route   POST /api/upload/course/video
// @access  Private/Admin
exports.uploadCourseVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a course video",
      });
    }

    // Handle video upload to file storage or cloud storage
    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
        filesize: req.file.size,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload webinar thumbnail
// @route   POST /api/upload/webinar/thumbnail
// @access  Private/Admin
exports.uploadWebinarThumbnail = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a webinar thumbnail",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};
