-- MediaVault - Complete Media Data Reset
-- This script removes ALL media data while preserving user accounts
-- Run with: psql -U postgres -d mediavault -f scripts/reset-media-data.sql

BEGIN;

-- Show current state
SELECT 'Before cleanup:' as status;
SELECT COUNT(*) as media_count FROM media_items;
SELECT COUNT(*) as folder_count FROM folders;
SELECT COUNT(*) as activity_count FROM activity_logs;
SELECT COUNT(*) as user_count FROM users;

-- Delete all media items
DELETE FROM media_items;

-- Delete all folders
DELETE FROM folders;

-- Delete all activity logs
DELETE FROM activity_logs;

-- Delete all sessions (will force re-login)
DELETE FROM sessions;

-- Delete test/dev users (keep only Google OAuth users)
-- Uncomment the line below if you want to remove dev/test users
-- DELETE FROM users WHERE email LIKE 'dev%' OR email LIKE 'test@%';

-- Show final state
SELECT 'After cleanup:' as status;
SELECT COUNT(*) as media_count FROM media_items;
SELECT COUNT(*) as folder_count FROM folders;
SELECT COUNT(*) as activity_count FROM activity_logs;
SELECT COUNT(*) as user_count FROM users;
SELECT email, role FROM users;

COMMIT;

-- Reset sequences (optional - ensures IDs start from 1 again)
-- ALTER SEQUENCE media_items_id_seq RESTART WITH 1;
-- ALTER SEQUENCE folders_id_seq RESTART WITH 1;
-- ALTER SEQUENCE activity_logs_id_seq RESTART WITH 1;
