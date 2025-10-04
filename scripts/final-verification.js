/**
 * Final Verification Script for MediaVault Database Setup
 * This script performs comprehensive checks to ensure production readiness
 */

import pkg from 'pg';
const { Pool } = pkg;
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mediavault_user:4c2J1mvjLDKL4zOSpIYFp67bj70LcAIi@localhost:5432/mediavault';

const pool = new Pool({ connectionString: DATABASE_URL });

let allTestsPassed = true;
const results = [];

function log(message, status = 'INFO') {
  const symbols = { PASS: '✓', FAIL: '❌', WARN: '⚠', INFO: 'ℹ' };
  const symbol = symbols[status] || 'ℹ';
  const line = `${symbol} ${message}`;
  console.log(line);
  results.push(line);
  if (status === 'FAIL') allTestsPassed = false;
}

async function test1_DatabaseConnection() {
  log('\n[TEST 1] Database Connection', 'INFO');
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    log(`Connected to ${result.rows[0].version.split(',')[0]}`, 'PASS');
    client.release();
  } catch (err) {
    log(`Connection failed: ${err.message}`, 'FAIL');
  }
}

async function test2_SessionsTable() {
  log('\n[TEST 2] Sessions Table', 'INFO');
  const client = await pool.connect();
  try {
    // Check table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'sessions'
      )
    `);
    if (tableCheck.rows[0].exists) {
      log('Sessions table exists', 'PASS');
    } else {
      log('Sessions table missing', 'FAIL');
      client.release();
      return;
    }

    // Check required columns
    const columns = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position
    `);
    const colNames = columns.rows.map(r => r.column_name);
    const required = ['sid', 'sess', 'expire'];
    const hasAllCols = required.every(col => colNames.includes(col));
    if (hasAllCols) {
      log('Sessions table has required columns (sid, sess, expire)', 'PASS');
    } else {
      log(`Sessions table missing columns. Found: ${colNames.join(', ')}`, 'FAIL');
    }

    // Check index on expire
    const indexCheck = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'sessions' AND indexname = 'IDX_session_expire'
    `);
    if (indexCheck.rows.length > 0) {
      log('IDX_session_expire index exists', 'PASS');
    } else {
      log('IDX_session_expire index missing', 'FAIL');
    }
  } catch (err) {
    log(`Sessions table check failed: ${err.message}`, 'FAIL');
  } finally {
    client.release();
  }
}

async function test3_SessionStorage() {
  log('\n[TEST 3] Session Storage Functionality', 'INFO');
  try {
    const pgStore = connectPg(session);
    const store = new pgStore({
      conString: DATABASE_URL,
      createTableIfMissing: false,
      ttl: 86400000,
      tableName: 'sessions',
    });

    // Write test session
    await new Promise((resolve, reject) => {
      store.set('verify-test-session', {
        cookie: { maxAge: 60000, httpOnly: true, secure: true },
        testData: { timestamp: Date.now(), purpose: 'final verification' }
      }, (err) => err ? reject(err) : resolve());
    });
    log('Session write successful', 'PASS');

    // Read test session
    const readData = await new Promise((resolve, reject) => {
      store.get('verify-test-session', (err, data) => err ? reject(err) : resolve(data));
    });
    if (readData && readData.testData) {
      log('Session read successful', 'PASS');
    } else {
      log('Session read failed - no data returned', 'FAIL');
    }

    // Delete test session
    await new Promise((resolve, reject) => {
      store.destroy('verify-test-session', (err) => err ? reject(err) : resolve());
    });
    log('Session delete successful', 'PASS');
  } catch (err) {
    log(`Session storage test failed: ${err.message}`, 'FAIL');
  }
}

async function test4_CriticalTables() {
  log('\n[TEST 4] Critical Tables', 'INFO');
  const client = await pool.connect();
  try {
    const requiredTables = [
      'sessions', 'users', 'media_files', 'files', 'folders',
      'categories', 'albums', 'tags', 'activity_logs'
    ];

    for (const table of requiredTables) {
      const result = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      );
      if (result.rows[0].exists) {
        log(`Table '${table}' exists`, 'PASS');
      } else {
        log(`Table '${table}' missing`, 'FAIL');
      }
    }
  } catch (err) {
    log(`Table check failed: ${err.message}`, 'FAIL');
  } finally {
    client.release();
  }
}

async function test5_CriticalIndexes() {
  log('\n[TEST 5] Critical Indexes', 'INFO');
  const client = await pool.connect();
  try {
    const criticalIndexes = [
      { table: 'sessions', index: 'IDX_session_expire' },
      { table: 'sessions', index: 'sessions_pkey' },
      { table: 'users', index: 'users_email_unique' },
      { table: 'media_files', index: 'idx_media_files_sha256' },
      { table: 'files', index: 'idx_files_hash' }
    ];

    for (const { table, index } of criticalIndexes) {
      const result = await client.query(
        `SELECT indexname FROM pg_indexes WHERE tablename = $1 AND indexname = $2`,
        [table, index]
      );
      if (result.rows.length > 0) {
        log(`Index '${table}.${index}' exists`, 'PASS');
      } else {
        log(`Index '${table}.${index}' missing`, 'FAIL');
      }
    }
  } catch (err) {
    log(`Index check failed: ${err.message}`, 'FAIL');
  } finally {
    client.release();
  }
}

async function test6_Permissions() {
  log('\n[TEST 6] User Permissions', 'INFO');
  const client = await pool.connect();
  try {
    // Test SELECT permission
    await client.query('SELECT COUNT(*) FROM sessions');
    log('SELECT permission granted', 'PASS');

    // Test INSERT permission
    await client.query(`
      INSERT INTO sessions (sid, sess, expire)
      VALUES ('perm-test', '{"test": true}'::jsonb, NOW() + INTERVAL '1 hour')
      ON CONFLICT (sid) DO NOTHING
    `);
    log('INSERT permission granted', 'PASS');

    // Test UPDATE permission
    await client.query(`UPDATE sessions SET sess = '{"test": false}'::jsonb WHERE sid = 'perm-test'`);
    log('UPDATE permission granted', 'PASS');

    // Test DELETE permission
    await client.query(`DELETE FROM sessions WHERE sid = 'perm-test'`);
    log('DELETE permission granted', 'PASS');

  } catch (err) {
    log(`Permission test failed: ${err.message}`, 'FAIL');
  } finally {
    client.release();
  }
}

async function test7_ConnectionPool() {
  log('\n[TEST 7] Connection Pool', 'INFO');
  try {
    if (pool.totalCount <= 10) {
      log(`Connection pool configured (${pool.totalCount} connections)`, 'PASS');
    } else {
      log(`Connection pool may have leaks (${pool.totalCount} connections)`, 'WARN');
    }

    if (pool.idleCount >= 0) {
      log(`Idle connections: ${pool.idleCount}`, 'PASS');
    }

    if (pool.waitingCount === 0) {
      log('No waiting clients (healthy)', 'PASS');
    } else {
      log(`${pool.waitingCount} clients waiting (possible bottleneck)`, 'WARN');
    }
  } catch (err) {
    log(`Connection pool check failed: ${err.message}`, 'FAIL');
  }
}

async function test8_EnvironmentVariables() {
  log('\n[TEST 8] Environment Variables', 'INFO');
  try {
    if (process.env.DATABASE_URL) {
      log('DATABASE_URL is set', 'PASS');
    } else {
      log('DATABASE_URL is not set', 'FAIL');
    }

    if (process.env.SESSION_SECRET) {
      log('SESSION_SECRET is set', 'PASS');
    } else {
      log('SESSION_SECRET is not set', 'WARN');
    }

    if (process.env.SESSION_TTL) {
      log(`SESSION_TTL configured (${process.env.SESSION_TTL}ms)`, 'PASS');
    } else {
      log('SESSION_TTL using default', 'INFO');
    }

    if (process.env.SECURE_COOKIES === 'true') {
      log('SECURE_COOKIES enabled', 'PASS');
    } else {
      log('SECURE_COOKIES not enabled (required for production)', 'WARN');
    }
  } catch (err) {
    log(`Environment check failed: ${err.message}`, 'FAIL');
  }
}

async function runAllTests() {
  console.log('='.repeat(80));
  console.log('MediaVault Database - Final Verification');
  console.log('='.repeat(80));

  await test1_DatabaseConnection();
  await test2_SessionsTable();
  await test3_SessionStorage();
  await test4_CriticalTables();
  await test5_CriticalIndexes();
  await test6_Permissions();
  await test7_ConnectionPool();
  await test8_EnvironmentVariables();

  console.log('\n' + '='.repeat(80));
  if (allTestsPassed) {
    console.log('✓ ALL TESTS PASSED - Database is production-ready!');
  } else {
    console.log('❌ SOME TESTS FAILED - Please review errors above');
  }
  console.log('='.repeat(80));

  // Save results to file
  const reportPath = 'C:\\inetpub\\wwwroot\\MediaVault\\logs\\final-verification.txt';
  try {
    fs.mkdirSync('C:\\inetpub\\wwwroot\\MediaVault\\logs', { recursive: true });
    const reportContent = results.join('\n') + '\n\n' +
      (allTestsPassed ? '✓ ALL TESTS PASSED' : '❌ SOME TESTS FAILED') + '\n' +
      `Timestamp: ${new Date().toISOString()}\n`;
    fs.writeFileSync(reportPath, reportContent);
    console.log(`\nReport saved to: ${reportPath}`);
  } catch (err) {
    console.log(`Could not save report: ${err.message}`);
  }

  await pool.end();
  process.exit(allTestsPassed ? 0 : 1);
}

runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
