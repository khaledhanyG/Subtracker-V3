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
        console.log("Starting Subscriptions Semantic ID Migration...");
        await client.query('BEGIN');

        // --- Helper Function to sanitize strings ---
        const sanitize = (val: string) => {
            if (!val) return 'unknown';
            // valid: letters (any language), numbers, underscores, hyphens
            // Replace spaces with underscores
            return val.trim().replace(/\s+/g, '_');
        };

        // --- Step 1: Drop Foreign Key References ---
        // transactions(subscription_id) references subscriptions(id)
        console.log("Dropping Foreign Key constraints...");

        // We need to find the specific constraint name or just try standard ones
        // Often standard: transactions_subscription_id_fkey
        await client.query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_subscription_id_fkey`);

        // --- Step 2: Prepare Columns (UUID -> TEXT) ---
        console.log("Altering columns to TEXT...");

        // We must drop the default UUID gen first if it exists
        await client.query(`ALTER TABLE subscriptions ALTER COLUMN id DROP DEFAULT`);
        await client.query(`ALTER TABLE subscriptions ALTER COLUMN id TYPE TEXT`);
        await client.query(`ALTER TABLE transactions ALTER COLUMN subscription_id TYPE TEXT`);

        // --- Step 3: Migrate IDs ---
        console.log("Migrating Subscription IDs...");

        const subsRes = await client.query(`SELECT id, name FROM subscriptions ORDER BY created_at ASC`);

        const idMapping: Record<string, string> = {};
        const usedIds = new Set<string>();

        for (const sub of subsRes.rows) {
            const oldId = sub.id;
            let baseId = `id_${sanitize(sub.name)}`;
            let newId = baseId;
            let counter = 1;

            // Handle Duplicates
            while (usedIds.has(newId)) {
                newId = `${baseId}_${counter}`;
                counter++;
            }

            usedIds.add(newId);
            idMapping[oldId] = newId;

            console.log(`Sub: ${oldId} -> ${newId}`);

            // Update Subscriptions Table
            await client.query(`UPDATE subscriptions SET id = $1 WHERE id = $2`, [newId, oldId]);
        }

        // --- Step 4: Update Transactions References ---
        console.log("Updating Transactions References...");

        // Since we updated the constraints to TEXT already, we can just update the values.
        // Wait, we updated subscriptions.id values, but transactions.subscription_id still has old UUIDs.
        // We need to update them using the mapping.

        for (const [oldId, newId] of Object.entries(idMapping)) {
            await client.query(`UPDATE transactions SET subscription_id = $1 WHERE subscription_id = $2`, [newId, oldId]);
        }

        // --- Step 5: Restore Foreign Key ---
        console.log("Restoring Foreign Key...");
        await client.query(`ALTER TABLE transactions ADD CONSTRAINT transactions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)`);

        await client.query('COMMIT');
        console.log("Subscriptions Migration Complete Successfully!");

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
