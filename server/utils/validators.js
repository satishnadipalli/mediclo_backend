const { validationResult } = require("express-validator");

// Function to check validation results in controllers
const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return {
      isValid: false,
      response: res.status(400).json({
        success: false,
        errors: errors.array(),
      }),
    };
  }
  return { isValid: true };
};

module.exports = { checkValidation };
