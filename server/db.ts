import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

async function ensureDatabaseExists(connectionString: string) {
  const url = new URL(connectionString);
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName) return; // nothing to do

  // Try connecting to the target database first
  try {
    const testPool = new Pool({ connectionString });
    const client = await testPool.connect();
    client.release();
    await testPool.end();
    return; // database exists
  } catch (err: any) {
    const message = String(err?.message || "");
    const code = (err && err.code) || '';
    const isDbMissing = code === '3D000' || message.includes('database') && message.includes('does not exist');
    if (!isDbMissing) throw err;
  }

  // SECURITY: Validate database name to prevent SQL injection
  // Only allow alphanumeric characters, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) {
    throw new Error(`Invalid database name: ${dbName}. Only alphanumeric characters, underscores, and hyphens are allowed.`);
  }

  // Connect to default 'postgres' database and create the target database
  const adminUrl = new URL(connectionString);
  adminUrl.pathname = '/postgres';
  const adminPool = new Pool({ connectionString: adminUrl.toString() });
  const adminClient = await adminPool.connect();
  try {
    // Use identifier() or pg-format for safe quoting, but for now validate strictly
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
  } catch (e: any) {
    // Ignore error if database already exists (race conditions)
    if (!String(e?.message || '').toLowerCase().includes('already exists')) {
      throw e;
    }
  } finally {
    adminClient.release();
    await adminPool.end();
  }
}

// Ensure DB exists (best-effort)
await ensureDatabaseExists(process.env.DATABASE_URL);

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
