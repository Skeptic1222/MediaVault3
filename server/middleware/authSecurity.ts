import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access tokens
const REFRESH_TOKEN_EXPIRY = '7d'; // Longer-lived refresh tokens
const TOKEN_ALGORITHM = 'HS256';

// In production, use Redis or database for token storage
const refreshTokenStore = new Map<string, {
  userId: string;
  expiresAt: number;
  createdAt: number;
  ipAddress: string;
  userAgent: string;
}>();

// Blacklist for revoked tokens (in production, use Redis)
const tokenBlacklist = new Set<string>();

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();

  // Clean refresh tokens
  for (const [token, data] of refreshTokenStore.entries()) {
    if (now > data.expiresAt) {
      refreshTokenStore.delete(token);
    }
  }

  // Clean blacklist (remove tokens that would have expired anyway)
  tokenBlacklist.clear(); // In production, only remove expired tokens
}, 60 * 60 * 1000);

export interface TokenPayload {
  userId: string;
  email?: string;
  role?: string;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
  token?: string;
  refreshToken?: string;
}

// Generate secure random secret if not provided
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  // SECURITY: Require strong JWT secret in production
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET must be set in production environment');
    }
    if (secret.length < 32) {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET must be at least 32 characters in production');
    }
  }

  if (!secret || secret.length < 32) {
    logger.warn('JWT_SECRET is not set or too weak. Using generated secret (not suitable for production)');
    return crypto.randomBytes(64).toString('hex');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');

// Generate access token
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: TOKEN_ALGORITHM as jwt.Algorithm,
    issuer: 'MediaVault',
    audience: 'MediaVault-Client'
  });
}

// Generate refresh token
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

// Store refresh token with metadata
export function storeRefreshToken(
  token: string,
  userId: string,
  req: Request
): void {
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

  refreshTokenStore.set(token, {
    userId,
    expiresAt,
    createdAt: Date.now(),
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown'
  });

  logger.security('REFRESH_TOKEN_CREATED', {
    userId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
}

// Validate refresh token
export function validateRefreshToken(
  token: string,
  req: Request
): { valid: boolean; userId?: string } {
  const tokenData = refreshTokenStore.get(token);

  if (!tokenData) {
    return { valid: false };
  }

  // Check if token is expired
  if (Date.now() > tokenData.expiresAt) {
    refreshTokenStore.delete(token);
    return { valid: false };
  }

  // Optional: Check if IP address matches (can be disabled for mobile apps)
  if (process.env.STRICT_TOKEN_VALIDATION === 'true' && tokenData.ipAddress !== req.ip) {
    logger.security('REFRESH_TOKEN_IP_MISMATCH', {
      storedIp: tokenData.ipAddress,
      currentIp: req.ip,
      userId: tokenData.userId
    });
    // Don't immediately reject, but log for monitoring
  }

  return {
    valid: true,
    userId: tokenData.userId
  };
}

// Revoke refresh token
export function revokeRefreshToken(token: string): void {
  const tokenData = refreshTokenStore.get(token);
  if (tokenData) {
    logger.security('REFRESH_TOKEN_REVOKED', {
      userId: tokenData.userId
    });
    refreshTokenStore.delete(token);
  }
}

// Revoke all refresh tokens for a user
export function revokeAllUserTokens(userId: string): void {
  let revokedCount = 0;
  for (const [token, data] of refreshTokenStore.entries()) {
    if (data.userId === userId) {
      refreshTokenStore.delete(token);
      revokedCount++;
    }
  }

  if (revokedCount > 0) {
    logger.security('ALL_USER_TOKENS_REVOKED', {
      userId,
      tokenCount: revokedCount
    });
  }
}

// Enhanced JWT verification middleware
export function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Extract token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Access token required',
          code: 'NO_TOKEN'
        }
      });
    }

    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      logger.security('BLACKLISTED_TOKEN_USAGE', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(401).json({
        error: {
          message: 'Token has been revoked',
          code: 'TOKEN_REVOKED'
        }
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [TOKEN_ALGORITHM as jwt.Algorithm],
      issuer: 'MediaVault',
      audience: 'MediaVault-Client'
    }) as TokenPayload;

    // Attach user info to request
    req.user = decoded;
    req.token = token;

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          message: 'Access token expired',
          code: 'TOKEN_EXPIRED'
        }
      });
    }

    if (error.name === 'JsonWebTokenError') {
      logger.security('INVALID_TOKEN_ATTEMPT', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        error: error.message
      });

      return res.status(401).json({
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        }
      });
    }

    logger.error('Token verification error', error);
    return res.status(500).json({
      error: {
        message: 'Token verification failed',
        code: 'VERIFICATION_ERROR'
      }
    });
  }
}

// Middleware to refresh access token
export async function refreshAccessToken(req: AuthRequest, res: Response) {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({
        error: {
          message: 'Refresh token required',
          code: 'NO_REFRESH_TOKEN'
        }
      });
    }

    // Validate refresh token
    const validation = validateRefreshToken(refreshToken, req);

    if (!validation.valid || !validation.userId) {
      logger.security('INVALID_REFRESH_TOKEN', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(401).json({
        error: {
          message: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        }
      });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken({
      userId: validation.userId
      // Add other user data as needed from database
    });

    const newRefreshToken = generateRefreshToken();

    // Revoke old refresh token and store new one
    revokeRefreshToken(refreshToken);
    storeRefreshToken(newRefreshToken, validation.userId, req);

    // Send new tokens
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900 // 15 minutes in seconds
    });

    logger.security('TOKENS_REFRESHED', {
      userId: validation.userId,
      ip: req.ip
    });

  } catch (error) {
    logger.error('Token refresh error', error);
    res.status(500).json({
      error: {
        message: 'Failed to refresh token',
        code: 'REFRESH_ERROR'
      }
    });
  }
}

// Logout endpoint handler
export function logout(req: AuthRequest, res: Response) {
  try {
    // Revoke refresh token if provided
    const refreshToken = req.body.refreshToken || req.cookies?.refresh_token;

    if (refreshToken) {
      revokeRefreshToken(refreshToken);
    }

    // Blacklist access token (if still valid)
    if (req.token) {
      tokenBlacklist.add(req.token);
    }

    // Clear cookies if used
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    res.json({
      message: 'Logged out successfully'
    });

    logger.security('USER_LOGOUT', {
      userId: req.user?.userId,
      ip: req.ip
    });

  } catch (error) {
    logger.error('Logout error', error);
    res.status(500).json({
      error: {
        message: 'Logout failed',
        code: 'LOGOUT_ERROR'
      }
    });
  }
}

// Session validation middleware
export function validateSession(req: AuthRequest, res: Response, next: NextFunction) {
  // Additional session validation can be added here
  // For example: check if user is still active, check permissions, etc.

  if (req.user) {
    // Log access for audit trail
    logger.security('API_ACCESS', {
      userId: req.user.userId,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
  }

  next();
}