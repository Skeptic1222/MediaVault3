#!/usr/bin/env node
// Setup local PostgreSQL: create role and database if missing, and pgcrypto extension
// Usage: node scripts/setup-postgres.cjs

const { Client } = require('pg');

const TARGET_DB = process.env.PGAPP_DB || 'mediavault';
const TARGET_USER = process.env.PGAPP_USER || 'aidev';
const TARGET_PASS = process.env.PGAPP_PASS || 'qwerty';
const HOST = process.env.PGHOST || 'localhost';
const PORT = parseInt(process.env.PGPORT || '5432', 10);

async function tryConnect(configs) {
  for (const cfg of configs) {
    const client = new Client(cfg);
    try {
      await client.connect();
      return client;
    } catch (_) {
      // try next
    }
  }
  return null;
}

async function run() {
  // Try to get a superuser connection to run admin commands
  const adminCandidates = [
    // Explicit env-provided postgres superuser
    { host: HOST, port: PORT, user: process.env.PGUSER || 'postgres', password: process.env.PGPASSWORD, database: 'postgres' },
    // Common fallbacks
    { host: HOST, port: PORT, user: 'postgres', password: 'postgres', database: 'postgres' },
    { host: HOST, port: PORT, user: 'postgres', database: 'postgres' },
  ];

  let admin = await tryConnect(adminCandidates);

  if (!admin) {
    // Try with target user if it already exists
    const userClient = await tryConnect([
      { host: HOST, port: PORT, user: TARGET_USER, password: TARGET_PASS, database: 'postgres' },
    ]);
    if (userClient) {
      console.log(`Connected as ${TARGET_USER}. Attempting to create database ${TARGET_DB} if missing...`);
      try {
        await userClient.query(`CREATE DATABASE "${TARGET_DB}"`);
        console.log(`Created database ${TARGET_DB}.`);
      } catch (e) {
        if (!String(e.message || '').toLowerCase().includes('already exists')) {
          throw e;
        }
        console.log(`Database ${TARGET_DB} already exists.`);
      }
      await userClient.end();
      console.log('NOTE: To enable gen_random_uuid(), a superuser must run: CREATE EXTENSION IF NOT EXISTS pgcrypto;');
      return;
    }

    console.error('Could not connect as postgres superuser. Set PGUSER/PGPASSWORD env or ensure local Postgres is reachable.');
    process.exit(1);
  }

  // Create role if missing
  const roleCheck = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [TARGET_USER]);
  if (roleCheck.rowCount === 0) {
    await admin.query(`CREATE ROLE "${TARGET_USER}" WITH LOGIN PASSWORD '${TARGET_PASS}' CREATEDB`);
    console.log(`Created role ${TARGET_USER} with LOGIN and CREATEDB.`);
  } else {
    await admin.query(`ALTER ROLE "${TARGET_USER}" WITH LOGIN PASSWORD '${TARGET_PASS}'`);
    console.log(`Updated role ${TARGET_USER} password.`);
  }

  // Create database owned by target user
  try {
    await admin.query(`CREATE DATABASE "${TARGET_DB}" OWNER "${TARGET_USER}"`);
    console.log(`Created database ${TARGET_DB} owned by ${TARGET_USER}.`);
  } catch (e) {
    if (!String(e.message || '').toLowerCase().includes('already exists')) {
      throw e;
    }
    console.log(`Database ${TARGET_DB} already exists.`);
  }

  // Enable pgcrypto in target database
  const dbClient = new Client({ host: HOST, port: PORT, user: 'postgres', password: admin.connectionParameters.password, database: TARGET_DB });
  await dbClient.connect();
  try {
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    console.log('Enabled pgcrypto extension.');
  } catch (e) {
    console.warn('Could not enable pgcrypto (requires superuser). Please run manually:', e.message);
  }
  await dbClient.end();

  await admin.end();
  console.log('PostgreSQL setup complete.');
}

run().catch((err) => {
  console.error('Setup failed:', err.message || err);
  process.exit(1);
});

