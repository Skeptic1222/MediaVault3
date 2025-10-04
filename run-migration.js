import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  try {
    const sql = fs.readFileSync('./add-shared-emails-column.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
