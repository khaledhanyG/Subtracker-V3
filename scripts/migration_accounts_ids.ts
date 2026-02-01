import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("DATABASE_URL is missing!");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const runMigration = async () => {
    const client = await pool.connect();
    try {
        console.log("Starting Accounts Semantic ID Migration...");
        await client.query('BEGIN');

        // --- Helper Function to sanitize strings ---
        const sanitize = (val: string) => {
            if (!val) return 'unknown';
            // valid: letters (any language), numbers, underscores, hyphens
            // Replace spaces with underscores
            return val.trim().replace(/\s+/g, '_');
        };

        // --- Step 1: Drop Constraints (if any) ---
        // Accounts typically referenced in JSONB in subscriptions. No explicit FKs in schema.sql for accounts.id.

        // --- Step 2: Migrate ACCOUNTS (UUID -> TEXT: id_<name>) ---
        console.log("Migrating Accounts...");

        // 2a. Alter ID columns to TEXT
        await client.query(`ALTER TABLE accounts ALTER COLUMN id TYPE TEXT`);

        // 2b. Map Old UUIDs to New Semantic IDs
        const acctsRes = await client.query(`SELECT id, name FROM accounts`);

        const idMapping: Record<string, string> = {};

        for (const acct of acctsRes.rows) {
            const oldId = acct.id;
            const newId = `id_${sanitize(acct.name)}`;
            idMapping[oldId] = newId;

            console.log(`Account: ${oldId} -> ${newId}`);

            // Update Accounts Table
            await client.query(`UPDATE accounts SET id = $1 WHERE id = $2`, [newId, oldId]);
        }

        // --- Step 3: Update Subscriptions JSONB (accounts) ---
        console.log("Updating Subscriptions Reference (JSONB: accounts)...");

        const subsRes = await client.query(`SELECT id, accounts FROM subscriptions`);

        for (const sub of subsRes.rows) {
            let accountsJSON = sub.accounts;

            // It might be a string due to driver, or object
            if (typeof accountsJSON === 'string') {
                try {
                    accountsJSON = JSON.parse(accountsJSON);
                } catch (e) {
                    console.error(`Failed to parse JSON for sub ${sub.id}`, e);
                    continue;
                }
            }

            if (Array.isArray(accountsJSON) && accountsJSON.length > 0) {
                let updated = false;
                const newAccounts = accountsJSON.map((a: any) => {
                    if (idMapping[a.accountId]) {
                        updated = true;
                        return { ...a, accountId: idMapping[a.accountId] };
                    }
                    return a;
                });

                if (updated) {
                    console.log(`Updating Subscription ${sub.id} accounts JSON...`);
                    await client.query(`UPDATE subscriptions SET accounts = $1 WHERE id = $2`, [JSON.stringify(newAccounts), sub.id]);
                }
            }
        }

        await client.query('COMMIT');
        console.log("Accounts Migration Complete Successfully!");

    } catch (e) {
        console.error("Migration Failed. Rolling back...");
        await client.query('ROLLBACK');
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
};

runMigration();
