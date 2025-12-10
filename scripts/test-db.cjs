const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Try to read .env manually since dotenv might be flaky in some contexts
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        const match = envFile.match(/DATABASE_URL=(.*)/);
        if (match && match[1]) {
          connectionString = match[1].trim();
          console.log('Found DATABASE_URL in .env file');
        }
    } else {
         console.log('No .env file found at:', envPath);
    }
  } catch (e) {
    console.log('Could not read .env file directly:', e.message);
  }
}

if (!connectionString) {
  console.error('ERROR: Could not find DATABASE_URL in process.env or .env file');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

console.log('Attempting to connect to Neon DB...');

client.connect()
  .then(() => {
    console.log('✅ Connection Successful!');
    return client.query('SELECT NOW() as time, version()');
  })
  .then((res) => {
    console.log('Database Time:', res.rows[0].time);
    console.log('Postgres Version:', res.rows[0].version);
    return client.query("SELECT email, name FROM users WHERE email = 'AdminL'");
  })
  .then((res) => {
    if (res.rows.length > 0) {
      console.log('✅ Admin User (AdminL) FOUND in database.');
    } else {
      console.log('⚠️  Admin User (AdminL) NOT FOUND.'); 
      console.log('   Please run the SQL from db/seed_admin.sql in your Neon Console!');
    }
    return client.end();
  })
  .catch((err) => {
    console.error('❌ Connection Failed:', err);
    console.error('Details:', err.message);
    if (err.code) console.error('Code:', err.code);
    process.exit(1);
  });
