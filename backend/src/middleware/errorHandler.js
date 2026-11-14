function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Database validation failed",
      errors: Object.values(error.errors).map((item) => ({
        field: item.path,
        message: item.message,
      })),
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid identifier or field value",
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A record with this unique value already exists",
    });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  // Do not expose stack traces or internal error details to clients.
  console.error("Request error:", error.message);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
