-- Fix database permissions for mediavault_user
-- Run this as postgres superuser

\c mediavault

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE mediavault TO mediavault_user;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO mediavault_user;

-- Grant all privileges on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mediavault_user;

-- Grant all privileges on all existing sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mediavault_user;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO mediavault_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO mediavault_user;

-- Ensure mediavault_user owns all tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' OWNER TO mediavault_user;';
    END LOOP;
END $$;

-- Ensure mediavault_user owns all sequences
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public')
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || quote_ident(r.sequence_name) || ' OWNER TO mediavault_user;';
    END LOOP;
END $$;

-- Display current permissions
SELECT
    schemaname,
    tablename,
    tableowner,
    has_table_privilege('mediavault_user', schemaname||'.'||tablename, 'SELECT') as can_select,
    has_table_privilege('mediavault_user', schemaname||'.'||tablename, 'INSERT') as can_insert,
    has_table_privilege('mediavault_user', schemaname||'.'||tablename, 'UPDATE') as can_update,
    has_table_privilege('mediavault_user', schemaname||'.'||tablename, 'DELETE') as can_delete
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
