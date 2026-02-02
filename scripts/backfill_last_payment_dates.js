
import pg from 'pg';
const { Client } = pg;

const CONNECTION_STRING = "postgres://neondb_owner:npg_6r8MOKbYtqXh@ep-withered-cake-a2tq9364-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";

async function backfillLastPaymentDates() {
    const client = new Client({
        connectionString: CONNECTION_STRING,
    });

    try {
        await client.connect();
        console.log('Connected to DB. Starting backfill...');

        // 1. Get all subscriptions
        const subsResult = await client.query('SELECT id, name FROM subscriptions');
        const subs = subsResult.rows;
        console.log(`Found ${subs.length} subscriptions.`);

        let updatedCount = 0;

        for (const sub of subs) {
            // 2. Find latest payment transaction for this sub
            const txResult = await client.query(`
        SELECT date 
        FROM transactions 
        WHERE subscription_id = $1 
          AND type = 'SUBSCRIPTION_PAYMENT'
        ORDER BY date DESC 
        LIMIT 1
      `, [sub.id]);

            if (txResult.rows.length > 0) {
                const lastDate = txResult.rows[0].date;

                // 3. Update subscription
                await client.query(`
          UPDATE subscriptions 
          SET last_payment_date = $1 
          WHERE id = $2
        `, [lastDate, sub.id]);

                updatedCount++;
            }
        }

        console.log(`Successfully updated ${updatedCount} subscriptions with historical payment dates.`);

    } catch (e) {
        console.error('Error during backfill:', e);
    } finally {
        await client.end();
        process.exit(0);
    }
}

backfillLastPaymentDates();
