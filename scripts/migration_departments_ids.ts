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
        console.log("Starting Departments Semantic ID Migration...");
        await client.query('BEGIN');

        // --- Helper Function to sanitize strings ---
        const sanitize = (val: string) => {
            if (!val) return 'unknown';
            return val.replace(/[^a-zA-Z0-9]/g, '_');
        };

        // --- Step 1: Drop Constraints (if any) ---
        // Departments themselves don't have many incoming FKs enforced by SQL in this schema,
        // but let's be safe. References are mostly JSONB in subscriptions.
        // We do need to drop the constraint if it exists, though typically JSONB doesn't have FKs.
        // Check schema.sql: no explicit FK to departments.id.

        // --- Step 2: Migrate DEPARTMENTS (UUID -> TEXT: id_<name>) ---
        console.log("Migrating Departments...");

        // 2a. Alter ID columns to TEXT
        await client.query(`ALTER TABLE departments ALTER COLUMN id TYPE TEXT`);

        // 2b. Map Old UUIDs to New Semantic IDs
        const depsRes = await client.query(`SELECT id, name FROM departments`);

        const idMapping: Record<string, string> = {};

        for (const dep of depsRes.rows) {
            const oldId = dep.id;
            const newId = `id_${sanitize(dep.name)}`;
            idMapping[oldId] = newId;

            console.log(`Department: ${oldId} -> ${newId}`);

            // Update Departments Table
            await client.query(`UPDATE departments SET id = $1 WHERE id = $2`, [newId, oldId]);
        }

        // --- Step 3: Update Subscriptions JSONB ---
        console.log("Updating Subscriptions Reference (JSONB)...");

        const subsRes = await client.query(`SELECT id, departments FROM subscriptions`);

        for (const sub of subsRes.rows) {
            let departmentsJSON = sub.departments;

            // It might be a string due to driver, or object
            if (typeof departmentsJSON === 'string') {
                departmentsJSON = JSON.parse(departmentsJSON);
            }

            if (Array.isArray(departmentsJSON) && departmentsJSON.length > 0) {
                let updated = false;
                const newDepartments = departmentsJSON.map((d: any) => {
                    if (idMapping[d.departmentId]) {
                        updated = true;
                        return { ...d, departmentId: idMapping[d.departmentId] };
                    }
                    return d;
                });

                if (updated) {
                    console.log(`Updating Subscription ${sub.id} departments JSON...`);
                    await client.query(`UPDATE subscriptions SET departments = $1 WHERE id = $2`, [JSON.stringify(newDepartments), sub.id]);
                }
            }
        }

        await client.query('COMMIT');
        console.log("Departments Migration Complete Successfully!");

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
