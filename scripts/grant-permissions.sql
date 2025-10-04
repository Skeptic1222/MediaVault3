-- Grant permissions to mediavault_user
-- Run as postgres superuser

\c mediavault

-- Grant connect privilege
GRANT CONNECT ON DATABASE mediavault TO mediavault_user;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO mediavault_user;

-- Grant all privileges on all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mediavault_user;

-- Grant all privileges on all sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mediavault_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mediavault_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mediavault_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO mediavault_user;

-- Verify permissions
SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM
    information_schema.table_privileges
WHERE
    grantee = 'mediavault_user'
    AND table_schema = 'public'
ORDER BY
    table_name, privilege_type;
