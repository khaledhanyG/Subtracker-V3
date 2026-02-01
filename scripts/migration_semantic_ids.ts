import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

// Use the existing connection string
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
        console.log("Starting Semantic ID Migration...");
        await client.query('BEGIN');

        // --- Helper Function to sanitize strings ---
        // e.g., "Main Company Wallet" -> "Main_Company_Wallet"
        // "khaled@example.com" -> "khaled_example_com"
        const sanitize = (val: string) => {
            if (!val) return 'unknown';
            return val.replace(/[^a-zA-Z0-9]/g, '_');
        };

        // --- Step 1: Drop Constraints to allow Type Change ---
        console.log("Dropping FK constraints...");

        // Wallets references Users
        await client.query(`ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey`);

        // Departments references Users
        await client.query(`ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_user_id_fkey`);

        // Accounts references Users
        await client.query(`ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey`);

        // Subscriptions references Users
        await client.query(`ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey`);

        // Transactions references Users & Wallets & Subscriptions
        await client.query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey`);
        await client.query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_from_wallet_id_fkey`);
        await client.query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_to_wallet_id_fkey`);
        await client.query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_subscription_id_fkey`);


        // --- Step 2: Migrate USERS (UUID -> TEXT: id_<email>) ---
        console.log("Migrating Users...");

        // 2a. Alter ID columns to TEXT
        await client.query(`ALTER TABLE users ALTER COLUMN id TYPE TEXT`);
        await client.query(`ALTER TABLE wallets ALTER COLUMN user_id TYPE TEXT`);
        await client.query(`ALTER TABLE transactions ALTER COLUMN user_id TYPE TEXT`);
        await client.query(`ALTER TABLE subscriptions ALTER COLUMN user_id TYPE TEXT`);
        await client.query(`ALTER TABLE departments ALTER COLUMN user_id TYPE TEXT`);
        await client.query(`ALTER TABLE accounts ALTER COLUMN user_id TYPE TEXT`);

        // 2b. Map Old UUIDs to New Semantic IDs
        const usersRes = await client.query(`SELECT id, email FROM users`);
        for (const user of usersRes.rows) {
            const oldId = user.id;
            const newId = `id_${sanitize(user.email)}`;

            console.log(`User: ${oldId} -> ${newId}`);

            // Update Users Table
            await client.query(`UPDATE users SET id = $1 WHERE id = $2`, [newId, oldId]);

            // Update Foreign Keys
            await client.query(`UPDATE wallets SET user_id = $1 WHERE user_id = $2`, [newId, oldId]);
            await client.query(`UPDATE transactions SET user_id = $1 WHERE user_id = $2`, [newId, oldId]);
            await client.query(`UPDATE subscriptions SET user_id = $1 WHERE user_id = $2`, [newId, oldId]);
            await client.query(`UPDATE departments SET user_id = $1 WHERE user_id = $2`, [newId, oldId]);
            await client.query(`UPDATE accounts SET user_id = $1 WHERE user_id = $2`, [newId, oldId]);
        }


        // --- Step 3: Migrate WALLETS (UUID -> TEXT: id_<name>) ---
        console.log("Migrating Wallets...");

        // 3a. Alter ID columns to TEXT
        await client.query(`ALTER TABLE wallets ALTER COLUMN id TYPE TEXT`);
        await client.query(`ALTER TABLE transactions ALTER COLUMN from_wallet_id TYPE TEXT`);
        await client.query(`ALTER TABLE transactions ALTER COLUMN to_wallet_id TYPE TEXT`);

        // 3b. Map Old UUIDs to New Semantic IDs
        const walletsRes = await client.query(`SELECT id, name FROM wallets`);
        for (const wallet of walletsRes.rows) {
            const oldId = wallet.id;
            const newId = `id_${sanitize(wallet.name)}`;

            console.log(`Wallet: ${oldId} -> ${newId}`);

            // Update Wallets Table
            await client.query(`UPDATE wallets SET id = $1 WHERE id = $2`, [newId, oldId]);

            // Update Foreign Keys for Transactions
            await client.query(`UPDATE transactions SET from_wallet_id = $1 WHERE from_wallet_id = $2`, [newId, oldId]);
            await client.query(`UPDATE transactions SET to_wallet_id = $1 WHERE to_wallet_id = $2`, [newId, oldId]);
        }

        // --- Step 4: Re-apply Constraints ---
        console.log("Re-applying constraints...");

        // Users FK
        await client.query(`ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)`);
        await client.query(`ALTER TABLE departments ADD CONSTRAINT departments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)`);
        await client.query(`ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)`);
        await client.query(`ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)`);
        await client.query(`ALTER TABLE transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)`);

        // Wallets FK
        await client.query(`ALTER TABLE transactions ADD CONSTRAINT transactions_from_wallet_id_fkey FOREIGN KEY (from_wallet_id) REFERENCES wallets(id)`);
        await client.query(`ALTER TABLE transactions ADD CONSTRAINT transactions_to_wallet_id_fkey FOREIGN KEY (to_wallet_id) REFERENCES wallets(id)`);
        await client.query(`ALTER TABLE transactions ADD CONSTRAINT transactions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)`);

        await client.query('COMMIT');
        console.log("Migration Complete Successfully!");

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
