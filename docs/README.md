# MediaVault Documentation

> **Complete documentation for MediaVault - Secure Media Management System**

## 📖 Documentation Index

### Essential Documents (Start Here)

1. **[../README.md](../README.md)** - Project overview and quick start guide
2. **[OAUTH_IMPLEMENTATION.md](./OAUTH_IMPLEMENTATION.md)** ⚠️ **CRITICAL** - OAuth setup and troubleshooting
3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and technical details

### Specialized Topics

4. **[DATABASE_CONFIGURATION.md](./DATABASE_CONFIGURATION.md)** - PostgreSQL setup and schema
5. **[MOBILE_TESTING_QUICK_START.md](./MOBILE_TESTING_QUICK_START.md)** - Mobile testing guide
6. **[MOBILE_TESTING_REPORT.md](./MOBILE_TESTING_REPORT.md)** - Mobile testing results

---

## 🚨 Critical Reading for Developers

### If You're Working On...

**Authentication / OAuth**
→ Read: [OAUTH_IMPLEMENTATION.md](./OAUTH_IMPLEMENTATION.md)
- Complete OAuth flow explanation
- IIS reverse proxy configuration
- Common failure modes and fixes
- Debug procedures
- **This is the most important document if OAuth breaks!**

**System Architecture / New Features**
→ Read: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Request flow diagrams
- Middleware stack
- Database schema
- File structure
- API endpoint reference

**Database Changes**
→ Read: [DATABASE_CONFIGURATION.md](./DATABASE_CONFIGURATION.md)
- Schema definitions
- Migration procedures
- Connection configuration

**Mobile Development**
→ Read: [MOBILE_TESTING_QUICK_START.md](./MOBILE_TESTING_QUICK_START.md)
- Mobile-specific considerations
- Testing procedures

---

## 🎯 Quick Reference

### Current System State (2025-10-03)

**Authentication**: ✅ Google OAuth 2.0 fully functional
**Database**: PostgreSQL with session store
**Frontend**: React + Vite (bundle: index-LKS6g_0V.js)
**Backend**: Express.js on port 3001
**Proxy**: IIS at /mediavault base path

### Critical Files

| File | Purpose | Modify? |
|------|---------|---------|
| `server/auth.ts` | OAuth configuration | ⚠️ Read OAUTH_IMPLEMENTATION.md first |
| `server/index-production.ts` | Middleware stack | ⚠️ Order matters |
| `C:\inetpub\wwwroot\web.config` | IIS proxy config | ⚠️ Read OAUTH_IMPLEMENTATION.md first |
| `vite.config.ts` | Frontend build config | ⚠️ BASE_PATH must match .env |
| `.env` | Environment variables | ✅ Update as needed |

### Common Issues → Solutions

| Issue | Document | Section |
|-------|----------|---------|
| OAuth redirect to localhost | OAUTH_IMPLEMENTATION.md | Issue 2 |
| Routes returning 404 | OAUTH_IMPLEMENTATION.md | Issue 1 |
| User data access error | OAUTH_IMPLEMENTATION.md | Issue 3 |
| Session not persisting | OAUTH_IMPLEMENTATION.md | Issue 5 |
| Logout not working | OAUTH_IMPLEMENTATION.md | Issue 4 |

---

## 📋 Document Summaries

### OAUTH_IMPLEMENTATION.md (15KB)
**Essential for**: Anyone working on authentication
**Contains**:
- Complete OAuth flow with diagrams
- IIS ARR configuration and redirect preservation
- Base path stripping middleware explanation
- User object access patterns
- 5 common failure modes with fixes
- Debug procedures and testing checklist
- Production deployment changes

**Read this if**: OAuth stops working or you're modifying auth routes

---

### ARCHITECTURE.md (21KB)
**Essential for**: Anyone adding features or understanding the system
**Contains**:
- System architecture diagrams
- Request flow examples (OAuth, API, upload)
- Complete database schema
- Directory structure
- File storage organization
- Middleware stack
- Security considerations
- Performance optimizations
- Troubleshooting guide
- API endpoint reference

**Read this if**: You need to understand how components interact

---

### DATABASE_CONFIGURATION.md (9KB)
**Essential for**: Database administrators and schema changes
**Contains**:
- PostgreSQL setup instructions
- Table schemas
- Migration procedures
- Connection configuration
- Backup and restore

**Read this if**: You're modifying database structure

---

## 🔍 Finding Information

### By Topic

**Authentication**
- OAuth flow → OAUTH_IMPLEMENTATION.md § OAuth Flow Diagram
- Session management → OAUTH_IMPLEMENTATION.md § Session Configuration
- User roles → ARCHITECTURE.md § Security Considerations

**Development**
- Project structure → ARCHITECTURE.md § Directory Structure
- Build process → README.md § Development Commands
- Environment setup → README.md § Setup

**Deployment**
- Production deployment → OAUTH_IMPLEMENTATION.md § Production Deployment Changes
- IIS configuration → OAUTH_IMPLEMENTATION.md § IIS Redirect Rewriting
- Environment variables → ARCHITECTURE.md § Critical Configuration Files

**Troubleshooting**
- OAuth issues → OAUTH_IMPLEMENTATION.md § Common Failure Modes
- Server errors → ARCHITECTURE.md § Troubleshooting Guide
- Database issues → DATABASE_CONFIGURATION.md

---

## 🛠️ Quick Recovery Procedures

### OAuth Broken
```bash
# 1. Read OAUTH_IMPLEMENTATION.md § Quick Recovery Commands
# 2. Test direct server (should show Google URL):
curl -i http://localhost:3001/auth/google | grep Location

# 3. Test through IIS (should also show Google URL):
curl -i http://localhost/mediavault/auth/google | grep Location

# 4. Compare results and follow troubleshooting guide
```

### Server Won't Start
```bash
# 1. Check port 3001 is free:
netstat -ano | findstr :3001

# 2. Verify environment variables:
cat .env

# 3. Check PostgreSQL is running:
psql -d mediavault -c "SELECT 1"

# 4. Review startup logs for errors
```

### Database Issues
```bash
# See DATABASE_CONFIGURATION.md for:
- Connection troubleshooting
- Schema verification
- Migration rollback
```

---

## 📚 Learning Path

### For New Developers

1. **Start**: Read [../README.md](../README.md)
2. **Understand Architecture**: Read [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Setup OAuth**: Read [OAUTH_IMPLEMENTATION.md](./OAUTH_IMPLEMENTATION.md)
4. **Database Setup**: Read [DATABASE_CONFIGURATION.md](./DATABASE_CONFIGURATION.md)
5. **Test**: Follow testing procedures in each document

### For Experienced Developers Joining Project

1. **Skim**: [../README.md](../README.md) for project overview
2. **Study**: [ARCHITECTURE.md](./ARCHITECTURE.md) for system understanding
3. **Reference**: [OAUTH_IMPLEMENTATION.md](./OAUTH_IMPLEMENTATION.md) when working on auth
4. **Bookmark**: This index for quick navigation

---

## 🆘 Emergency Contacts & Resources

### If OAuth Breaks
→ **READ FIRST**: [OAUTH_IMPLEMENTATION.md](./OAUTH_IMPLEMENTATION.md)
→ **Section**: Common Failure Modes and Fixes
→ **Recovery**: Quick Recovery Commands section

### If System Architecture Changes
→ **UPDATE**: [ARCHITECTURE.md](./ARCHITECTURE.md)
→ **Update**: Request flow diagrams
→ **Update**: API endpoint reference

### If Database Schema Changes
→ **UPDATE**: [DATABASE_CONFIGURATION.md](./DATABASE_CONFIGURATION.md)
→ **Update**: Table schemas
→ **Document**: Migration procedure

---

## 📝 Document Maintenance

### Updating Documentation

When you make changes to the system, update the relevant documents:

**Changed OAuth Configuration**
→ Update: OAUTH_IMPLEMENTATION.md
→ Sections: Configuration Points, Testing Checklist

**Changed Architecture**
→ Update: ARCHITECTURE.md
→ Sections: Request Flow, Middleware Stack

**Changed Database Schema**
→ Update: DATABASE_CONFIGURATION.md
→ Sections: Schema, Migration Procedures

**Changed Build Process**
→ Update: README.md
→ Sections: Development Commands, Build Version

### Version Tracking

- **Last Major Update**: 2025-10-03
- **OAuth Status**: Fully functional
- **Build Version**: index-LKS6g_0V.js
- **Known Working Config**: See OAUTH_IMPLEMENTATION.md

---

## ⚠️ Critical Warnings

1. **DO NOT** modify routes in `server/auth.ts` without reading OAUTH_IMPLEMENTATION.md § Base Path Handling
2. **DO NOT** change web.config outbound rules without reading OAUTH_IMPLEMENTATION.md § IIS Redirect Rewriting
3. **DO NOT** access user data via `req.user.claims.sub` - use `req.user.id` (see OAUTH_IMPLEMENTATION.md § User Object Structure)
4. **DO NOT** register routes with `${BASE_PATH}` prefix - middleware already strips it
5. **DO NOT** set cookie path to `BASE_PATH` - must be `/`

---

## 📞 Support

For questions about:
- **OAuth**: See OAUTH_IMPLEMENTATION.md first
- **Architecture**: See ARCHITECTURE.md
- **Database**: See DATABASE_CONFIGURATION.md
- **General**: See ../README.md

All documents contain troubleshooting sections and debug procedures.

---

**Last Updated**: 2025-10-03
**Documentation Version**: 1.0
**System Status**: Production-ready with fully functional OAuth
