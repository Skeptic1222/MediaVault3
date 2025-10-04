import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://mediavault_user:4c2J1mvjLDKL4zOSpIYFp67bj70LcAIi@localhost:5432/mediavault'
});

async function inspectSchema() {
  const client = await pool.connect();
  try {
    console.log('=== Users table columns ===');
    const userCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.table(userCols.rows);

    console.log('\n=== Sessions table columns ===');
    const sessCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position
    `);
    console.table(sessCols.rows);

    console.log('\n=== Sessions table indexes ===');
    const sessIndexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'sessions'
    `);
    console.table(sessIndexes.rows);

    console.log('\n=== Check for unique constraints on users ===');
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'users'
    `);
    console.table(constraints.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

inspectSchema();
