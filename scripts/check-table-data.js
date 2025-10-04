import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://mediavault_user:4c2J1mvjLDKL4zOSpIYFp67bj70LcAIi@localhost:5432/mediavault'
});

async function checkData() {
  const client = await pool.connect();
  try {
    console.log('=== Checking table row counts ===\n');

    const tables = [
      'users', 'sessions', 'categories', 'media_files', 'import_batches',
      'activity_logs', 'folders', 'files', 'albums', 'album_files',
      'tags', 'file_tags', 'smart_folders', 'permissions', 'system_settings',
      'share_links', 'playlists', 'playlist_tracks', 'play_history'
    ];

    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`${table.padEnd(20)}: ${result.rows[0].count} rows`);
    }

    console.log('\n=== Users table sample (if any) ===');
    const users = await client.query('SELECT id, email, "firstName", "lastName", role FROM users LIMIT 5');
    console.table(users.rows);

    console.log('\n=== Sessions table sample (if any) ===');
    const sessions = await client.query('SELECT sid, expire FROM sessions LIMIT 5');
    console.table(sessions.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkData();
