import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const verify = async () => {
    const client = await pool.connect();
    try {
        console.log("Verifying Accounts...");
        const res = await client.query('SELECT id, name FROM accounts');
        console.table(res.rows);

        const invalid = res.rows.filter(r => !r.id.startsWith('id_'));
        if (invalid.length > 0) {
            console.error("FAIL: Some accounts do not have semantic IDs:", invalid);
        } else {
            console.log("PASS: All accounts have semantic IDs.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
};

verify();
