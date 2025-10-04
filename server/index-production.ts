import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes.js";
import { getSession } from "./auth.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Support deployments under a base path (e.g., /mediavault)
const BASE_PATH = process.env.BASE_PATH || '';
if (BASE_PATH) {
  // Using built-in console for initialization logging (before logger is ready)
console.log(`Base path enabled: ${BASE_PATH}`);
}

// Strip base path so backend routes work under a prefix
app.use((req: any, _res, next) => {
  if (BASE_PATH && req.url.startsWith(BASE_PATH)) {
    req.url = req.url.slice(BASE_PATH.length) || '/';
    req.originalUrl = (req.originalUrl || '').slice(BASE_PATH.length) || '/';
  }
  next();
});

// SECURITY: CORS Configuration - Restrict origins in production
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost'];

    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Vault-Token', 'X-Signature'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400 // 24 hours
};

// Trust proxy for secure cookies when behind IIS/ARR
app.set('trust proxy', 1);

// Session middleware (must be before routes)
app.use(getSession());

// Debug middleware to check if session is available
app.use((req: any, res, next) => {
  console.log(`[${req.method} ${req.path}] req.session exists:`, !!req.session);
  next();
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
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
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      // Using built-in console for initialization logging (before logger is ready)
console.log(logLine);
    }
  });

  next();
});

(async () => {
  // Health endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Using built-in console for critical errors (before logger is ready)
console.error(err);
  });

  // Serve static files (built React app)
  if (process.env.NODE_ENV === 'production') {
    // Serve built client files from dist/public
    const clientPath = path.join(__dirname, '../dist/public');
    app.use(express.static(clientPath));

    // Fallback to index.html for client-side routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  } else {
    // In development, serve from client/dist if it exists
    const clientPath = path.join(__dirname, '../client/dist');
    app.use(express.static(clientPath));

    // Fallback to index.html for client-side routing
    app.get('*', (req, res) => {
      const indexPath = path.join(clientPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          res.status(404).json({
            message: 'Client not built. Run "npm run build" first.'
          });
        }
      });
    });
  }

  // Listen on specified port
  const port = parseInt(process.env.PORT || '3000', 10);
  // Bind to 0.0.0.0 to accept connections from both IPv4 and IPv6
  // This fixes IIS ARR 502 errors when proxy tries to connect via 127.0.0.1
  const host = '0.0.0.0';

  server.listen(port, host, () => {
    // Using built-in console for initialization logging (before logger is ready)
console.log(`🚀 MediaVault server running on http://localhost:${port}`);
    // Using built-in console for initialization logging (before logger is ready)
console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    // Using built-in console for initialization logging (before logger is ready)
console.log(`🌐 Host: ${host}`);
  });
})();