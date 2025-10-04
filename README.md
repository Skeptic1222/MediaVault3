# MediaVault

> **Secure Media Management with Google OAuth 2.0 Authentication**

MediaVault is a full-stack TypeScript media management application featuring encryption, streaming, and role-based access control. Built with React, Express.js, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- IIS with Application Request Routing (ARR) module
- Google OAuth 2.0 credentials

### Setup

1. **Clone and install dependencies**
```bash
cd C:\inetpub\wwwroot\MediaVault
npm install
```

2. **Configure environment variables**
```bash
# Copy example and edit .env
cp .env.example .env
```

Required variables:
```env
BASE_PATH=/mediavault
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
SESSION_SECRET=random-secure-string
DATABASE_URL=postgresql://user:password@localhost:5432/mediavault
```

3. **Setup database**
```bash
npm run db:setup
npm run db:push
```

4. **Start development server**
```bash
npm run start:dev
```

5. **Access the application**
- Development: http://localhost/mediavault
- Production: https://ay-i-t.com/mediavault

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[OAUTH_IMPLEMENTATION.md](./docs/OAUTH_IMPLEMENTATION.md)** | ⚠️ **CRITICAL** - Detailed OAuth setup and troubleshooting |
| **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | System architecture and component overview |
| [CLAUDE.md](./CLAUDE.md) | Project instructions for Claude Code |

### Why Read OAUTH_IMPLEMENTATION.md?

The OAuth implementation has **several critical configuration points** that must be exactly right:
- IIS reverse proxy URL rewriting
- Base path stripping middleware
- Route registration patterns
- Session cookie configuration
- User object access patterns

**If OAuth breaks**, this document provides:
- Step-by-step debugging guide
- Common failure modes and fixes
- Quick recovery commands
- Testing procedures

## 🏗️ Architecture Overview

```
User Browser
    ↓
IIS Reverse Proxy (strips /mediavault)
    ↓
Express.js (port 3001)
    ├── Passport.js OAuth
    ├── Session Store (PostgreSQL)
    └── API Routes
        ↓
PostgreSQL Database
File Storage (/uploads, /encrypted_media)
```

**Key Components**:
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript + Passport.js
- **Database**: PostgreSQL (users, sessions, media metadata)
- **Authentication**: Google OAuth 2.0 (session-based)
- **Proxy**: IIS with ARR at `/mediavault` base path

## 🔐 Authentication Flow

1. User clicks "Sign in with Google"
2. Redirected to Google OAuth consent screen
3. Google redirects back with authorization code
4. Server exchanges code for user profile
5. User created/updated in database
6. Session created and stored in PostgreSQL
7. Cookie set, user redirected to dashboard

See [OAUTH_IMPLEMENTATION.md](./docs/OAUTH_IMPLEMENTATION.md) for detailed flow and troubleshooting.

## 📁 Project Structure

```
MediaVault/
├── client/              # React frontend
│   └── src/
│       ├── components/  # UI components
│       ├── pages/       # Page components
│       └── hooks/       # React hooks
├── server/              # Express backend
│   ├── auth.ts         # ⚠️ OAuth configuration
│   ├── routes.ts       # API endpoints
│   ├── storage.ts      # Database operations
│   └── services/       # Business logic
├── docs/               # Documentation
│   ├── OAUTH_IMPLEMENTATION.md  # ⚠️ Critical OAuth guide
│   └── ARCHITECTURE.md          # System architecture
├── dist/               # Production build
└── .env                # ⚠️ Environment config
```

## 🛠️ Development Commands

```bash
# Start development server (with auto-reload)
npm run start:dev

# Build frontend for production
npm run build:client

# Build everything
npm run build

# Type checking
npm run check

# Run E2E tests
npm run test:e2e

# Database operations
npm run db:setup      # Create database
npm run db:push       # Apply schema changes
```

## 🚨 Common Issues

### OAuth redirect goes to localhost instead of Google
**Fix**: See [OAUTH_IMPLEMENTATION.md - Issue 2](./docs/OAUTH_IMPLEMENTATION.md#issue-2-get-httplocalhostvo/oauth2v2auth-404)

### Routes returning 404
**Fix**: See [OAUTH_IMPLEMENTATION.md - Issue 1](./docs/OAUTH_IMPLEMENTATION.md#issue-1-404-page-not-found---did-you-forget-to-add-the-page-to-the-router)

### "Cannot read properties of undefined (reading 'sub')"
**Fix**: See [OAUTH_IMPLEMENTATION.md - Issue 3](./docs/OAUTH_IMPLEMENTATION.md#issue-3-500-internal-server-error---cannot-read-properties-of-undefined-reading-sub)

### Session not persisting
**Fix**: See [OAUTH_IMPLEMENTATION.md - Issue 5](./docs/OAUTH_IMPLEMENTATION.md#issue-5-session-not-persisting-across-requests)

### Logout doesn't work
**Fix**: See [OAUTH_IMPLEMENTATION.md - Issue 4](./docs/OAUTH_IMPLEMENTATION.md#issue-4-logout-doesnt-clear-session)

## 🆘 Quick Recovery

If OAuth breaks:

```bash
# 1. Verify environment
cat .env | grep GOOGLE

# 2. Test server directly
curl -i http://localhost:3001/auth/google | grep Location
# Should see: Location: https://accounts.google.com/...

# 3. Test through IIS
curl -i http://localhost/mediavault/auth/google | grep Location
# Should ALSO see: Location: https://accounts.google.com/...

# 4. Restart server
taskkill //F //PID <pid>
npm run start:dev
```

## 📝 Current Build Version

- **Frontend Bundle**: `index-LKS6g_0V.js`
- **Last Updated**: 2025-10-03
- **OAuth Status**: ✅ Fully functional

---

**⚠️ Important**: Before making changes to authentication, routes, or proxy configuration, **read [OAUTH_IMPLEMENTATION.md](./docs/OAUTH_IMPLEMENTATION.md)** to understand the critical configuration points.
