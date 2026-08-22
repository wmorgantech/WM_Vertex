const ApiError = require('../utils/apiError');

function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let { statusCode, message } = err;

  if (err.code === 'P2002') {
    statusCode = 409;
    message = `Duplicate value for field(s): ${err.meta?.target}`;
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  } else if (err.code === 'P2003') {
    statusCode = 409;
    message = 'Related record constraint violation';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 5MB size limit' : err.message;
  }

  if (!statusCode) statusCode = 500;
  if (!message || (statusCode === 500 && !err.isOperational)) {
    message = 'Internal server error';
  }

  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details: err.details || undefined,
  });
}

module.exports = { notFoundHandler, errorHandler };
