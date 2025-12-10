const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// 1. Get DB URL
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        const match = envFile.match(/DATABASE_URL=(.*)/);
        if (match && match[1]) connectionString = match[1].trim();
    }
  } catch (e) {}
}

if (!connectionString) {
  console.error("No DATABASE_URL found.");
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const TARGET_EMAIL = 'AdminL';
const TARGET_PASSWORD = 'Llaifeafd281ai*@'; // The password you provided

async function debugLogin() {
    try {
        await client.connect();
        console.log(`Checking user: ${TARGET_EMAIL}`);
        
        const res = await client.query('SELECT * FROM users WHERE email = $1', [TARGET_EMAIL]);
        
        if (res.rows.length === 0) {
            console.log('❌ User NOT FOUND in database.');
            return;
        }

        const user = res.rows[0];
        console.log('✅ User Found.');
        console.log('   Stored Hash:', user.password_hash.substring(0, 20) + '...');
        
        console.log(`Testing password: "${TARGET_PASSWORD}"`);
        const isValid = await bcrypt.compare(TARGET_PASSWORD, user.password_hash);
        
        if (isValid) {
            console.log('✅ SUCCESS: The password IS correct and matches the database hash.');
            console.log('   > If you cannot login in the browser, check for typos or spaces in the input box.');
        } else {
            console.log('❌ FAILURE: The password does NOT match the stored hash.');
            console.log('   > The database has a different password stored.');
            
            // Generate valid SQL to fix it
            const newHash = await bcrypt.hash(TARGET_PASSWORD, 10);
            console.log('\nTo FIX this, run this SQL in Neon Console:');
            console.log(`UPDATE users SET password_hash = '${newHash}' WHERE email = '${TARGET_EMAIL}';`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

debugLogin();
