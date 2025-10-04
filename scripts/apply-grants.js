import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/mediavault'
});

async function applyGrants() {
  const client = await pool.connect();
  try {
    console.log('Granting permissions to mediavault_user...');

    // Grant connect
    await client.query('GRANT CONNECT ON DATABASE mediavault TO mediavault_user');
    console.log('✓ Granted CONNECT');

    // Grant usage on schema
    await client.query('GRANT USAGE ON SCHEMA public TO mediavault_user');
    console.log('✓ Granted USAGE on schema public');

    // Grant all on all tables
    await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mediavault_user');
    console.log('✓ Granted ALL PRIVILEGES on all tables');

    // Grant all on all sequences
    await client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mediavault_user');
    console.log('✓ Granted ALL PRIVILEGES on all sequences');

    // Set default privileges
    await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mediavault_user');
    console.log('✓ Set default privileges for tables');

    await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mediavault_user');
    console.log('✓ Set default privileges for sequences');

    // Verify
    const result = await client.query(`
      SELECT table_name, privilege_type
      FROM information_schema.table_privileges
      WHERE grantee = 'mediavault_user'
      AND table_schema = 'public'
      ORDER BY table_name, privilege_type
    `);

    console.log('\nGranted privileges:');
    console.table(result.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

applyGrants();
