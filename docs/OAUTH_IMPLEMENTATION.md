# Google OAuth 2.0 Implementation Guide

## Critical Overview

MediaVault uses Google OAuth 2.0 with Passport.js for authentication. The implementation works through an IIS reverse proxy with base path `/mediavault`, which introduces several critical configuration requirements.

## Architecture

```
User Browser
    ↓
IIS (localhost:80) - Reverse Proxy
    ↓ (strips /mediavault from path)
Express Server (localhost:3001)
    ↓
Passport.js Google OAuth Strategy
    ↓
PostgreSQL Session Store
```

## Critical Configuration Points

### 1. Base Path Handling (MOST COMMON FAILURE POINT)

**Problem**: IIS strips `/mediavault` from URLs before they reach Express.

**Solution**: Routes MUST be registered WITHOUT the base path prefix.

```typescript
// ❌ WRONG - Will cause 404 errors
app.get(`${BASE_PATH}/auth/google`, ...)
app.get(`${BASE_PATH}/api/logout`, ...)

// ✅ CORRECT - Base path already stripped by middleware
app.get('/auth/google', ...)
app.get('/api/logout', ...)
```

**Location**: `server/auth.ts` lines 144-194

**How It Works**:
1. User requests: `http://localhost/mediavault/auth/google`
2. IIS forwards to: `http://localhost:3001/mediavault/auth/google`
3. Express middleware strips `/mediavault` → `/auth/google`
4. Route matches: `app.get('/auth/google', ...)`

**Middleware Code** (`server/index-production.ts` lines 22-28):
```typescript
app.use((req: any, _res, next) => {
  if (BASE_PATH && req.url.startsWith(BASE_PATH)) {
    req.url = req.url.slice(BASE_PATH.length) || '/';
    req.originalUrl = (req.originalUrl || '').slice(BASE_PATH.length) || '/';
  }
  next();
});
```

### 2. IIS Redirect Rewriting (CRITICAL)

**Problem**: IIS ARR automatically rewrites `Location` headers in 302 redirects, changing `https://accounts.google.com` to `http://localhost`.

**Symptom**: Browser shows `GET http://localhost/o/oauth2/v2/auth 404`

**Solution**: Outbound rule in `web.config` to restore Google OAuth URLs.

**Location**: `C:\inetpub\wwwroot\web.config` lines 29-43

```xml
<outboundRules>
    <!-- Prevent ARR from rewriting OAuth redirects to external domains -->
    <rule name="Restore OAuth Location Headers" preCondition="IsRedirection">
        <match serverVariable="RESPONSE_Location" pattern="^http://localhost/(.*)" negate="false" />
        <conditions>
            <add input="{RESPONSE_Location}" pattern="^http://localhost/(o/oauth2|auth)" />
        </conditions>
        <action type="Rewrite" value="https://accounts.google.com/{R:1}" />
    </rule>
    <preConditions>
        <preCondition name="IsRedirection">
            <add input="{RESPONSE_STATUS}" pattern="^301|302|307|308$" />
        </preCondition>
    </preConditions>
</outboundRules>
```

**Testing**:
```bash
# Direct to Node (should show Google URL)
curl -i http://localhost:3001/auth/google

# Through IIS (should ALSO show Google URL after fix)
curl -i http://localhost/mediavault/auth/google
```

### 3. User Object Structure (DATA ACCESS PATTERN)

**Problem**: Passport Google OAuth returns user object directly, NOT a JWT with claims.

**Critical Code Pattern**:
```typescript
// ❌ WRONG - Will throw "Cannot read properties of undefined (reading 'sub')"
const userId = req.user.claims.sub;

// ✅ CORRECT - Passport attaches user object directly
const userId = req.user.id;
```

**Location**: All API routes in `server/routes.ts` (20+ occurrences)

**How User Object is Created**:
```typescript
// server/auth.ts lines 91-108
async (_req, _accessToken, _refreshToken, profile: GoogleProfile, done) => {
  const email = profile.emails?.[0]?.value?.toLowerCase() || '';
  const role = email === ADMIN_EMAIL ? 'admin' : 'user';

  const user = await storage.upsertUser({
    id: profile.id,              // ← This becomes req.user.id
    email,
    firstName: profile.name?.givenName || '',
    lastName: profile.name?.familyName || '',
    profileImageUrl: profile.photos?.[0]?.value || '',
    role,
  });

  return done(null, user);
}
```

### 4. Session Configuration

**Critical Settings** (`server/auth.ts` lines 48-61):

```typescript
expressSession({
  secret: process.env.SESSION_SECRET!,
  store: pgStore,  // PostgreSQL session store
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,  // Set to true in production with HTTPS
    sameSite: 'lax',
    maxAge: ttl,
    path: '/',  // MUST be '/' not BASE_PATH
  },
  name: 'mv.sid',  // Cookie name
})
```

**Why `path: '/'` is Critical**:
- Cookie path must match where browser sends requests
- IIS serves at `http://localhost/mediavault/*`
- But session middleware sees paths without `/mediavault`
- Using `BASE_PATH` would prevent cookie from being sent

### 5. Client-Side Logout Implementation

**Problem**: Client must include base path in logout URL.

**Location**: `client/src/components/ui/navbar.tsx` lines 35-38

```typescript
const handleLogout = () => {
  const basePath = import.meta.env.BASE_URL || '/mediavault/';
  window.location.href = `${basePath}api/logout`;  // Not just '/api/logout'
};
```

**Server-Side Logout** (`server/auth.ts` lines 180-194):
```typescript
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
      res.clearCookie('mv.sid', { path: '/' });  // Explicit cookie clearing
      res.redirect(`${BASE_PATH}/`);
    });
  });
});
```

## Environment Variables

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Session Configuration
SESSION_SECRET=<random-secret-key>
SESSION_TTL=604800000  # 7 days in milliseconds

# Base Path
BASE_PATH=/mediavault

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/mediavault

# Environment
NODE_ENV=development
APP_URL=http://localhost  # In production: https://ay-i-t.com
```

## OAuth Flow Diagram

```
1. User clicks "Sign in with Google"
   → Browser: GET http://localhost/mediavault/auth/google

2. IIS forwards to Express
   → Node: GET http://localhost:3001/mediavault/auth/google

3. Middleware strips base path
   → Express sees: GET /auth/google

4. Route matches and Passport redirects
   → Response: 302 Location: https://accounts.google.com/o/oauth2/v2/auth?...

5. IIS outbound rule preserves Google URL (doesn't rewrite to localhost)
   → Browser receives: 302 Location: https://accounts.google.com/o/oauth2/v2/auth?...

6. User authenticates on Google
   → Google redirects: GET http://localhost/mediavault/auth/google/callback?code=...

7. Callback route processes authentication
   → Passport verifies code with Google
   → User record created/updated in database
   → Session created in PostgreSQL
   → Cookie 'mv.sid' set

8. Redirect to home page
   → Response: 302 Location: /mediavault/

9. Home page loads, checks authentication
   → GET /mediavault/api/user (with session cookie)
   → Returns user data if authenticated
```

## Common Failure Modes and Fixes

### Issue 1: "404 Page Not Found - Did you forget to add the page to the router?"

**Cause**: Routes registered with `${BASE_PATH}` prefix, but middleware already stripped it.

**Symptom**: Server logs show `[GET /auth/google]` but route handler not called.

**Fix**: Remove `${BASE_PATH}` from route registration.

**Debug**: Add logging to route handler:
```typescript
app.get('/auth/google', (req, res, next) => {
  console.log('🔵 /auth/google route handler called');
  console.log('🔵 Request URL:', req.url);
  console.log('🔵 Request host:', req.get('host'));
  // ... rest of handler
});
```

### Issue 2: "GET http://localhost/o/oauth2/v2/auth 404"

**Cause**: IIS ARR rewriting OAuth redirect Location header.

**Symptom**: Redirect goes to `localhost` instead of `accounts.google.com`.

**Fix**: Add outbound rule to web.config (see section 2 above).

**Debug**:
```bash
# Test direct to Node
curl -i http://localhost:3001/auth/google
# Should see: Location: https://accounts.google.com/...

# Test through IIS
curl -i http://localhost/mediavault/auth/google
# Should ALSO see: Location: https://accounts.google.com/...
```

### Issue 3: "500 Internal Server Error - Cannot read properties of undefined (reading 'sub')"

**Cause**: Code trying to access `req.user.claims.sub` instead of `req.user.id`.

**Symptom**: User authenticated but API calls fail with 500 error.

**Fix**: Search and replace all `req.user.claims.sub` with `req.user.id`.

**Debug**: Check stack trace for file and line number, look for JWT-style access patterns.

### Issue 4: Logout doesn't clear session

**Cause**:
- Missing `res.clearCookie()` call
- Wrong cookie path (using BASE_PATH instead of '/')
- Session not destroyed

**Fix**: Ensure logout handler calls all three:
```typescript
req.logout()          // Passport logout
req.session.destroy() // Destroy session in store
res.clearCookie()     // Clear browser cookie
```

### Issue 5: Session not persisting across requests

**Cause**:
- Cookie path mismatch
- PostgreSQL connection issue
- Session store not initialized

**Debug**:
```typescript
// Add debug middleware
app.use((req, res, next) => {
  console.log(`[${req.method} ${req.path}] session exists:`, !!req.session);
  console.log('Session ID:', req.session?.id);
  console.log('User:', req.user?.email);
  next();
});
```

**Check**:
1. PostgreSQL `sessions` table has entries
2. Cookie is being sent in requests (check browser DevTools)
3. Cookie path is `/` not `/mediavault`

## Testing Checklist

### Manual Testing
- [ ] Sign in with Google account
- [ ] Redirects to Google OAuth page
- [ ] After authentication, redirects back to MediaVault
- [ ] User is authenticated (can see dashboard)
- [ ] Refresh page - still authenticated
- [ ] Sign out
- [ ] Session cleared (redirected to login)
- [ ] Try accessing protected page - redirected to login

### Direct Server Testing
```bash
# Test OAuth redirect (should see Google URL)
curl -i http://localhost:3001/auth/google

# Test through IIS (should also see Google URL)
curl -i http://localhost/mediavault/auth/google

# Test user endpoint (should return 401 without auth)
curl -i http://localhost:3001/api/user

# Test with session cookie
curl -i -H "Cookie: mv.sid=<session-id>" http://localhost:3001/api/user
```

### Database Verification
```sql
-- Check sessions table
SELECT * FROM sessions;

-- Check users table
SELECT id, email, role FROM users;
```

## Debugging Tips

### Enable Passport Debug Logging
```typescript
// server/auth.ts - Add before passport.use()
passport.serializeUser((user: any, done) => {
  console.log('🔹 Serializing user:', user.id, user.email);
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  console.log('🔹 Deserializing user:', id);
  const user = await storage.getUser(id);
  console.log('🔹 Found user:', user?.email);
  done(null, user || false);
});
```

### Monitor Session Store
```bash
# Watch PostgreSQL logs
# On Windows with PostgreSQL:
Get-Content "C:\Program Files\PostgreSQL\<version>\data\log\*.log" -Tail 50 -Wait
```

### Check IIS Request Tracing
1. Enable Failed Request Tracing in IIS
2. Set rule for status code 302, 404, 500
3. Reproduce issue
4. Check `C:\inetpub\logs\FailedReqLogFiles`

## Admin Role Assignment

**Location**: `server/auth.ts` line 11
```typescript
const ADMIN_EMAIL = 'sop1973@gmail.com';
```

**Applied**: `server/auth.ts` line 99
```typescript
const role = email === ADMIN_EMAIL ? 'admin' : 'user';
```

To add more admins:
```typescript
const ADMIN_EMAILS = ['sop1973@gmail.com', 'another@example.com'];
const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
```

## Production Deployment Changes

When deploying to production (`https://ay-i-t.com/mediavault`):

1. **Update environment variables**:
```env
NODE_ENV=production
APP_URL=https://ay-i-t.com
SECURE_COOKIES=true
```

2. **Update Google OAuth Credentials**:
- Add authorized redirect URI: `https://ay-i-t.com/mediavault/auth/google/callback`
- Keep localhost URI for development

3. **Update web.config X-Forwarded-Proto**:
```xml
<add name="X-Forwarded-Proto" value="https" />
```

4. **Verify session cookie settings**:
```typescript
cookie: {
  httpOnly: true,
  secure: true,  // ← Change to true
  sameSite: 'strict',  // ← Change to strict
  maxAge: ttl,
  path: '/',
}
```

## File Locations Reference

| Component | File | Lines |
|-----------|------|-------|
| OAuth Strategy | `server/auth.ts` | 83-116 |
| Auth Routes | `server/auth.ts` | 144-194 |
| Base Path Middleware | `server/index-production.ts` | 22-28 |
| IIS Outbound Rule | `C:\inetpub\wwwroot\web.config` | 29-43 |
| Client Logout | `client/src/components/ui/navbar.tsx` | 35-38 |
| User Routes | `server/routes.ts` | All `req.user.id` access |
| Session Config | `server/auth.ts` | 15-62 |

## Quick Recovery Commands

If OAuth breaks, run these in order:

```bash
# 1. Check server is running
netstat -ano | findstr :3001

# 2. Test direct OAuth redirect
curl -i http://localhost:3001/auth/google | grep Location

# 3. Test through IIS
curl -i http://localhost/mediavault/auth/google | grep Location

# 4. Check routes are registered
# Server logs should show route registration on startup

# 5. Verify session store
# Check PostgreSQL connection in server logs

# 6. Clear browser cache and cookies
# Ctrl+Shift+Delete → Clear all cookies for localhost

# 7. Check environment variables
cat .env | grep GOOGLE

# 8. Restart server
taskkill //F //PID <pid> && npm run start:dev
```

## Known Working Configuration (Reference)

**Last Verified**: 2025-10-03

- **Server**: Node.js on port 3001
- **Proxy**: IIS on port 80 at `/mediavault`
- **Database**: PostgreSQL with `sessions` table
- **OAuth**: Google OAuth 2.0 via Passport.js
- **Session**: PostgreSQL session store with `mv.sid` cookie
- **Build**: Vite bundle `index-LKS6g_0V.js`

If OAuth stops working, compare current configuration against this document and check each critical configuration point in order.
