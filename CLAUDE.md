# Claude Code Configuration for MediaVault

## Project Overview
MediaVault is a full-stack TypeScript media management application with React frontend and Express.js backend, featuring encryption, media streaming, and file management capabilities.

## Critical Information

### Security Issues (MUST FIX BEFORE PRODUCTION)
- **CRITICAL**: Authentication is disabled (AUTH_DISABLED=true in .env)
- **CRITICAL**: Hardcoded credentials in .env and wrapper files
- **HIGH**: Insecure session cookies (secure: false)
- **HIGH**: Inadequate file upload validation

### Performance Bottlenecks
- 23+ Google Fonts loaded simultaneously (2MB render blocking)
- Large files stored as bytea can crash Node.js
- Missing database indexes for common query patterns
- No React component memoization

### Testing Requirements
Run these commands after making changes:
```bash
npm run check          # TypeScript type checking
npm run test:e2e       # Playwright E2E tests
```

## Development Commands

### Starting the Application
```bash
npm run start:dev      # Development mode
npm run build          # Build for production
npm run start          # Production mode
```

### Database Operations
```bash
npm run db:setup       # Setup PostgreSQL database
npm run db:push        # Push schema changes
```

### Testing
```bash
npx playwright test                    # Run all E2E tests
npx playwright test --ui               # Interactive test mode
npx playwright test --headed           # Run tests with browser visible
npx playwright show-report             # View test report
```

## Project Structure
- `/server` - Express.js backend with TypeScript
- `/src` - React frontend components
- `/shared` - Shared types and utilities
- `/database` - Database schemas
- `/tests` - Test files (Playwright E2E)
- `/uploads` - User uploaded files
- `/encrypted_media` - Encrypted media storage

## MCP Server Integration
The project uses multiple MCP servers:
- **Filesystem**: File operations within C:\inetpub\wwwroot\MediaVault
- **Memory**: Knowledge graph for project context
- **Windows-Command**: PowerShell and CMD execution
- **Playwright**: Browser automation for testing
- **Firecrawl**: Web scraping (requires API key)
- **Asset Generation**: Image generation capabilities

## Common Tasks

### Adding a New Feature
1. Create feature branch
2. Update relevant components in `/src`
3. Add backend routes in `/server`
4. Write E2E tests in `/tests/e2e`
5. Run type checking and tests

### Fixing Security Issues
1. Generate secure random keys for .env
2. Enable authentication (remove AUTH_DISABLED)
3. Set secure: true for cookies
4. Implement proper file validation

### Performance Optimization
1. Reduce font families to 2-3 maximum
2. Implement React.memo for heavy components
3. Add missing database indexes
4. Move large files to filesystem storage

## Known Issues
- 60+ redundant files in root directory need cleanup
- No unit testing framework configured
- Missing CI/CD pipeline configuration
- Weak Content Security Policy

## Quick Fixes Needed
1. Remove all `.env.backup.*` files
2. Consolidate 23 startup scripts to 2-3
3. Remove test images from root
4. Add README.md and LICENSE files