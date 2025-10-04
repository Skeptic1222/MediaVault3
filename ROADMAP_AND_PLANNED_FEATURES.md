# MediaVault - Roadmap & Planned Features Analysis

> Compiled from documentation analysis on 2025-10-03

## Executive Summary

This document consolidates all planned features, known issues, and improvement requests identified across the MediaVault documentation and codebase. The items are categorized by priority and implementation complexity.

---

## 🚨 CRITICAL Security Issues (MUST FIX BEFORE PRODUCTION)

### 1. Authentication Disabled
**Status**: Not Implemented
**Location**: `.env` file
**Issue**: `AUTH_DISABLED=true` in production environment
**Priority**: CRITICAL
**Action Required**:
- Remove `AUTH_DISABLED` flag from .env
- Ensure OAuth is the only authentication method
- Verify all routes are properly protected

### 2. Hardcoded Credentials
**Status**: Not Implemented
**Location**: `.env` files, wrapper files
**Issue**: Credentials are hardcoded instead of using secure credential storage
**Priority**: CRITICAL
**Action Required**:
- Migrate to Windows Credential Store (USE_WINDOWS_CREDENTIAL_STORE)
- Generate secure random keys for all secrets
- Remove all backup .env files (`.env.backup.*`)

### 3. Insecure Session Cookies
**Status**: Partially Implemented
**Location**: `server/auth.ts`
**Issue**: `secure: false` in session cookie configuration
**Priority**: HIGH
**Action Required**:
- Set `secure: true` for HTTPS-only cookies
- Verify `SECURE_COOKIES=true` in production .env
- Test session persistence with secure cookies

### 4. Inadequate File Upload Validation
**Status**: Partially Implemented
**Location**: `server/routes.ts`, multer middleware
**Issue**: Weak validation for file types and content
**Priority**: HIGH
**Action Required**:
- Implement magic number validation (not just extension check)
- Add virus scanning integration
- Enforce strict MIME type validation
- Add file size limits per user role

---

## ⚡ Performance Bottlenecks & Optimizations

### 1. Google Fonts Overload
**Status**: Not Fixed
**Current State**: 23+ Google Fonts loaded simultaneously (2MB+ render blocking)
**Priority**: HIGH
**Planned Solution**:
- Reduce to 2-3 font families maximum
- Use `font-display: swap` for better perceived performance
- Consider hosting fonts locally
- Implement font subsetting

### 2. Large File Storage Architecture
**Status**: Partially Implemented
**Current State**: Large files stored as bytea can crash Node.js
**Priority**: HIGH
**Planned Solution**:
- Move large files (>10MB) to filesystem storage only
- Implement chunked upload/download for files >50MB
- Add streaming support for all media types
- Consider cloud storage integration (S3/Azure Blob)

### 3. Missing Database Indexes
**Status**: Not Implemented
**Current State**: Common query patterns lack proper indexing
**Priority**: MEDIUM
**Planned Indexes**:
```sql
-- Recommended indexes to add:
CREATE INDEX idx_media_files_user_created ON media_files(user_id, created_at DESC);
CREATE INDEX idx_media_files_folder ON media_files(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX idx_media_files_category ON media_files(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_activity_logs_user_date ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_media_files_encrypted ON media_files(is_encrypted) WHERE is_encrypted = true;
```

### 4. React Component Memoization
**Status**: Not Implemented
**Current State**: No React.memo usage, excessive re-renders
**Priority**: MEDIUM
**Planned Components for Optimization**:
- MediaCard components (heavy re-renders in gallery)
- Thumbnail components (LazyThumbnail)
- Music player controls
- Video player controls
- File manager tree nodes

### 5. Bundle Size Optimization
**Status**: Not Implemented
**Current State**: 857KB JavaScript bundle
**Priority**: MEDIUM
**Planned Optimizations**:
- Implement route-based code splitting
- Lazy load heavy components (VideoPlayer, MusicPlayer)
- Tree-shake unused UI components
- Compress images and assets
- Enable Vite build optimizations

---

## 🔧 Technical Improvements & Features

### 1. Unit Testing Framework
**Status**: Not Configured
**Current State**: Only E2E tests with Playwright exist
**Priority**: HIGH
**Planned Implementation**:
- Add Vitest for unit testing
- Test coverage for services (mediaService, cryptoService)
- Test utilities and hooks
- Aim for 80% code coverage
- Add pre-commit hooks for test execution

### 2. CI/CD Pipeline
**Status**: Missing
**Current State**: No automated deployment pipeline
**Priority**: HIGH
**Planned Features**:
- GitHub Actions workflow for:
  - Automated testing on PR
  - Type checking
  - Build verification
  - Deployment to staging/production
- Automated database migrations
- Rollback capabilities

### 3. Content Security Policy (CSP)
**Status**: Weak
**Current State**: CSP not properly configured
**Priority**: MEDIUM
**Planned Implementation**:
- Implement strict CSP headers
- Remove inline scripts
- Use nonces for necessary inline content
- Configure CSP reporting

### 4. Vault Encryption Enhancement
**Status**: Partially Implemented
**Current Issue**: Offset-capable decryption not implemented
**Location**: `server/services/mediaService.ts`
**Priority**: MEDIUM
**TODO Comment Found**:
```typescript
// TODO: Implement offset-capable decryption (AES-CTR with known IV)
```
**Planned Feature**:
- Implement AES-CTR mode for seekable encrypted media
- Support range requests for encrypted videos
- Allow scrubbing in encrypted video player

---

## 📁 Code Cleanup & Maintenance

### 1. Root Directory Cleanup
**Status**: Not Started
**Current State**: 60+ redundant files in root directory
**Priority**: MEDIUM
**Files to Remove**:
- All `.env.backup.*` files
- 23+ duplicate startup scripts (consolidate to 2-3)
- Test images and screenshots
- Debug logs and temporary files
- Obsolete documentation files

### 2. Startup Scripts Consolidation
**Status**: Not Started
**Current State**: 23 different startup scripts causing confusion
**Priority**: MEDIUM
**Planned Consolidation**:
- Keep: `start-dev.ps1` (development)
- Keep: `start-production.ps1` (production)
- Remove: All other startup variants
- Document usage in README.md

### 3. Documentation Additions
**Status**: Incomplete
**Missing Files**:
- LICENSE file (specify MIT/Apache/etc.)
- CONTRIBUTING.md (contribution guidelines)
- CHANGELOG.md (version history)
- API.md (comprehensive API documentation)

---

## 🎯 New Feature Requests (Inferred from Architecture)

### 1. Multi-User Collaboration
**Status**: Not Implemented
**Potential Features**:
- Shared folders between users
- Media sharing with expiring links
- Collaborative playlists
- Comments on media items
- User mentions and notifications

### 2. Advanced Search & Filtering
**Status**: Basic Implementation
**Potential Enhancements**:
- Full-text search across filenames and metadata
- Filter by date range, file size, file type
- Saved searches
- Smart collections (auto-updating based on criteria)
- Tag-based organization

### 3. Media Processing
**Status**: Basic Thumbnail Generation Only
**Potential Features**:
- Video transcoding (format conversion)
- Image optimization (auto-resize, compression)
- Audio normalization
- Batch operations
- Background job queue (Bull/BullMQ)

### 4. Mobile Apps
**Status**: Responsive Web Only
**Potential Development**:
- Native iOS app (React Native/Swift)
- Native Android app (React Native/Kotlin)
- Offline mode with sync
- Camera integration for direct upload
- Biometric authentication

### 5. Storage Backends
**Status**: Local Filesystem Only
**Potential Integrations**:
- AWS S3 storage backend
- Azure Blob Storage
- Google Cloud Storage
- Cloudflare R2
- Multi-backend support with abstraction layer

### 6. Advanced Vault Features
**Status**: Basic Encryption Only
**Potential Enhancements**:
- Multiple vaults per user
- Vault sharing with other users
- Time-locked vaults (cannot open until date)
- Decoy vaults (plausible deniability)
- Hardware key support (YubiKey)

---

## 🔍 Known Issues & Limitations

### Documented Issues

1. **Session Cleanup**:
   - **Current**: Automated by connect-pg-simple
   - **Potential Enhancement**: Add manual cleanup admin tool

2. **Error Handling**:
   - **Current**: Basic error responses
   - **Potential Enhancement**: Structured error codes, user-friendly messages

3. **Rate Limiting**:
   - **Current**: Basic implementation
   - **Potential Enhancement**: Per-user, per-endpoint limits with Redis

4. **Monitoring & Logging**:
   - **Current**: Basic Winston logging
   - **Potential Enhancement**:
     - Centralized logging (ELK stack)
     - APM integration (New Relic/DataDog)
     - Real-time error tracking (Sentry)

5. **Backup & Recovery**:
   - **Current**: Manual database backups
   - **Potential Enhancement**:
     - Automated daily backups
     - Point-in-time recovery
     - Disaster recovery plan

---

## 📊 Priority Matrix

### Immediate Action (Before Production)
1. ✅ Fix authentication (remove AUTH_DISABLED)
2. ✅ Secure credentials (Windows Credential Store)
3. ✅ Enable secure cookies
4. ✅ Implement proper file validation

### High Priority (Within 1 Month)
1. 🔧 Add unit testing framework
2. 🔧 Implement CI/CD pipeline
3. 🔧 Fix font loading performance
4. 🔧 Add database indexes
5. 🔧 Clean up root directory

### Medium Priority (1-3 Months)
1. 📈 React component memoization
2. 📈 Bundle size optimization
3. 📈 Content Security Policy
4. 📈 Vault offset decryption
5. 📈 Large file streaming improvements

### Future Enhancements (3+ Months)
1. 🚀 Multi-user collaboration
2. 🚀 Advanced search & filtering
3. 🚀 Media processing pipeline
4. 🚀 Mobile native apps
5. 🚀 Cloud storage integration

---

## 🎯 Success Metrics

### Security
- [ ] Zero CRITICAL security issues
- [ ] All authentication flows secure
- [ ] Content Security Policy score: A+
- [ ] OWASP Top 10 compliance

### Performance
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] Bundle size < 300KB (gzipped)
- [ ] Lighthouse score > 90

### Code Quality
- [ ] Test coverage > 80%
- [ ] Zero TypeScript errors
- [ ] All E2E tests passing
- [ ] No console errors in production

### User Experience
- [ ] Mobile responsive on all pages
- [ ] Accessibility score (WCAG AA)
- [ ] Error recovery graceful
- [ ] Offline capabilities (service worker)

---

## 📅 Recommended Implementation Timeline

### Sprint 1 (Week 1-2): Security Hardening
- Fix authentication issues
- Secure credential storage
- Enable secure cookies
- File validation improvements

### Sprint 2 (Week 3-4): Testing & CI/CD
- Setup Vitest
- Write unit tests for critical services
- Implement GitHub Actions CI/CD
- Automated deployment pipeline

### Sprint 3 (Week 5-6): Performance
- Font optimization
- Database indexing
- React memoization
- Bundle size reduction

### Sprint 4 (Week 7-8): Code Quality
- Root directory cleanup
- Documentation completion
- CSP implementation
- Code review and refactoring

### Sprint 5+ (Month 3+): New Features
- Advanced search
- Media processing
- Collaboration features
- Mobile apps (long-term)

---

## 📝 Notes

### Code Comments Found
1. **mediaService.ts**: TODO for offset-capable decryption (AES-CTR)
   - Required for seekable encrypted video playback

### Documentation References
- **CLAUDE.md**: Lists security issues and performance bottlenecks
- **ARCHITECTURE.md**: Documents known issues and limitations
- **README.md**: Quick fixes needed section

### Dependencies to Consider
- **Testing**: Vitest, Testing Library
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry, DataDog
- **Storage**: AWS SDK, Azure Storage SDK
- **Queue**: Bull, BullMQ
- **Security**: helmet (already used), csurf, express-rate-limit

---

## 🔗 Related Documents

- [CLAUDE.md](./CLAUDE.md) - Development guidelines and known issues
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture and limitations
- [README.md](./README.md) - Quick start and common issues
- [OAUTH_IMPLEMENTATION.md](./docs/OAUTH_IMPLEMENTATION.md) - Authentication details

---

**Last Updated**: 2025-10-03
**Analysis Version**: 1.0
**Total Items Identified**: 35+ planned features and improvements
