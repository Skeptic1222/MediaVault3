# GitHub Upload Instructions for MediaVault

## Summary

The MediaVault repository has **308 files** ready to upload to GitHub at `https://github.com/sop1973/MediaVault`. The local git repository is configured and committed (commit: `baa63bd`), but authentication is required to push to GitHub.

## Problem

The GitHub MCP server doesn't have authentication credentials for the `sop1973` account, preventing direct upload through the MCP tools. Git push also fails with "Repository not found" error, indicating authentication issues.

## Solutions (Choose ONE)

### Option 1: Use GitHub CLI (RECOMMENDED - Easiest)

1. **Install GitHub CLI**:
   ```powershell
   winget install GitHub.cli
   ```

2. **Authenticate**:
   ```powershell
   gh auth login
   ```
   - Select: GitHub.com
   - Select: HTTPS
   - Authenticate with browser

3. **Push to GitHub**:
   ```powershell
   cd C:\inetpub\wwwroot\MediaVault
   git push -u origin main
   ```

### Option 2: Use Personal Access Token (PAT)

1. **Create a Personal Access Token**:
   - Go to: https://github.com/settings/tokens/new
   - Token name: `MediaVault Upload`
   - Expiration: 7 days (or your preference)
   - Scopes: Select `repo` (all repo permissions)
   - Click "Generate token"
   - **COPY THE TOKEN IMMEDIATELY** (you won't see it again)

2. **Run the upload script with your token**:
   ```powershell
   cd C:\inetpub\wwwroot\MediaVault
   .\push-to-github.ps1 -Token "YOUR_TOKEN_HERE"
   ```

### Option 3: Use Git Credential Manager (Interactive)

1. **Push and authenticate when prompted**:
   ```powershell
   cd C:\inetpub\wwwroot\MediaVault
   git push -u origin main
   ```

2. **When prompted, enter**:
   - Username: `sop1973`
   - Password: Use a Personal Access Token (see Option 2, step 1)
   - OR: Authenticate via browser if prompted

### Option 4: Verify Repository Exists First

The repository might not exist yet. If that's the case:

1. **Create the repository on GitHub**:
   - Go to: https://github.com/new
   - Repository name: `MediaVault`
   - Description: `Secure Media Management System with Google OAuth 2.0 Authentication`
   - Privacy: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license
   - Click "Create repository"

2. **Then use any of the options above to push**

## Files Ready for Upload

- **Total files**: 308
- **Commit message**: "Initial commit: MediaVault - Secure Media Management System"
- **Commit hash**: baa63bd544e0c9590efbdc650d1f40651c977690

### Key files included:
- All source code (React frontend, Express backend)
- Configuration files (.gitignore, package.json, tsconfig.json, etc.)
- Documentation (README.md, CLAUDE.md, docs/)
- Database schemas
- Tests (Playwright E2E tests)
- Build scripts

### Excluded (via .gitignore):
- node_modules/
- .env files (credentials)
- uploads/, encrypted_media/ (media files)
- dist/, build/ (compiled files)
- logs/, temp/, test-results/

## Helper Scripts Created

### 1. `push-to-github.ps1`
Interactive PowerShell script that:
- Checks git configuration
- Verifies commit status
- Counts files
- Handles authentication
- Pushes to GitHub with progress

**Usage**:
```powershell
# With token:
.\push-to-github.ps1 -Token "ghp_xxxxxxxxxxxx"

# Without token (interactive):
.\push-to-github.ps1
```

## Troubleshooting

### Error: "Repository not found"
**Causes**:
1. Repository doesn't exist on GitHub
2. Wrong repository name/owner
3. No access permissions

**Solutions**:
- Verify repository exists at https://github.com/sop1973/MediaVault
- Create repository if it doesn't exist (see Option 4)
- Check you're logged into the correct GitHub account

### Error: "Authentication failed"
**Causes**:
1. No credentials configured
2. Invalid token
3. Token expired or lacks permissions

**Solutions**:
- Use GitHub CLI: `gh auth login`
- Generate new Personal Access Token with `repo` scope
- Ensure token hasn't expired

### Error: "Permission denied"
**Causes**:
1. Not owner/collaborator of repository
2. Token lacks write permissions

**Solutions**:
- Verify you own the `sop1973` account
- Check repository collaborators
- Regenerate token with `repo` scope

## Quick Start (Fastest Method)

```powershell
# 1. Install GitHub CLI (if not installed)
winget install GitHub.cli

# 2. Authenticate
gh auth login

# 3. Navigate to repository
cd C:\inetpub\wwwroot\MediaVault

# 4. Push to GitHub
git push -u origin main

# 5. View your repository
start https://github.com/sop1973/MediaVault
```

## Expected Result

After successful push:
- All 308 files will be on GitHub
- Repository URL: https://github.com/sop1973/MediaVault
- Default branch: `main`
- Commit message: "Initial commit: MediaVault - Secure Media Management System..."
- Full commit history preserved

## Next Steps After Upload

1. **Verify upload**:
   ```powershell
   start https://github.com/sop1973/MediaVault
   ```

2. **Add repository description** (on GitHub):
   - Go to repository settings
   - Add description: "Secure Media Management System with Google OAuth 2.0 Authentication"

3. **Add topics** (optional):
   - react, typescript, express, postgresql, oauth2, media-management

4. **Configure GitHub Pages** (if desired):
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: main, folder: / (root)

5. **Set up GitHub Actions** (already configured):
   - `.github/workflows/test.yml` - Automated testing
   - `.github/workflows/mobile-testing.yml` - Mobile UI tests

## Status

- Local repository: ✅ Ready (308 files committed)
- Remote configured: ✅ https://github.com/sop1973/MediaVault
- Authentication: ❌ Required (choose option above)
- Upload status: ⏳ Pending authentication

## Support

If you encounter issues:
1. Check this file for troubleshooting steps
2. Verify GitHub repository exists
3. Ensure you have write permissions
4. Try GitHub CLI method (most reliable)

---

**Created**: 2025-10-03
**Local Path**: C:\inetpub\wwwroot\MediaVault
**Remote URL**: https://github.com/sop1973/MediaVault
**Files to Upload**: 308
