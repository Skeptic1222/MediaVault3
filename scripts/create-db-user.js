import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function createDatabaseUser() {
  // Connect as superuser to create the new user
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres', // Default postgres password
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL as superuser');

    // Check if user exists
    const checkUser = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname=$1",
      ['mediavault_user']
    );

    if (checkUser.rows.length > 0) {
      console.log('User mediavault_user already exists. Updating password...');
      await client.query(
        `ALTER USER mediavault_user WITH PASSWORD '${process.env.DB_PASSWORD}'`
      );
      console.log('Password updated successfully');
    } else {
      console.log('Creating user mediavault_user...');
      await client.query(
        `CREATE USER mediavault_user WITH PASSWORD '${process.env.DB_PASSWORD}'`
      );
      console.log('User created successfully');
    }

    // Grant privileges
    console.log('Granting privileges...');
    await client.query('GRANT ALL PRIVILEGES ON DATABASE mediavault TO mediavault_user');
    console.log('Privileges granted successfully');

    await client.end();
    console.log('\n✅ Database user setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

createDatabaseUser();
