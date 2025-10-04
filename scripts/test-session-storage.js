import pkg from 'pg';
const { Pool } = pkg;
import session from 'express-session';
import connectPg from 'connect-pg-simple';

const pool = new Pool({
  connectionString: 'postgresql://mediavault_user:4c2J1mvjLDKL4zOSpIYFp67bj70LcAIi@localhost:5432/mediavault'
});

async function testSessionStorage() {
  console.log('=== Testing PostgreSQL Session Storage ===\n');

  try {
    // Test direct database connection
    console.log('1. Testing database connection...');
    const client = await pool.connect();
    console.log('   ✓ Database connection successful');
    client.release();

    // Create session store
    console.log('\n2. Creating PostgreSQL session store...');
    const pgStore = connectPg(session);
    const store = new pgStore({
      conString: 'postgresql://mediavault_user:4c2J1mvjLDKL4zOSpIYFp67bj70LcAIi@localhost:5432/mediavault',
      createTableIfMissing: false,
      ttl: 86400000, // 24 hours
      tableName: 'sessions',
    });
    console.log('   ✓ Session store created');

    // Test session write
    console.log('\n3. Testing session write...');
    await new Promise((resolve, reject) => {
      store.set('test-session-id', {
        cookie: {
          maxAge: 86400000,
          httpOnly: true,
          secure: true
        },
        user: {
          id: 'test-user',
          email: 'test@example.com'
        }
      }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('   ✓ Session written successfully');

    // Test session read
    console.log('\n4. Testing session read...');
    const sessionData = await new Promise((resolve, reject) => {
      store.get('test-session-id', (err, session) => {
        if (err) reject(err);
        else resolve(session);
      });
    });
    console.log('   ✓ Session read successfully');
    console.log('   Session data:', JSON.stringify(sessionData, null, 2));

    // Test session count
    console.log('\n5. Checking session count in database...');
    const result = await pool.query('SELECT COUNT(*) as count FROM sessions');
    console.log(`   Total sessions in database: ${result.rows[0].count}`);

    // Clean up test session
    console.log('\n6. Cleaning up test session...');
    await new Promise((resolve, reject) => {
      store.destroy('test-session-id', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('   ✓ Test session deleted');

    // Show connection pool stats
    console.log('\n7. Connection pool statistics:');
    console.log(`   Total connections: ${pool.totalCount}`);
    console.log(`   Idle connections: ${pool.idleCount}`);
    console.log(`   Waiting clients: ${pool.waitingCount}`);

    console.log('\n=== All Tests Passed! ===');
    console.log('\nPostgreSQL session storage is configured correctly.');
    console.log('The in-memory session warning should be resolved.');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

testSessionStorage();
