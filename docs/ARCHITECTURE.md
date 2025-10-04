# MediaVault Architecture Documentation

## System Overview

MediaVault is a full-stack TypeScript media management application with encryption, streaming, and OAuth authentication. It runs behind an IIS reverse proxy and uses PostgreSQL for data persistence.

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5.4.20
- **Router**: Wouter (lightweight React router)
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui + Tailwind CSS
- **HTTP Client**: Native fetch API with React Query

### Backend
- **Runtime**: Node.js with tsx (TypeScript execution)
- **Framework**: Express.js
- **Language**: TypeScript
- **Session Store**: PostgreSQL via connect-pg-simple
- **Authentication**: Passport.js with Google OAuth 2.0
- **Database**: PostgreSQL (user management, sessions, media metadata)
- **Media Processing**: Sharp (image processing), crypto (encryption)

### Infrastructure
- **Reverse Proxy**: IIS with Application Request Routing (ARR)
- **Base Path**: `/mediavault`
- **Development Server**: Port 3001
- **Production Proxy**: Port 80 (HTTP) / 443 (HTTPS)

## Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│  http://localhost/mediavault/* or https://ay-i-t.com/mediavault/*  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    IIS Reverse Proxy                         │
│  - Strips /mediavault from URLs                             │
│  - Forwards to localhost:3001                               │
│  - Handles OAuth redirect rewriting (outbound rules)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express.js Application                      │
│  Port: 3001                                                 │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Middleware Stack (server/index-production.ts)       │  │
│  │  1. Base path stripping                              │  │
│  │  2. Session middleware (express-session)             │  │
│  │  3. Passport initialization                          │  │
│  │  4. CORS configuration                               │  │
│  │  5. Body parsers                                     │  │
│  │  6. Rate limiting                                    │  │
│  │  7. Security headers                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Route Handlers                                       │  │
│  │  - Auth routes (server/auth.ts)                      │  │
│  │    • /auth/google (OAuth initiation)                 │  │
│  │    • /auth/google/callback (OAuth callback)          │  │
│  │    • /api/logout                                     │  │
│  │    • /api/user                                       │  │
│  │                                                       │  │
│  │  - API routes (server/routes.ts)                     │  │
│  │    • Media management (upload, delete, stream)       │  │
│  │    • Folder management                               │  │
│  │    • User management (admin only)                    │  │
│  │    • Activity logs                                   │  │
│  │    • Vault operations (encrypted storage)            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services                                             │  │
│  │  - mediaService: Media file operations               │  │
│  │  - cryptoService: Encryption/decryption             │  │
│  │  - thumbnailService: Thumbnail generation           │  │
│  │  - streamingHybridMediaService: Video streaming     │  │
│  │  - folderImportService: Bulk import                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│                                                             │
│  Tables:                                                    │
│  - users: User accounts and roles                          │
│  - sessions: Active user sessions (connect-pg-simple)      │
│  - media_files: Media metadata                             │
│  - categories: Media categories                            │
│  - folders: Folder structure                               │
│  - activity_logs: Audit trail                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    File Storage                              │
│                                                             │
│  - /uploads: Unencrypted media files                       │
│  - /encrypted_media: Encrypted vault files                 │
│  - /thumbnails: Generated thumbnails                       │
└─────────────────────────────────────────────────────────────┘
```

## Request Flow Examples

### 1. OAuth Login Flow

```
1. User clicks "Sign in with Google"
   Browser → http://localhost/mediavault/

2. Client executes handleGoogleLogin()
   window.location.href = '/mediavault/auth/google'

3. IIS receives request
   Strips /mediavault → forwards to http://localhost:3001/mediavault/auth/google

4. Express base path middleware
   Strips /mediavault from req.url
   Now: req.url = '/auth/google'

5. Route matches: app.get('/auth/google', ...)
   Passport.authenticate('google') called
   Generates redirect to Google

6. Express responds
   HTTP 302 Location: https://accounts.google.com/o/oauth2/v2/auth?...

7. IIS outbound rule
   Detects OAuth redirect pattern
   Preserves Google URL (doesn't rewrite to localhost)

8. Browser redirects to Google
   User authenticates

9. Google redirects back
   http://localhost/mediavault/auth/google/callback?code=...

10. Passport processes callback
    Exchanges code for user profile
    Creates/updates user in database
    Creates session in PostgreSQL
    Sets session cookie 'mv.sid'

11. Redirect to home
    HTTP 302 Location: /mediavault/

12. Browser loads home page
    Includes cookie: mv.sid=<session-id>
    GET /mediavault/api/user
    Returns authenticated user data
```

### 2. Authenticated API Request Flow

```
1. Browser makes API request
   GET /mediavault/api/media?limit=50
   Cookie: mv.sid=<session-id>

2. IIS forwards
   → http://localhost:3001/mediavault/api/media?limit=50

3. Express middleware chain
   a. Base path stripping: /api/media?limit=50
   b. Session middleware: Loads session from PostgreSQL
   c. Passport: Deserializes user from session
      - Calls storage.getUser(sessionUserId)
      - Attaches user to req.user

4. Route handler
   GET /api/media → isAuthenticated middleware
   - Checks req.user exists
   - If not: 401 Unauthorized
   - If yes: continues to handler

5. Handler executes
   const userId = req.user.id;  // NOT req.user.claims.sub!
   const media = await storage.getMediaFiles(userId, ...);
   res.json(media);

6. Response
   HTTP 200 OK
   Content-Type: application/json
   Body: [{ id: 1, filename: '...', ... }]
```

### 3. Media Upload Flow

```
1. User selects files in gallery
   Client component opens upload modal

2. Files selected
   FormData created with files

3. Upload initiated
   POST /mediavault/api/upload
   Content-Type: multipart/form-data
   Cookie: mv.sid=<session-id>

4. Express receives
   → Multer middleware processes multipart data
   → Files saved to /uploads directory

5. Media processing
   - Generate thumbnail (Sharp)
   - Extract metadata (file size, type, dimensions)
   - Calculate hash for deduplication

6. Database storage
   INSERT INTO media_files (user_id, filename, path, size, ...)
   VALUES (req.user.id, ...)

7. Activity logging
   INSERT INTO activity_logs (user_id, action, details)

8. Response
   HTTP 200 OK
   { success: true, mediaId: 123, ... }

9. Client updates
   React Query invalidates cache
   Gallery re-fetches and displays new media
```

## Database Schema (PostgreSQL)

### users
```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,     -- Google profile ID
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  profile_image_url TEXT,
  role VARCHAR(50) DEFAULT 'user', -- 'user' or 'admin'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### sessions
```sql
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions (expire);
```

### media_files
```sql
CREATE TABLE media_files (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id),
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  path TEXT NOT NULL,
  size BIGINT,
  mime_type VARCHAR(100),
  category_id INTEGER REFERENCES categories(id),
  folder_id INTEGER REFERENCES folders(id),
  is_encrypted BOOLEAN DEFAULT false,
  encryption_key TEXT,
  thumbnail_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### activity_logs
```sql
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Directory Structure

```
MediaVault/
├── client/                    # React frontend source
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   └── ...          # Feature components
│   │   ├── hooks/           # Custom React hooks
│   │   │   └── useAuth.tsx  # Authentication hook
│   │   ├── lib/             # Utilities
│   │   │   └── queryClient.ts
│   │   ├── pages/           # Page components
│   │   │   ├── login.tsx    # OAuth login page
│   │   │   ├── home.tsx
│   │   │   ├── gallery.tsx
│   │   │   └── ...
│   │   └── App.tsx          # Main app component
│   ├── dist/                # Development build output
│   └── vite.config.ts       # Vite configuration
│
├── server/                   # Express backend
│   ├── auth.ts              # OAuth & session config ⚠️ CRITICAL
│   ├── routes.ts            # API endpoints
│   ├── storage.ts           # Database operations
│   ├── index-production.ts  # Server entry point ⚠️ CRITICAL
│   ├── services/
│   │   ├── mediaService.ts
│   │   ├── cryptoService.ts
│   │   ├── thumbnailService.ts
│   │   └── streamingHybridMediaService.ts
│   ├── middleware/
│   │   └── security.ts      # Rate limiting, security headers
│   └── utils/
│       └── logger.ts
│
├── shared/                   # Shared TypeScript types
│   ├── schema.ts            # Zod schemas & types
│   └── constants.ts
│
├── dist/                     # Production build output
│   └── public/              # Static files served by Express
│       ├── index.html       # ⚠️ Bundle reference updated here
│       └── assets/
│
├── docs/                     # Documentation
│   ├── OAUTH_IMPLEMENTATION.md  # ⚠️ OAuth detailed guide
│   └── ARCHITECTURE.md          # This file
│
├── uploads/                  # User uploaded files (unencrypted)
├── encrypted_media/          # Encrypted vault files
├── thumbnails/              # Generated thumbnails
│
├── .env                      # ⚠️ Environment configuration
├── package.json
├── tsconfig.json
├── vite.config.ts           # ⚠️ Base path configuration
└── web.config               # ⚠️ IIS configuration at C:\inetpub\wwwroot\web.config
```

## Critical Configuration Files

### 1. vite.config.ts
```typescript
export default defineConfig({
  base: '/mediavault/',  // ⚠️ MUST match BASE_PATH in .env
  build: {
    outDir: '../dist/public',  // Production output
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',  // Dev proxy
    },
  },
});
```

### 2. .env
```env
# ⚠️ CRITICAL: All values must be set
BASE_PATH=/mediavault
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
SESSION_SECRET=<random-secure-string>
DATABASE_URL=postgresql://user:password@localhost:5432/mediavault
NODE_ENV=development
APP_URL=http://localhost
```

### 3. C:\inetpub\wwwroot\web.config
See OAUTH_IMPLEMENTATION.md for complete configuration.

## Security Considerations

### 1. Authentication
- Google OAuth 2.0 only (no password storage)
- Session-based authentication (not JWT)
- Sessions stored in PostgreSQL (not in-memory)
- HttpOnly session cookies
- CSRF protection via SameSite cookie attribute

### 2. Authorization
- Role-based access control (admin/user)
- Admin email hardcoded in server/auth.ts
- isAuthenticated middleware on all protected routes
- User isolation (users can only access own media)

### 3. File Security
- Vault encryption using AES-256-GCM
- Passphrases hashed before use as encryption keys
- Encrypted files stored separately from normal media
- File uploads validated (size, type)
- Rate limiting on upload endpoints

### 4. Session Security
- Secure cookies in production (HTTPS only)
- Session expiry (7 days default)
- Session regeneration on login
- Session destruction on logout

## Performance Optimizations

### 1. Frontend
- React Query for server state caching
- Optimistic UI updates
- Image lazy loading
- Thumbnail generation for large images
- Bundle splitting (Vite code splitting)

### 2. Backend
- Streaming for large media files
- Thumbnail pre-generation
- Database connection pooling
- Rate limiting to prevent abuse

### 3. Database
- Indexes on frequently queried columns
- Session cleanup (automated by connect-pg-simple)

## Monitoring & Debugging

### Server Logs
- Winston logger in `server/utils/logger.ts`
- Request logging middleware
- Error stack traces in development
- Activity logs in database

### Client Debugging
- React Query DevTools (development only)
- Console logging for auth state changes
- Network tab for API requests

### Database Monitoring
```sql
-- Active sessions
SELECT COUNT(*) FROM sessions WHERE expire > NOW();

-- Recent activity
SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 50;

-- User statistics
SELECT role, COUNT(*) FROM users GROUP BY role;
```

## Deployment Workflow

### Development
```bash
# Terminal 1: Start PostgreSQL
# (Windows service or Docker)

# Terminal 2: Start backend
npm run start:dev

# Terminal 3: Build frontend (when making changes)
npm run build:client
cp -r dist/public/* client/dist/

# Access: http://localhost/mediavault
```

### Production Build
```bash
# 1. Build frontend
npm run build:client

# 2. Copy to production location
cp -r dist/public/* <production-path>/

# 3. Start backend with production env
NODE_ENV=production npm run start
```

### Production Deployment to ay-i-t.com
1. Update environment variables (see OAUTH_IMPLEMENTATION.md)
2. Build frontend with production base URL
3. Update Google OAuth authorized redirect URIs
4. Configure SSL certificate in IIS
5. Update web.config for HTTPS
6. Deploy to production server
7. Run database migrations if needed
8. Monitor logs for issues

## Troubleshooting Guide

### "Cannot connect to database"
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Check firewall allows PostgreSQL port

### "404 on OAuth routes"
- Check BASE_PATH middleware is registered
- Verify routes are NOT prefixed with BASE_PATH
- Check IIS web.config proxy configuration

### "Session not persisting"
- Check sessions table exists in PostgreSQL
- Verify cookie is being set (browser DevTools)
- Check cookie path is '/' not BASE_PATH

### "Build errors"
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run check`
- Verify all dependencies installed

## API Endpoints Reference

### Authentication
- `GET /auth/google` - Initiate OAuth
- `GET /auth/google/callback` - OAuth callback
- `GET /api/logout` - Sign out
- `GET /api/user` - Get current user

### Media Management
- `GET /api/media` - List user's media
- `POST /api/upload` - Upload files
- `DELETE /api/media/:id` - Delete media
- `GET /api/media/:id/stream` - Stream media file
- `GET /api/thumbnail/:id` - Get thumbnail

### Vault Operations (Encrypted Storage)
- `POST /api/vault/upload` - Upload encrypted file
- `GET /api/vault/files` - List vault files
- `POST /api/vault/access` - Request vault access token
- `GET /api/vault/:id/stream` - Stream encrypted file

### Admin Only
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:id/role` - Update user role
- `GET /api/admin/activity` - View activity logs

## Known Issues & Limitations

1. **Font Loading**: 23 Google Fonts loaded (2MB+ render blocking)
   - **Solution**: Reduce to 2-3 font families

2. **Large File Handling**: Files stored as bytea can crash Node
   - **Solution**: Use filesystem storage for files >10MB

3. **No Unit Tests**: Only E2E tests with Playwright
   - **Solution**: Add Jest or Vitest unit tests

4. **Session Cleanup**: No automated cleanup of expired sessions
   - **Solution**: connect-pg-simple handles this automatically

5. **Bundle Size**: 857KB JavaScript bundle
   - **Solution**: Implement code splitting and lazy loading

## Version History

- **Current**: OAuth fully functional, IIS proxy working
- **Last Updated**: 2025-10-03
- **Build Version**: index-LKS6g_0V.js
- **Known Working Configuration**: See OAUTH_IMPLEMENTATION.md
