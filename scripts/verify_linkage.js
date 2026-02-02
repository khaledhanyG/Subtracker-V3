import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pg = require('pg');

const connectionString = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();

    console.log("Checking for orphaned subscription IDs...");

    const txRes = await client.query('SELECT DISTINCT subscription_id FROM transactions WHERE subscription_id IS NOT NULL');
    const txSubIds = txRes.rows.map(r => r.subscription_id);
    console.log(`Found ${txSubIds.length} distinct subscription IDs in transactions.`);

    const subRes = await client.query('SELECT id, name FROM subscriptions');
    const validSubIds = new Set(subRes.rows.map(r => r.id));
    console.log(`Found ${validSubIds.size} valid subscriptions in DB.`);

    const orphans = txSubIds.filter(id => !validSubIds.has(id));

    if (orphans.length > 0) {
        console.log("WARNING: Found orphaned subscription IDs (in transactions but not in subscriptions):");
        console.log(orphans);
    } else {
        console.log("SUCCESS: All transaction subscription IDs are valid and exist in subscriptions table.");
    }

    // Debug one valid match just to be sure of string format
    if (txSubIds.length > 0) {
        const sample = txSubIds[0];
        if (validSubIds.has(sample)) {
            console.log(`Verified match for ID: "${sample}"`);
        }
    }

    await client.end();
}
run();
