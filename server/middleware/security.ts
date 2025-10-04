import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// CSRF token store
const csrfTokenStore = new Map<string, { token: string; expiresAt: number }>();

// Clean up expired data every 5 minutes
setInterval(() => {
  const now = Date.now();

  // Clean rate limit store
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }

  // Clean CSRF tokens
  for (const [key, data] of csrfTokenStore.entries()) {
    if (now > data.expiresAt) {
      csrfTokenStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Rate limiting middleware
export function rateLimiter(options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
} = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, record);
    }

    record.count++;

    if (record.count > max) {
      res.status(429).json({ error: message });
      return;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', (max - record.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    next();
  };
}

// CSRF protection middleware
export function csrfProtection() {
  return (req: Request & { csrfToken?: () => string }, res: Response, next: NextFunction) => {
    // Skip CSRF for safe methods only (GET, HEAD, OPTIONS)
    // API endpoints MUST use CSRF tokens for state-changing operations
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    const sessionId = (req as any).session?.id || req.ip || 'anonymous';

    // Generate token for forms
    req.csrfToken = () => {
      const token = crypto.randomBytes(32).toString('hex');
      csrfTokenStore.set(sessionId, {
        token,
        expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
      });
      return token;
    };

    // Verify token for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const token = req.body._csrf || req.headers['x-csrf-token'];
      const storedData = csrfTokenStore.get(sessionId);

      if (!token || !storedData || storedData.token !== token || Date.now() > storedData.expiresAt) {
        res.status(403).json({ error: 'Invalid CSRF token' });
        return;
      }

      // Token is valid, delete it (one-time use)
      csrfTokenStore.delete(sessionId);
    }

    next();
  };
}

// Security headers middleware
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy
    // Note: 'unsafe-inline' and 'unsafe-eval' are kept for Vite HMR in development
    // TODO: Implement nonce-based CSP for production builds
    const isProduction = process.env.NODE_ENV === 'production';

    const cspDirectives = [
      "default-src 'self'",
      // Scripts: Allow self and inline (for Vite)
      isProduction
        ? "script-src 'self'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: Allow self, inline, and Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Images: Allow self, data URIs, and blob URLs
      "img-src 'self' data: blob: https:",
      // Fonts: Allow self, data URIs, and Google Fonts
      "font-src 'self' data: https://fonts.gstatic.com",
      // Connect: Allow self (for API calls)
      "connect-src 'self' ws: wss:",
      // Media: Allow self and blob URLs
      "media-src 'self' blob:",
      // Objects: Disallow all
      "object-src 'none'",
      // Base URI: Restrict to self
      "base-uri 'self'",
      // Form actions: Restrict to self
      "form-action 'self'",
      // Frame ancestors: Disallow all (prevent clickjacking)
      "frame-ancestors 'none'",
      // Upgrade insecure requests in production
      isProduction ? "upgrade-insecure-requests" : ""
    ].filter(Boolean);

    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

    // Strict Transport Security (only for HTTPS)
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Permissions Policy
    res.setHeader('Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );

    next();
  };
}

// Request sanitization middleware
export function sanitizeInput() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Sanitize common injection patterns
    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        // Remove null bytes
        obj = obj.replace(/\0/g, '');

        // Escape HTML entities
        obj = obj
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
      } else if (Array.isArray(obj)) {
        obj = obj.map(sanitize);
      } else if (obj && typeof obj === 'object') {
        for (const key in obj) {
          obj[key] = sanitize(obj[key]);
        }
      }
      return obj;
    };

    // Sanitize body, query, and params
    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);

    next();
  };
}

// API key authentication for external services
export function apiKeyAuth(validApiKeys: Set<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey || !validApiKeys.has(apiKey)) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    next();
  };
}