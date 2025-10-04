import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://mediavault_user:4c2J1mvjLDKL4zOSpIYFp67bj70LcAIi@localhost:5432/mediavault'
});

async function findOrphanedAudio() {
  const client = await pool.connect();

  try {
    console.log('Searching for orphaned audio files...\n');

    // Get all audio files
    const result = await client.query(`
      SELECT id, filename, original_name, file_size, storage_type,
             file_path IS NULL as no_path,
             binary_data IS NULL as no_data,
             created_at
      FROM files
      WHERE file_type = 'audio'
      ORDER BY created_at DESC
    `);

    const audioFiles = result.rows;
    console.log(`Found ${audioFiles.length} audio files in database:\n`);

    audioFiles.forEach((file, index) => {
      const hasData = !file.no_data;
      const hasPath = !file.no_path;
      const isOrphaned = !hasData && !hasPath;

      console.log(`${index + 1}. ${file.original_name || file.filename}`);
      console.log(`   ID: ${file.id}`);
      console.log(`   Storage: ${file.storage_type}`);
      console.log(`   Has binary data: ${hasData}`);
      console.log(`   Has file path: ${hasPath}`);
      console.log(`   Size: ${file.file_size} bytes`);
      console.log(`   Status: ${isOrphaned ? '⚠️  ORPHANED (no file data)' : '✅ OK'}`);
      console.log('');
    });

    // Find orphaned files
    const orphaned = audioFiles.filter(f => f.no_data && f.no_path);

    if (orphaned.length > 0) {
      console.log(`\n⚠️  Found ${orphaned.length} orphaned audio file(s):`);
      orphaned.forEach(f => {
        console.log(`   - ${f.original_name || f.filename} (ID: ${f.id})`);
      });

      // Ask if user wants to delete
      console.log('\n🗑️  Deleting orphaned audio files...');

      for (const file of orphaned) {
        await client.query('DELETE FROM files WHERE id = $1', [file.id]);
        console.log(`   ✅ Deleted: ${file.original_name || file.filename}`);
      }

      console.log(`\n✅ Successfully deleted ${orphaned.length} orphaned file(s).`);
    } else {
      console.log('✅ No orphaned audio files found.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

findOrphanedAudio();
