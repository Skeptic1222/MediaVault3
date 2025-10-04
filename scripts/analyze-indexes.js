import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://mediavault_user:4c2J1mvjLDKL4zOSpIYFp67bj70LcAIi@localhost:5432/mediavault'
});

async function analyzeIndexes() {
  const client = await pool.connect();
  try {
    console.log('=== All Indexes in Database ===\n');

    const indexes = await client.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    // Group by table
    const byTable = {};
    for (const row of indexes.rows) {
      if (!byTable[row.tablename]) {
        byTable[row.tablename] = [];
      }
      byTable[row.tablename].push({
        index: row.indexname,
        definition: row.indexdef
      });
    }

    for (const [table, tableIndexes] of Object.entries(byTable)) {
      console.log(`\n${table}:`);
      for (const idx of tableIndexes) {
        console.log(`  - ${idx.index}`);
        console.log(`    ${idx.definition}`);
      }
    }

    // Check for recommended indexes based on schema.ts
    console.log('\n\n=== Recommended Indexes from Schema ===\n');

    const recommendedIndexes = {
      media_files: ['idx_media_files_sha256', 'idx_media_files_category', 'idx_media_files_uploaded_by', 'idx_media_files_created_at'],
      folders: ['idx_folders_user', 'idx_folders_parent', 'idx_folders_path'],
      files: ['idx_files_folder', 'idx_files_user', 'idx_files_hash', 'idx_files_type'],
      albums: ['idx_albums_user'],
      album_files: ['idx_album_files_album', 'idx_album_files_file'],
      tags: ['idx_tags_user'],
      file_tags: ['idx_file_tags_file', 'idx_file_tags_tag'],
      smart_folders: ['idx_smart_folders_user'],
      permissions: ['idx_permissions_user', 'idx_permissions_resource'],
      share_links: ['idx_share_links_resource', 'idx_share_links_creator'],
      playlists: ['idx_playlists_user', 'idx_playlists_created'],
      playlist_tracks: ['idx_playlist_tracks_playlist', 'idx_playlist_tracks_file', 'idx_playlist_tracks_position'],
      play_history: ['idx_play_history_user', 'idx_play_history_file', 'idx_play_history_played_at'],
      sessions: ['IDX_session_expire']
    };

    const existingIndexNames = new Set(indexes.rows.map(r => r.indexname));

    const missingIndexes = [];
    for (const [table, recommended] of Object.entries(recommendedIndexes)) {
      for (const idxName of recommended) {
        if (!existingIndexNames.has(idxName)) {
          missingIndexes.push({ table, index: idxName });
        }
      }
    }

    if (missingIndexes.length > 0) {
      console.log('Missing indexes:');
      for (const missing of missingIndexes) {
        console.log(`  ${missing.table}: ${missing.index}`);
      }
    } else {
      console.log('All recommended indexes are present!');
    }

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeIndexes();
