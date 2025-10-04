-- PostgreSQL Database Optimization for MediaVault
-- Run this script periodically to maintain database performance

\c mediavault

-- 1. Update table statistics for query planner
ANALYZE;

-- 2. Check for missing indexes (query to identify slow operations)
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    seq_tup_read / NULLIF(seq_scan, 0) as avg_seq_tup,
    CASE
        WHEN seq_scan > idx_scan THEN 'Consider adding index'
        ELSE 'OK'
    END as recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- 3. Identify bloated tables
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. Show cache hit ratio (should be > 99%)
SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 as cache_hit_ratio
FROM pg_statio_user_tables;

-- 5. Check for unused indexes
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 6. Session cleanup (remove expired sessions)
DELETE FROM sessions WHERE expire < NOW();

-- 7. Show connection information
SELECT
    datname,
    usename,
    client_addr,
    state,
    query_start,
    state_change,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE datname = 'mediavault';

-- 8. Vacuum analyze for cleanup and statistics
VACUUM ANALYZE;

-- Display completion message
SELECT 'Database optimization complete' as status;
