import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../logger/logger.js';

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong.';

  // Mongoose-specific niceties.
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with that ${field} already exists.`;
  }

  // Log with full context so a developer can understand exactly what happened:
  // the correlated request, the user, the route, and (for 5xx) the stack trace.
  const log = req.log || logger;
  const context = {
    Method: req.method,
    Path: req.originalUrl,
    StatusCode: statusCode,
    UserId: req.user?._id ? String(req.user._id) : undefined,
    UserEmail: req.user?.email,
  };
  if (statusCode >= 500) {
    log.error('Unhandled error on {Method} {Path}: {ErrorMessage}', {
      ...context,
      ErrorMessage: message,
      err, // → @x stack
    });
  } else {
    // 4xx are expected/operational (validation, auth) — record without a stack.
    log.warn('Request rejected on {Method} {Path} ({StatusCode}): {ErrorMessage}', {
      ...context,
      ErrorMessage: message,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    requestId: req.requestId,
    ...(env.nodeEnv === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}
