import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any;
}

// Custom error class for application errors
export class ApplicationError extends Error implements AppError {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: any;

  constructor(message: string, statusCode = 500, isOperational = true, code?: string, details?: any) {
    super(message);
    Object.setPrototypeOf(this, ApplicationError.prototype);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
export class ValidationError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message = 'Authentication required') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND');
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT');
  }
}

export class RateLimitError extends ApplicationError {
  constructor() {
    super('Too many requests', 429, true, 'RATE_LIMIT_EXCEEDED');
  }
}

// Async error wrapper for route handlers
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Main error handling middleware
export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction) {
  // Default to 500 if status code is not set
  err.statusCode = err.statusCode || 500;
  err.isOperational = err.isOperational !== undefined ? err.isOperational : false;

  // Log error
  if (err.statusCode >= 500) {
    logger.error(`Error handling request: ${req.method} ${req.originalUrl}`, {
      error: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      code: err.code,
      details: err.details,
      userId: (req as any).user?.claims?.sub,
      ip: req.ip
    });
  } else {
    logger.warn(`Client error: ${req.method} ${req.originalUrl}`, {
      error: err.message,
      statusCode: err.statusCode,
      code: err.code,
      userId: (req as any).user?.claims?.sub,
      ip: req.ip
    });
  }

  // Security event logging for authentication/authorization errors
  if (err.statusCode === 401 || err.statusCode === 403) {
    logger.security('ACCESS_DENIED', {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      error: err.message,
      userId: (req as any).user?.claims?.sub
    });
  }

  // Prepare error response
  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse: any = {
    error: {
      message: err.isOperational ? err.message : 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
      statusCode: err.statusCode
    }
  };

  // SECURITY: Include additional details ONLY in development mode
  // NEVER send stack traces to clients - they can reveal sensitive implementation details
  if (isDevelopment && process.env.NODE_ENV !== 'production') {
    errorResponse.error.details = err.details;
    // Stack traces are logged server-side, never sent to client
  }

  // Send error response
  res.status(err.statusCode).json(errorResponse);
}

// 404 handler
export function notFoundHandler(req: Request, res: Response) {
  const error = new NotFoundError('Endpoint');
  res.status(error.statusCode).json({
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    }
  });
}

// Validation error formatter for express-validator or zod
export function formatValidationErrors(errors: any[]): ValidationError {
  const formattedErrors = errors.map(error => ({
    field: error.path || error.param,
    message: error.message || error.msg,
    value: error.value
  }));

  return new ValidationError('Validation failed', formattedErrors);
}

// Database error handler
export function handleDatabaseError(error: any): AppError {
  // Handle common database errors
  if (error.code === '23505' || error.code === 'P2002') {
    // Unique constraint violation
    return new ConflictError('A record with this value already exists');
  }

  if (error.code === '23503' || error.code === 'P2003') {
    // Foreign key constraint violation
    return new ValidationError('Referenced record does not exist');
  }

  if (error.code === '22P02' || error.code === 'P2005') {
    // Invalid input syntax
    return new ValidationError('Invalid input format');
  }

  // Default to internal server error
  return new ApplicationError('Database operation failed', 500, false);
}

// File upload error handler
export function handleUploadError(error: any): AppError {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new ValidationError('File size exceeds the maximum allowed size');
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return new ValidationError('Too many files uploaded');
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new ValidationError('Unexpected field in upload');
  }

  return new ApplicationError('File upload failed', 400, true);
}