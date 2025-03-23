const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console for dev
  console.error("ERROR DETAILS:", {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack,
    storageErrors: err.storageErrors,
  });

  // Multer errors
  if (err.name === "MulterError") {
    let message = "File upload error";
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = "File is too large";
        break;
      case "LIMIT_FIELD_COUNT":
        message = "Too many fields in form";
        break;
      case "LIMIT_FIELD_KEY":
        message = "Field name too long";
        break;
      case "LIMIT_FIELD_VALUE":
        message = "Field value too long";
        break;
      case "LIMIT_FIELD_SIZE":
        message = "Field size too large";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = `Unexpected field: ${err.field}`;
        break;
      case "LIMIT_PART_COUNT":
        message = "Too many parts in multipart form";
        break;
    }
    error = new Error(message);
    error.statusCode = 400;
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = `Resource not found`;
    error = new Error(message);
    error.statusCode = 404;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = "Duplicate field value entered";
    error = new Error(message);
    error.statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map((val) => val.message);
    error = new Error(message);
    error.statusCode = 400;
  }

  // Express Validator errors (should be caught by validateRequest middleware)
  if (err.array && typeof err.array === "function") {
    const message = err.array().map((error) => error.msg);
    error = new Error(message);
    error.statusCode = 400;
  }

  // Busboy unexpected end of form error
  if (err.message && err.message.includes("Unexpected end of form")) {
    error = new Error(
      "File upload was incomplete or corrupted. Please try again."
    );
    error.statusCode = 400;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || "Server Error",
  });
};

module.exports = errorHandler;
