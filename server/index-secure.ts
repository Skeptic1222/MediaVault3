import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { securityHeaders, rateLimiter, csrfProtection, sanitizeInput } from "./middleware/security";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger, accessLogger } from "./utils/logger";

const app = express();

// Support deployments under a base path (e.g., /mediavault)
const BASE_PATH = process.env.BASE_PATH || '';
if (BASE_PATH) {
  logger.info(`Base path enabled: ${BASE_PATH}`);
}

// ============= SECURITY MIDDLEWARE =============

// Apply security headers first
app.use(securityHeaders());

// Apply rate limiting globally (can be customized per route)
app.use(rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Stricter rate limiting for authentication endpoints
app.use('/api/auth', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // limit each IP to 5 requests per windowMs
}));

// Strip base path so backend routes and Vite dev work under a prefix
app.use((req: any, _res, next) => {
  if (BASE_PATH && req.url.startsWith(BASE_PATH)) {
    req.url = req.url.slice(BASE_PATH.length) || '/';
    req.originalUrl = (req.originalUrl || '').slice(BASE_PATH.length) || '/';
  }
  next();
});

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput());

// CSRF protection (after body parsing)
app.use(csrfProtection());

// Access logging
app.use(accessLogger());

// Custom request logging with performance metrics
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;

    // Log slow requests
    if (duration > 1000) {
      logger.performance(`Slow request: ${req.method} ${path}`, duration, {
        statusCode: res.statusCode,
        userId: (req as any).user?.claims?.sub
      });
    }

    // API request logging
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && process.env.NODE_ENV === 'development') {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      logger.debug(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Lightweight health endpoint for probes and tests
    app.get('/health', (_req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    });

    // Register application routes
    const server = await registerRoutes(app);

    // 404 handler (must be after all routes)
    app.use(notFoundHandler);

    // Global error handler (must be last)
    app.use(errorHandler);

    // Setup Vite or static serving based on environment
    if (app.get("env") === "development") {
      await setupVite(app, server);
      logger.info("Vite development server configured");
    } else {
      serveStatic(app);
      logger.info("Static file serving configured for production");
    }

    // Server configuration
    const port = parseInt(process.env.PORT || '5000', 10);
    const host = process.env.HOST || '0.0.0.0';

    server.listen({
      port,
      host,
      reusePort: true,
    }, () => {
      logger.info(`MediaVault server started`, {
        port,
        host,
        environment: process.env.NODE_ENV || 'development',
        basePath: BASE_PATH || '/',
        nodeVersion: process.version
      });

      // Log security configuration
      logger.security('SERVER_STARTED', {
        securityHeaders: 'enabled',
        rateLimiting: 'enabled',
        csrfProtection: 'enabled',
        inputSanitization: 'enabled',
        logging: 'enabled'
      });
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      // Give some time to log the error before exiting
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
})();