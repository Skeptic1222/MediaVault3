import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/mediavault'
});

async function checkDatabase() {
  try {
    console.log('=== Database Tables ===');
    const tables = await pool.query(`
      SELECT
        schemaname,
        tablename,
        tableowner
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    console.table(tables.rows);

    console.log('\n=== Checking mediavault_user Permissions ===');
    for (const row of tables.rows) {
      const perms = await pool.query(`
        SELECT
          has_table_privilege('mediavault_user', $1, 'SELECT') as can_select,
          has_table_privilege('mediavault_user', $1, 'INSERT') as can_insert,
          has_table_privilege('mediavault_user', $1, 'UPDATE') as can_update,
          has_table_privilege('mediavault_user', $1, 'DELETE') as can_delete
      `, [`public.${row.tablename}`]);
      console.log(`${row.tablename}: ${JSON.stringify(perms.rows[0])}`);
    }

    console.log('\n=== Checking if sessions table exists ===');
    const sessionsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'sessions'
      );
    `);
    console.log('Sessions table exists:', sessionsCheck.rows[0].exists);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkDatabase();
