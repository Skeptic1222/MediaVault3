# Folder Sharing with Google Accounts - Implementation Guide

## ✅ AUTHENTICATION-REQUIRED INVITE SYSTEM

This implementation generates **invite links** that:
- **Require Google account login**
- **Verify the user's email matches the invited email**
- **Only work for specified email addresses**

## What Has Been Implemented

### Backend Changes (✅ Complete)

1. **Database Schema** (shared/schema.ts:363)
   - Added `sharedWithEmails` field to `share_links` table
   - Field type: `jsonb` array of email addresses
   - Allows restricting share links to specific email addresses

2. **Sharing Service** (server/services/sharingService.ts)
   - Updated `CreateShareLinkOptions` interface to accept `sharedWithEmails` parameter (line 29)
   - Modified `createShareLink` function to save email list (line 96)
   - Enhanced `accessSharedResource` to verify user email against shared list (lines 236-245)
   - Added support for 'category' resource type (folders) (lines 128-137, 290-296)
   - New function: `getResourcesSharedWithEmail` to find resources shared with a specific user (lines 325-337)

3. **API Routes** (server/routes.ts)
   - **POST `/api/share`** - Create share with `sharedWithEmails` array (line 4022)
   - **GET `/api/share/:code/invite`** - Invite link that REQUIRES authentication (line 4168)
     - Verifies user is logged in
     - Checks user's email against allowed list
     - Returns redirect URL to shared folder
   - **GET `/api/share/shared-with-me`** - Get all resources shared with current user (line 4222)
   - **POST `/api/share/:code/access`** - Updated to pass user email for verification (line 4078)

### Database Migration (⚠️ Requires Admin Access)

**File**: `add-shared-emails-column.sql`

```sql
ALTER TABLE share_links
ADD COLUMN IF NOT EXISTS shared_with_emails jsonb;
```

**To Run Migration**:
- Requires PostgreSQL admin/owner privileges
- Current database user lacks permission (error: must be owner of table share_links)
- Options:
  1. Run manually with admin credentials via pgAdmin or psql
  2. Ask DBA to run the migration
  3. Use superuser connection string

## What Needs to Be Done

### 1. Run Database Migration

**Option A: Using psql (if installed)**
```bash
psql "your-admin-connection-string" -f add-shared-emails-column.sql
```

**Option B: Using pgAdmin**
1. Connect to database with admin user
2. Open Query Tool
3. Run the SQL from `add-shared-emails-column.sql`

**Option C: Using Azure Portal (if using Azure PostgreSQL)**
1. Go to Azure Portal → Your PostgreSQL Server
2. Query editor
3. Run the migration SQL

### 2. Update Share Dialog UI

The share dialog needs an email input field. Example implementation:

**Location**: Client UI share dialog component

**Required Changes**:
1. Add email input field(s) or email chips component
2. Validate email format
3. Send `sharedWithEmails` array in API request

**Example API Call**:
```typescript
// Create share link for a folder with specific emails
const response = await fetch('/api/share', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resourceType: 'category',  // or 'folder'
    resourceId: folderId,
    sharedWithEmails: ['user1@gmail.com', 'user2@gmail.com'],
    password: 'optional-password',  // optional
    expiresIn: 24,  // optional, hours
    maxUses: 5  // optional
  })
});
```

### 3. Display Shared Folders

Users who have folders shared with them should see them in their gallery:

**API Endpoint to Use**:
- `GET /api/share` - returns all share links
- Filter by `sharedWithEmails` containing current user's email

**Recommended Implementation**:
1. Create "Shared with Me" section in gallery
2. Fetch folders where user's email is in `sharedWithEmails`
3. Display with special indicator (e.g., "Shared by [owner name]")

### 4. Access Control

When a user accesses a shared folder:
- System checks if their email is in the `sharedWithEmails` array
- If not in list → "You do not have access to this resource" error
- If in list → Grant access per the share permissions

## How It Works

### Creating an Invite Link for Specific Emails

```typescript
// POST /api/share
{
  "resourceType": "category",  // or "folder"
  "resourceId": "folder-uuid",
  "sharedWithEmails": ["alice@gmail.com", "bob@gmail.com"],
  "permissions": {
    "canView": true,
    "canDownload": true
  },
  "expiresIn": 168  // 7 days (optional)
}

// Response includes invite URL
{
  "code": "abc123xyz",
  "url": "https://ay-i-t.com/mediavault/invite/abc123xyz",
  "sharedWithEmails": ["alice@gmail.com", "bob@gmail.com"]
}
```

### Invite Link Access Flow (REQUIRES AUTHENTICATION)

**Step 1: User Clicks Invite Link**
```
User clicks: /invite/{code}
  ↓
Frontend checks if user is logged in
  ↓
If NOT logged in → Redirect to Google OAuth login
If logged in → Proceed to Step 2
```

**Step 2: Verify Email and Grant Access**
```
Frontend calls: GET /api/share/{code}/invite
  ↓
Backend checks:
  1. Is share link valid? (not expired/max uses)
  2. Is user's email in sharedWithEmails array?
  ↓
If email matches → Return resource + redirect URL
If email doesn't match → Return 403 error
  ↓
Frontend redirects to: /gallery?folder={folderId}
```

### Complete Authentication Flow

```
1. User receives email: "Alice shared a folder with you"
   Link: https://ay-i-t.com/mediavault/invite/abc123xyz

2. User clicks link (not logged in)
   → Redirects to: /auth/google?redirect=/invite/abc123xyz

3. User logs in with Google (alice@gmail.com)
   → OAuth callback redirects to: /invite/abc123xyz

4. Frontend calls: GET /api/share/abc123xyz/invite
   Headers: Cookie: session-token

5. Backend verifies:
   - User authenticated? ✓ (alice@gmail.com)
   - Email in allowed list? ✓ (alice@gmail.com in sharedWithEmails)

6. Backend responds:
   {
     "success": true,
     "redirectUrl": "/gallery?folder=folder-uuid",
     "resource": { folder details }
   }

7. Frontend redirects user to shared folder
```

### Error Cases

**Wrong Email Address**
```
User: bob@gmail.com
Allowed: ["alice@gmail.com"]
→ 403: "This resource has not been shared with your account"
```

**Not Logged In**
```
User visits /invite/{code} without authentication
→ Redirect to /auth/google?redirect=/invite/{code}
```

**Expired Link**
```
Share link expired or max uses reached
→ 403: "Share link expired or max uses reached"
```

## Testing

### Test Cases

1. **Share folder with specific email**
   - Create folder
   - Share with `test@gmail.com`
   - Login as `test@gmail.com`
   - Verify access granted

2. **Deny access to non-listed user**
   - Share folder with `alice@gmail.com`
   - Login as `bob@gmail.com`
   - Verify access denied

3. **Public share (no emails)**
   - Create share without `sharedWithEmails`
   - Access without login
   - Verify public access works

4. **Email + password protection**
   - Share with email list AND password
   - Verify both checks are enforced

## Files Modified

- `shared/schema.ts` - Added sharedWithEmails field
- `server/services/sharingService.ts` - Email verification logic
- `server/routes.ts` - API route updates
- `add-shared-emails-column.sql` - Database migration
- `run-migration.js` - Migration runner script

## Next Steps

1. ✅ Backend implementation complete
2. ⚠️ Run database migration (requires admin access)
3. ❌ Update share dialog UI to collect emails
4. ❌ Add "Shared with Me" view
5. ❌ Test end-to-end flow
