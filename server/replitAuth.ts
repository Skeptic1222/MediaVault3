import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const DEV_AUTH = process.env.DEV_AUTH === 'true' || !process.env.REPLIT_DOMAINS;

// SECURITY: DEV_AUTH must NEVER be enabled in production
if (DEV_AUTH && process.env.NODE_ENV === 'production') {
  throw new Error("CRITICAL SECURITY ERROR: DEV_AUTH is enabled in production environment. This bypasses all authentication.");
}

if (!process.env.REPLIT_DOMAINS && !DEV_AUTH) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  // Use SESSION_TTL from environment or default to 1 week
  const sessionTtl = parseInt(process.env.SESSION_TTL || String(7 * 24 * 60 * 60 * 1000));

  // SECURITY: Force secure cookies in production - non-negotiable
  const secureCookie = process.env.NODE_ENV === 'production' ? true :
                      (process.env.SECURE_COOKIES === 'true');

  // Throw error if trying to disable secure cookies in production
  if (process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES === 'false') {
    throw new Error('CRITICAL SECURITY ERROR: Cannot disable secure cookies in production environment.');
  }

  // Validate session secret in production
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production environment');
  }

  // Prefer Postgres-backed sessions when available and not in DEV_AUTH mode
  const usePgStore = !!process.env.DATABASE_URL && !DEV_AUTH;
  let store: any = undefined;
  if (usePgStore) {
    const pgStore = connectPg(session);
    store = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  } else {
    // MemoryStore fallback for local development without DATABASE_URL
    console.warn("Using in-memory session store (development mode). Do not use in production.");
  }

  return session({
    secret: sessionSecret || require('crypto').randomBytes(32).toString('base64'),
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: secureCookie,
      sameSite: secureCookie ? 'strict' : 'lax', // CSRF protection
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  if (DEV_AUTH) {
    // Simple development auth: set a test user in session
    app.use((req: any, _res, next) => {
      // Attach session user to req.user for downstream compatibility
      if (req.session?.user) {
        req.user = req.session.user;
      }
      next();
    });

    app.get('/api/login', async (req: any, res) => {
      const claims = {
        sub: 'dev-user',
        email: 'dev@example.com',
        first_name: 'Dev',
        last_name: 'User',
        profile_image_url: '',
      };
      await upsertUser(claims);
      req.session.user = { claims, expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) };

      // Save session before redirect to ensure cookie is set
      req.session.save((err: any) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).send('Session error');
        }
        const basePath = process.env.BASE_PATH || '';
        return res.redirect(basePath + '/');
      });
    });

    app.get('/api/logout', (req: any, res) => {
      req.session.destroy(() => {
        const basePath = process.env.BASE_PATH || '';
        res.redirect(basePath + '/');
      });
    });

    return; // Skip OIDC setup in dev mode
  }

  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {} as any;
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req: any, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  if (DEV_AUTH) {
    if (req.session?.user?.claims?.sub) {
      // mirror passport behavior
      req.user = req.session.user;
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;
  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
