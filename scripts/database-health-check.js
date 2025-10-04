import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mediavault_user:4c2J1mvjLDKL4zOSpIYFp67bj70LcAIi@localhost:5432/mediavault'
});

async function healthCheck() {
  const client = await pool.connect();
  const report = [];

  try {
    report.push('='.repeat(80));
    report.push('MediaVault Database Health Check Report');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('='.repeat(80));

    // 1. Connection Test
    report.push('\n[1] DATABASE CONNECTION');
    report.push('-'.repeat(80));
    const versionResult = await client.query('SELECT version()');
    report.push(`✓ Connected successfully`);
    report.push(`PostgreSQL Version: ${versionResult.rows[0].version.split(',')[0]}`);

    // 2. Database Size
    report.push('\n[2] DATABASE SIZE');
    report.push('-'.repeat(80));
    const sizeResult = await client.query(`
      SELECT pg_size_pretty(pg_database_size('mediavault')) as size
    `);
    report.push(`Total database size: ${sizeResult.rows[0].size}`);

    // 3. Table Row Counts
    report.push('\n[3] TABLE ROW COUNTS');
    report.push('-'.repeat(80));
    const tables = [
      'users', 'sessions', 'categories', 'media_files', 'files', 'folders',
      'albums', 'album_files', 'tags', 'file_tags', 'playlists', 'playlist_tracks',
      'play_history', 'import_batches', 'activity_logs', 'permissions',
      'share_links', 'smart_folders', 'system_settings'
    ];

    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      report.push(`${table.padEnd(25)}: ${result.rows[0].count.toString().padStart(10)} rows`);
    }

    // 4. Index Health
    report.push('\n[4] INDEX HEALTH');
    report.push('-'.repeat(80));
    const indexCount = await client.query(`
      SELECT COUNT(*) as count FROM pg_indexes WHERE schemaname = 'public'
    `);
    report.push(`Total indexes: ${indexCount.rows[0].count}`);

    const unusedIndexes = await client.query(`
      SELECT indexrelname as indexname, relname as tablename
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND idx_scan = 0
        AND indexrelname NOT LIKE '%_pkey'
        AND indexrelname NOT LIKE '%_unique'
    `);

    if (unusedIndexes.rows.length > 0) {
      report.push(`\n⚠ Unused indexes (${unusedIndexes.rows.length}):`);
      for (const row of unusedIndexes.rows) {
        report.push(`  - ${row.tablename}.${row.indexname}`);
      }
    } else {
      report.push('✓ All indexes are being used');
    }

    // 5. Cache Hit Ratio
    report.push('\n[5] CACHE PERFORMANCE');
    report.push('-'.repeat(80));
    const cacheResult = await client.query(`
      SELECT
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        ROUND(sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2) as cache_hit_ratio
      FROM pg_statio_user_tables
    `);

    if (cacheResult.rows[0].cache_hit_ratio) {
      const ratio = parseFloat(cacheResult.rows[0].cache_hit_ratio);
      const status = ratio > 99 ? '✓' : (ratio > 95 ? '⚠' : '❌');
      report.push(`${status} Cache hit ratio: ${ratio}% (target: >99%)`);
    } else {
      report.push('ℹ Not enough data to calculate cache hit ratio');
    }

    // 6. Session Table Status
    report.push('\n[6] SESSION STORAGE');
    report.push('-'.repeat(80));
    const sessionResult = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE expire > NOW()) as active,
        COUNT(*) FILTER (WHERE expire <= NOW()) as expired
      FROM sessions
    `);
    report.push(`✓ Sessions table exists`);
    report.push(`  Total sessions: ${sessionResult.rows[0].total}`);
    report.push(`  Active sessions: ${sessionResult.rows[0].active}`);
    report.push(`  Expired sessions: ${sessionResult.rows[0].expired}`);

    // 7. Connection Pool
    report.push('\n[7] CONNECTION POOL');
    report.push('-'.repeat(80));
    report.push(`Total connections: ${pool.totalCount}`);
    report.push(`Idle connections: ${pool.idleCount}`);
    report.push(`Waiting clients: ${pool.waitingCount}`);

    // 8. Required Indexes Check
    report.push('\n[8] CRITICAL INDEXES');
    report.push('-'.repeat(80));
    const criticalIndexes = [
      'sessions:IDX_session_expire',
      'sessions:sessions_pkey',
      'users:users_email_unique',
      'media_files:idx_media_files_sha256',
      'files:idx_files_hash'
    ];

    let allCriticalPresent = true;
    for (const check of criticalIndexes) {
      const [table, indexName] = check.split(':');
      const result = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = $1 AND indexname = $2
      `, [table, indexName]);

      if (result.rows.length > 0) {
        report.push(`✓ ${check}`);
      } else {
        report.push(`❌ MISSING: ${check}`);
        allCriticalPresent = false;
      }
    }

    // 9. Permissions Check
    report.push('\n[9] USER PERMISSIONS');
    report.push('-'.repeat(80));
    const permCheck = await client.query(`
      SELECT
        COUNT(DISTINCT table_name) as tables_with_perms,
        COUNT(*) as total_privileges
      FROM information_schema.table_privileges
      WHERE grantee = 'mediavault_user'
        AND table_schema = 'public'
    `);
    report.push(`✓ mediavault_user has permissions on ${permCheck.rows[0].tables_with_perms} tables`);
    report.push(`  Total privileges granted: ${permCheck.rows[0].total_privileges}`);

    // 10. Overall Health Status
    report.push('\n[10] OVERALL HEALTH STATUS');
    report.push('='.repeat(80));

    const issues = [];
    if (!allCriticalPresent) issues.push('Missing critical indexes');
    if (sessionResult.rows[0].expired > 100) issues.push('High number of expired sessions');

    if (issues.length === 0) {
      report.push('✓ DATABASE IS HEALTHY - All checks passed');
      report.push('\nRecommendations:');
      report.push('  • Run periodic VACUUM ANALYZE for optimal performance');
      report.push('  • Monitor cache hit ratio to stay above 99%');
      report.push('  • Clean up expired sessions regularly');
    } else {
      report.push('⚠ ISSUES DETECTED:');
      for (const issue of issues) {
        report.push(`  - ${issue}`);
      }
    }

    report.push('\n' + '='.repeat(80));
    report.push('End of Report');
    report.push('='.repeat(80));

  } catch (err) {
    report.push(`\n❌ ERROR: ${err.message}`);
    report.push(err.stack);
  } finally {
    client.release();
    await pool.end();
  }

  // Print report
  const reportText = report.join('\n');
  console.log(reportText);

  // Save report to file
  const reportPath = 'C:\\inetpub\\wwwroot\\MediaVault\\logs\\database-health-report.txt';
  try {
    fs.mkdirSync('C:\\inetpub\\wwwroot\\MediaVault\\logs', { recursive: true });
    fs.writeFileSync(reportPath, reportText);
    console.log(`\nReport saved to: ${reportPath}`);
  } catch (err) {
    console.log(`\nCould not save report: ${err.message}`);
  }
}

healthCheck();
