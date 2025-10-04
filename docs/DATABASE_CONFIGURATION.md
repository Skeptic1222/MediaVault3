# MediaVault Database Configuration

## Overview
MediaVault uses PostgreSQL 17.6 for production data storage with the following configuration:

- **Database**: mediavault
- **User**: mediavault_user
- **Connection URL**: `postgresql://mediavault_user:***@localhost:5432/mediavault`
- **Session Storage**: PostgreSQL-backed (connect-pg-simple)

## Tables

### Core Tables
- **sessions** - Session storage (replaces in-memory store)
- **users** - User accounts and profiles
- **media_files** - Media file metadata and storage
- **files** - Generic file storage
- **folders** - Hierarchical folder organization

### Organization Tables
- **categories** - Media categorization
- **albums** - Curated collections
- **tags** - Flexible tagging system
- **smart_folders** - Auto-updating filtered views

### Relationships
- **album_files** - Album-file junction
- **file_tags** - File-tag junction
- **playlist_tracks** - Playlist-track junction

### Audio Features
- **playlists** - Audio playlists
- **play_history** - Listening history tracking

### Security & Audit
- **activity_logs** - Security audit trail
- **permissions** - Granular access control
- **share_links** - Public/guest sharing

### System
- **import_batches** - Bulk import tracking
- **system_settings** - Admin configuration

## Indexes

### Session Table Indexes
```sql
IDX_session_expire    -- Enables efficient session cleanup
sessions_pkey         -- Primary key on sid
```

### Critical Performance Indexes
```sql
-- Deduplication and hash lookup
media_files.idx_media_files_sha256
files.idx_files_hash

-- User data isolation
media_files.idx_media_files_uploaded_by
files.idx_files_user
folders.idx_folders_user

-- Category and folder navigation
media_files.idx_media_files_category
files.idx_files_folder
folders.idx_folders_parent

-- Time-based queries
media_files.idx_media_files_created_at
playlists.idx_playlists_created
```

### Unique Constraints
All tables include appropriate unique constraints for:
- Email uniqueness (users)
- Hash + user uniqueness (files, media_files)
- Junction table uniqueness (album_files, file_tags, etc.)

## Connection Pool Configuration

### Current Settings
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Default pool settings (pg defaults):
  // max: 10              // Maximum connections
  // idleTimeoutMillis: 10000
  // connectionTimeoutMillis: 0
});
```

### Recommended Production Settings
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Increase for high traffic
  idleTimeoutMillis: 30000,   // 30 seconds
  connectionTimeoutMillis: 2000,
  statement_timeout: 30000,   // 30 second query timeout
});
```

## Session Storage

### Configuration
File: `server/replitAuth.ts` (lines 44-50)

```javascript
const pgStore = connectPg(session);
store = new pgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: false,  // Table created via Drizzle ORM
  ttl: sessionTtl,              // 24 hours default
  tableName: "sessions",
});
```

### Session Cleanup
Expired sessions are automatically managed by connect-pg-simple, but periodic cleanup is recommended:

```sql
-- Run daily via scheduled task
DELETE FROM sessions WHERE expire < NOW();
```

### Session Schema
```sql
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IDX_session_expire ON sessions (expire);
```

## Database Maintenance

### Daily Tasks
```bash
# Health check
node scripts/database-health-check.js

# Session cleanup (automatic, but can run manually)
psql -U mediavault_user -d mediavault -c "DELETE FROM sessions WHERE expire < NOW();"
```

### Weekly Tasks
```sql
-- Update statistics
ANALYZE;

-- Check for bloat
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Monthly Tasks
```sql
-- Full vacuum and analyze
VACUUM ANALYZE;

-- Check for unused indexes
SELECT * FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0;
```

## Performance Monitoring

### Cache Hit Ratio
Target: > 99%

```sql
SELECT
  sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 as cache_hit_ratio
FROM pg_statio_user_tables;
```

### Slow Query Detection
```sql
-- Requires pg_stat_statements extension
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Connection Monitoring
```sql
SELECT datname, usename, state, COUNT(*)
FROM pg_stat_activity
WHERE datname = 'mediavault'
GROUP BY datname, usename, state;
```

## Backup Strategy

### Daily Automated Backups
```powershell
# Create backup
$date = Get-Date -Format "yyyyMMdd_HHmmss"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" `
  -U mediavault_user `
  -d mediavault `
  -F custom `
  -f "C:\Backups\MediaVault\mediavault_$date.backup"

# Retain last 7 days
Get-ChildItem "C:\Backups\MediaVault\*.backup" |
  Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-7)} |
  Remove-Item
```

### Restore from Backup
```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" `
  -U mediavault_user `
  -d mediavault_restore `
  -c `  # Clean (drop) database objects before recreating
  "C:\Backups\MediaVault\mediavault_20251003_043500.backup"
```

## Security Hardening

### User Permissions
The mediavault_user has been granted:
- CONNECT on database
- USAGE on public schema
- ALL PRIVILEGES on all tables
- ALL PRIVILEGES on all sequences

### Network Security
```
# pg_hba.conf (PostgreSQL authentication)
# Restrict to localhost only in production:
host    mediavault      mediavault_user    127.0.0.1/32    scram-sha-256
```

### SSL/TLS (Recommended for Production)
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-certificate.crt').toString(),
  }
});
```

## Troubleshooting

### Connection Issues
```bash
# Test connection
node scripts/check-database-state.js

# Check PostgreSQL service
Get-Service postgresql*

# View PostgreSQL logs
Get-Content "C:\Program Files\PostgreSQL\16\data\log\postgresql-*.log" -Tail 50
```

### Permission Denied Errors
```bash
# Re-apply permissions
node scripts/apply-grants.js

# Verify permissions
node scripts/check-database-state.js
```

### Migration Conflicts
```bash
# Check current schema state
node scripts/inspect-schema.js

# Force schema sync (caution: may lose data)
npm run db:push
```

### Session Storage Not Working
```bash
# Verify sessions table exists
node scripts/test-session-storage.js

# Check for errors in application logs
Get-Content "C:\inetpub\wwwroot\MediaVault\logs\*.log" -Tail 100
```

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `check-database-state.js` | List tables and check permissions |
| `inspect-schema.js` | View table columns and constraints |
| `analyze-indexes.js` | Review all database indexes |
| `test-session-storage.js` | Test PostgreSQL session storage |
| `database-health-check.js` | Comprehensive health report |
| `apply-grants.js` | Grant permissions to mediavault_user |
| `optimize-database.sql` | Performance optimization queries |

## Migration History

### 2025-10-03: Initial Production Setup
- Created mediavault database
- Created mediavault_user with full permissions
- Applied all schema tables from shared/schema.ts
- Configured PostgreSQL session storage
- Added all recommended indexes
- Verified connection pool configuration

### Schema Version
Current schema managed by Drizzle ORM:
- File: `shared/schema.ts`
- Migration tool: `drizzle-kit`
- Command: `npm run db:push`

## Environment Variables

```env
# Database Configuration
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mediavault
DB_USER=mediavault_user
DB_PASSWORD=<strong-password>
DATABASE_URL=postgresql://mediavault_user:<password>@localhost:5432/mediavault

# Session Configuration
SESSION_SECRET=<cryptographically-secure-secret>
SESSION_TTL=86400000  # 24 hours in milliseconds
SECURE_COOKIES=true   # Enable in production

# Connection Pool (optional overrides)
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=2000
```

## Health Metrics

Current database health (as of 2025-10-03):
- ✓ Database size: 29 MB
- ✓ Cache hit ratio: 100%
- ✓ Total indexes: 62
- ✓ All critical indexes present
- ✓ Session storage configured
- ✓ User permissions: 133 privileges on 19 tables

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/17/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple)
- [pg (node-postgres)](https://node-postgres.com/)
