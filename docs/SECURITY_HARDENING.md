# MediaVault Security Hardening Guide

> **Complete guide for securing MediaVault before production deployment**

## 🚨 Critical Security Checklist

Before deploying to production, **ALL** items below must be completed:

- [ ] Authentication enabled (AUTH_DISABLED=false)
- [ ] Secure cookies enabled (SECURE_COOKIES=true)
- [ ] All security keys regenerated
- [ ] File upload validation implemented
- [ ] HTTPS configured with valid SSL certificate
- [ ] Database credentials secured
- [ ] Rate limiting configured
- [ ] Content Security Policy enabled

---

## Sprint 1: Security Hardening Implementation

### Step 1: Generate Secure Credentials

**Run the credential generator:**
```bash
node scripts/generate-credentials.js
```

This generates:
- `SESSION_SECRET` - 32-byte base64 session encryption key
- `FILESYSTEM_MASTER_KEY` - 32-byte hex encryption key
- `JWT_SECRET` - 32-byte base64 JWT signing secret
- `DB_PASSWORD` - 24-byte secure database password

**Copy the output to your `.env` file**

### Step 2: Fix Authentication Configuration

**Edit `.env` file:**
```env
# CRITICAL: Ensure these are set to false
AUTH_DISABLED=false
SKIP_AUTH=false
NO_AUTH=false

# Enable OAuth
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-actual-secret
```

### Step 3: Enable Secure Cookies (Production Only)

**For HTTPS/Production:**
```env
SECURE_COOKIES=true
NODE_ENV=production
APP_URL=https://ay-i-t.com
```

**For Local Development (HTTP):**
```env
SECURE_COOKIES=false
NODE_ENV=development
APP_URL=http://localhost
```

⚠️ **WARNING**: Never set `SECURE_COOKIES=true` with HTTP - sessions will fail

### Step 4: Configure File Upload Validation

The enhanced validation is now active. It includes:
- ✅ MIME type validation
- ✅ File signature (magic number) verification
- ✅ Extension matching
- ✅ File size limits
- ✅ Filename sanitization

**Allowed file types:**
- Images: JPEG, PNG, GIF, WebP, BMP, ICO, SVG
- Videos: MP4, WebM, MOV, AVI, MKV
- Audio: MP3, M4A, OGG, WAV, FLAC, AAC
- Documents: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV, MD
- Archives: ZIP, RAR, 7Z, TAR, GZ

**Test file validation:**
```bash
# Upload a file and check server logs
# Should see: "File type validated: image/jpeg"
```

---

## Additional Security Measures

### Windows Credential Store (Recommended)

Instead of storing secrets in `.env`, use Windows Credential Manager:

**1. Enable in `.env`:**
```env
USE_WINDOWS_CREDENTIAL_STORE=true
CREDENTIAL_TARGET=MediaVault_Production
```

**2. Store credentials:**
```powershell
# Run the setup script
npm run security:setup

# Or manually:
cmdkey /generic:MediaVault_Production_SESSION_SECRET /user:MediaVault /pass:"your-session-secret"
cmdkey /generic:MediaVault_Production_DB_PASSWORD /user:MediaVault /pass:"your-db-password"
```

**3. Update server code to read from credential store** (see implementation in `server/config/credentials.ts`)

### Content Security Policy

**Enable CSP in `.env`:**
```env
CSP_ENABLED=true
CSP_REPORT_URI=/api/csp-report
```

**CSP Headers Applied:**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://accounts.google.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  media-src 'self' blob:;
  connect-src 'self' https://accounts.google.com;
  frame-ancestors 'none';
```

### Rate Limiting

**Configure in `.env`:**
```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100   # 100 requests per window
```

**Applied to:**
- All `/api/*` routes
- Upload endpoints (stricter: 10 requests/15min)
- Authentication endpoints

### HTTPS Configuration

**1. Obtain SSL Certificate:**
```powershell
# Using Let's Encrypt with Certbot
certbot certonly --webroot -w C:\inetpub\wwwroot -d ay-i-t.com
```

**2. Configure IIS:**
- Open IIS Manager
- Select your site
- Bindings → Add HTTPS (port 443)
- Select SSL certificate
- Enable "Require SSL"

**3. Update `web.config`:**
```xml
<rule name="HTTPS Redirect" stopProcessing="true">
  <match url="(.*)" />
  <conditions>
    <add input="{HTTPS}" pattern="off" />
  </conditions>
  <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
</rule>
```

---

## Security Validation

### Run Security Audit

```bash
# Check for security vulnerabilities
npm audit

# Fix automatically
npm audit fix

# Check TypeScript types
npm run check

# Run E2E tests
npm run test:e2e
```

### Manual Security Checklist

**Authentication:**
- [ ] Can access `/api/user` only when authenticated
- [ ] OAuth redirect goes to Google (not localhost)
- [ ] Logout clears session completely
- [ ] Session persists across page refreshes
- [ ] Session expires after configured TTL

**File Upload:**
- [ ] Cannot upload executable files (.exe, .sh, .bat)
- [ ] File extension must match MIME type
- [ ] File signature validated (magic numbers)
- [ ] Files sanitized (no path traversal)
- [ ] Upload size limits enforced

**Session Security:**
- [ ] Cookies marked `HttpOnly`
- [ ] Cookies marked `Secure` (production)
- [ ] `SameSite=strict` (production) or `lax` (dev)
- [ ] Session stored in PostgreSQL (not memory)
- [ ] Sessions expire and cleanup automatically

**Encryption:**
- [ ] Vault files encrypted with AES-256-GCM
- [ ] Passphrases properly hashed
- [ ] Encryption keys not in URLs
- [ ] Vault tokens expire after use
- [ ] Encrypted content not cached

---

## Security Monitoring

### Enable Logging

```env
LOG_LEVEL=info  # Or 'debug' for troubleshooting
```

**Log types:**
- `security` - Authentication, authorization events
- `access` - File access, vault unlocks
- `error` - Errors and exceptions
- `audit` - User actions, admin operations

### Error Tracking (Optional)

**Sentry Integration:**
```env
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

**Application Insights:**
```env
APPINSIGHTS_INSTRUMENTATIONKEY=your-key-here
```

### Activity Monitoring

**Query recent activity:**
```sql
-- Last 100 activities
SELECT * FROM activity_logs
ORDER BY created_at DESC
LIMIT 100;

-- Failed login attempts
SELECT * FROM activity_logs
WHERE action = 'LOGIN_FAILED'
AND created_at > NOW() - INTERVAL '1 hour';

-- Suspicious file uploads
SELECT * FROM activity_logs
WHERE action = 'UPLOAD_REJECTED'
ORDER BY created_at DESC;
```

---

## Production Deployment Steps

### 1. Pre-Deployment

```bash
# Generate credentials
node scripts/generate-credentials.js

# Update .env with generated values
cp .env.example .env
# Edit .env with your values

# Verify security configuration
npm run security:validate

# Run all tests
npm run check
npm run test:e2e
```

### 2. Database Setup

```bash
# Create production database
npm run db:setup

# Apply schema
npm run db:push

# Verify connection
psql -d mediavault -c "SELECT COUNT(*) FROM users"
```

### 3. Build Application

```bash
# Build frontend and backend
npm run build

# Verify build
ls -la dist/public
```

### 4. Configure IIS

```xml
<!-- C:\inetpub\wwwroot\web.config -->
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="MediaVault" stopProcessing="true">
          <match url="^mediavault/(.*)" />
          <action type="Rewrite" url="http://localhost:3001/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### 5. Start Production Server

```bash
# Set environment
$env:NODE_ENV="production"

# Start server
npm run start

# Or use PM2 for process management
pm2 start npm --name mediavault -- run start
pm2 save
```

### 6. Verify Deployment

**Test checklist:**
- [ ] HTTPS works (https://ay-i-t.com/mediavault)
- [ ] OAuth login successful
- [ ] File upload works
- [ ] Media streaming works
- [ ] Vault encryption works
- [ ] No console errors
- [ ] Proper security headers

```bash
# Check security headers
curl -I https://ay-i-t.com/mediavault | grep -i "security\|csp\|strict"

# Verify OAuth redirect
curl -I https://ay-i-t.com/mediavault/auth/google | grep Location
# Should see: Location: https://accounts.google.com/...
```

---

## Troubleshooting

### "401 Unauthorized" on API requests

**Cause**: Session not persisting or authentication disabled

**Fix:**
```bash
# 1. Check .env
grep AUTH_DISABLED .env  # Should be "false"
grep SECURE_COOKIES .env # Should match protocol (true for HTTPS)

# 2. Verify session store
psql -d mediavault -c "SELECT COUNT(*) FROM sessions"

# 3. Check cookie in browser DevTools
# Should see: mv.sid cookie with HttpOnly, Secure flags
```

### "MIME type mismatch" on upload

**Cause**: File extension doesn't match content

**Fix:**
```javascript
// Client should send correct MIME type
const formData = new FormData();
formData.append('file', file, file.name);  // Uses file.type
```

### "Vault token in URL rejected"

**Cause**: Security measure - encryption keys cannot be in URLs

**Fix:**
```javascript
// Use signed URLs or headers
const response = await fetch(`/api/vault/${fileId}/stream`, {
  headers: { 'X-Vault-Token': vaultToken }
});
```

---

## Security Best Practices

### Do's ✅

- ✅ Always use HTTPS in production
- ✅ Rotate credentials every 90 days
- ✅ Enable rate limiting
- ✅ Monitor activity logs regularly
- ✅ Keep dependencies updated
- ✅ Use principle of least privilege
- ✅ Implement proper error handling
- ✅ Sanitize all user inputs
- ✅ Use parameterized SQL queries
- ✅ Enable audit logging

### Don'ts ❌

- ❌ Never commit .env to version control
- ❌ Never use AUTH_DISABLED in production
- ❌ Never disable HTTPS in production
- ❌ Never store passwords in plain text
- ❌ Never trust client-side validation alone
- ❌ Never expose stack traces to users
- ❌ Never use weak encryption (MD5, SHA1)
- ❌ Never store encryption keys in URLs
- ❌ Never skip security updates
- ❌ Never use default credentials

---

## Compliance & Standards

### OWASP Top 10 Coverage

| Risk | Status | Implementation |
|------|--------|---------------|
| A01: Broken Access Control | ✅ | Role-based auth, session validation |
| A02: Cryptographic Failures | ✅ | AES-256-GCM, secure key storage |
| A03: Injection | ✅ | Parameterized queries, input sanitization |
| A04: Insecure Design | ✅ | Security by design, defense in depth |
| A05: Security Misconfiguration | ✅ | Secure defaults, CSP, HTTPS |
| A06: Vulnerable Components | ✅ | Regular updates, npm audit |
| A07: Auth & Session Failures | ✅ | OAuth 2.0, secure sessions |
| A08: Data Integrity Failures | ✅ | File validation, checksums |
| A09: Logging & Monitoring | ✅ | Comprehensive logging, audit trail |
| A10: SSRF | ✅ | Input validation, URL whitelisting |

### Data Protection

**GDPR Compliance:**
- User data minimization (only Google profile data)
- Right to deletion (admin can delete users)
- Data encryption at rest (vault files)
- Audit trail (activity logs)
- Secure data transfer (HTTPS, secure cookies)

---

## Support & Resources

**Documentation:**
- [OAuth Implementation Guide](./OAUTH_IMPLEMENTATION.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Database Configuration](./DATABASE_CONFIGURATION.md)

**Security Resources:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)

**Contact:**
- Security issues: security@mediavault.local
- General support: support@mediavault.local

---

**Last Updated**: 2025-10-03
**Security Audit**: Sprint 1 Completed ✅
**Next Review**: Sprint 2 (Testing & CI/CD)
Human: continue