// FILE: server/auth.ts
import type { Express, RequestHandler } from 'express';
import expressSession from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth20';
import connectPg from 'connect-pg-simple';
import { Pool } from 'pg';
import { storage } from './storage';
import type { User } from '../shared/schema';

const ADMIN_EMAIL = 'sop1973@gmail.com';
const BASE_PATH = process.env.BASE_PATH || '';
const DEV_AUTH = (process.env.DEV_AUTH || 'false').toLowerCase() === 'true';

export function getSession() {
  const PgStore = connectPg(expressSession);
  const ttl = parseInt(process.env.SESSION_TTL || String(7 * 24 * 60 * 60 * 1000), 10);
  const secure = (process.env.SECURE_COOKIES || 'false').toLowerCase() === 'true';

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Test database connection
  pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err);
  });

  pool.connect((err, client, release) => {
    if (err) {
      console.error('❌ Failed to connect to PostgreSQL:', err);
    } else {
      console.log('✅ PostgreSQL connection successful');
      release();
    }
  });

  const store = new PgStore({
    pool,
    tableName: 'sessions',
    ttl,
    createTableIfMissing: true,
    errorLog: (err: Error) => {
      console.error('❌ PgStore error:', err);
    },
  });

  console.log('🔧 Session store initialized:', store);

  return expressSession({
    secret: process.env.SESSION_SECRET!,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure,            // true in prod (https)
      sameSite: secure ? 'strict' : 'lax',
      maxAge: ttl,
      path: '/', // Always use '/' since base path is stripped before session middleware
    },
    name: 'mv.sid',
  });
}

export function setupAuth(app: Express) {
  // Note: Session middleware and trust proxy should be set up in server/index.ts before calling this function

  // Passport serialization
  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      return done(null, user || false);
    } catch (e) {
      return done(e, false);
    }
  });

  // Google Strategy
  const callbackURL = process.env.NODE_ENV === 'production'
    ? `${process.env.APP_URL || 'https://ay-i-t.com'}${BASE_PATH}/auth/google/callback`
    : `http://localhost${BASE_PATH}/auth/google/callback`;

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL,
        passReqToCallback: true,
      },
      async (_req, _accessToken, _refreshToken, profile: GoogleProfile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase() || '';
          const firstName = profile.name?.givenName || '';
          const lastName = profile.name?.familyName || '';
          const photo = profile.photos?.[0]?.value || '';

          // Role: admin if Shannon
          const role = email === ADMIN_EMAIL ? 'admin' : 'user';

          const user = await storage.upsertUser({
            id: profile.id,
            email,
            firstName,
            lastName,
            profileImageUrl: photo,
            role,
          } as any);

          return done(null, user);
        } catch (err) {
          return done(err as any, undefined);
        }
      }
    )
  );

  // Initialize Passport BEFORE routes
  app.use(passport.initialize());
  app.use(passport.session());

  // DEV_AUTH short-circuit (local only)
  if (DEV_AUTH) {
    app.get(`/api/dev/login`, async (req: any, res) => {
      try {
        // Use a unique dev email that won't conflict with real users
        const devEmail = 'dev-local@mediavault.local';

        // First, try to get existing dev user by ID
        let user = await storage.getUser('dev-local-user');

        // If user doesn't exist, create it
        if (!user) {
          user = await storage.upsertUser({
            id: 'dev-local-user',
            email: devEmail,
            firstName: 'Dev',
            lastName: 'User',
            profileImageUrl: '',
            role: 'user', // Dev user is always a regular user, never admin
          });
        }

        req.login(user, (err: unknown) => {
          if (err) return res.status(500).json({ error: 'Dev login failed' });
          return res.redirect(`${BASE_PATH}/`);
        });
      } catch (err: any) {
        console.error('Dev login error:', err);
        return res.status(500).json({ error: 'Dev login failed' });
      }
    });
  }

  // --- Auth routes ---
  // NOTE: BASE_PATH is stripped by middleware, so routes are registered without it
  // Start OAuth: use prompt=select_account to avoid "Continue as …"
  app.get('/auth/google', (req, res, next) => {
    console.log('🔵 /auth/google route handler called');
    console.log('🔵 Request URL:', req.url);
    console.log('🔵 Request headers host:', req.get('host'));
    console.log('🔵 callbackURL:', callbackURL);

    const authenticator = passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account',
    });

    console.log('🔵 About to call passport.authenticate...');

    authenticator(req, res, (err: any) => {
      console.log('🔵 Passport authenticate callback called');
      if (err) {
        console.error('❌ Passport authentication error:', err);
        return next(err);
      }
      next();
    });
  });

  // Callback
  app.get(
    `/auth/google/callback`,
    passport.authenticate('google', {
      failureRedirect: `${BASE_PATH}/login`,
      session: true,
    }),
    (req, res) => {
      return res.redirect(`${BASE_PATH}/`);
    }
  );

  // Logout
  app.get(`/api/logout`, (req: any, res) => {
    req.logout((err: unknown) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      req.session.destroy((destroyErr: unknown) => {
        if (destroyErr) {
          console.error('Session destroy error:', destroyErr);
        }
        res.clearCookie('mv.sid', { path: '/' });
        res.redirect(`${BASE_PATH}/`);
      });
    });
  });

  // Current user
  app.get(`/api/user`, (req: any, res) => {
    if (!req.user) return res.status(200).json({ authenticated: false });
    const u: User = req.user;
    return res.json({
      authenticated: true,
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: (u as any).role || 'user',
      profileImageUrl: u.profileImageUrl,
      initials:
        (u.firstName?.[0] || '') + (u.lastName?.[0] || ''),
    });
  });
}

// Reusable gate
export const isAuthenticated: RequestHandler = (req: any, res, next) => {
  if (req.user) return next();
  return res.status(401).json({ message: 'Unauthorized' });
};
