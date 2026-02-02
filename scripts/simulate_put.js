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
    console.log("Simulating PUT...");

    // Mock Request Body - simulating what frontend sends for a DATE update
    // User ID from debug_transaction.js
    const userId = 'id_AdminL';
    const txId = 6751;
    const amount = "80000";
    const date = "2025-12-29"; // Changed date
    const description = "Bank Deposit";
    const toWalletId = 'id_Main_Company_Wallet';
    const fromWalletId = undefined; // Not sent for deposit
    const subscriptionId = undefined;

    try {
        await client.query('BEGIN');

        // Logic from api/transactions.ts
        const txResult = await client.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [txId, userId]);
        if (txResult.rowCount === 0) throw new Error("Tx not found");
        const oldTx = txResult.rows[0];
        const oldAmount = parseFloat(oldTx.amount);

        console.log("Old Tx found:", oldTx);

        // 2. Revert Original Effect
        console.log("Reverting...");
        if (oldTx.type === 'DEPOSIT_FROM_BANK') {
            if (oldTx.to_wallet_id) {
                await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [oldAmount, oldTx.to_wallet_id]);
            }
        }
        // ... other types omitted for this test case

        // 3. Determine Final Values
        const finalAmount = amount !== undefined ? parseFloat(amount) : parseFloat(oldTx.amount);
        const finalDate = date !== undefined ? date : oldTx.date;
        const finalDescription = description !== undefined ? description : oldTx.description;
        const finalFromWalletId = fromWalletId !== undefined ? fromWalletId : oldTx.from_wallet_id;
        const finalToWalletId = toWalletId !== undefined ? toWalletId : oldTx.to_wallet_id;
        const finalSubId = subscriptionId !== undefined ? subscriptionId : oldTx.subscription_id;

        console.log("Final Values:", { finalAmount, finalDate, finalToWalletId });

        // 4. Update Transaction Record
        console.log("Updating Tx Record...");
        await client.query(
            `UPDATE transactions SET 
               amount = $1, 
               date = $2, 
               description = $3,
               from_wallet_id = $4,
               to_wallet_id = $5,
               subscription_id = $6
             WHERE id = $7 AND user_id = $8`,
            [
                finalAmount,
                finalDate,
                finalDescription,
                finalFromWalletId,
                finalToWalletId,
                finalSubId,
                txId,
                userId
            ]
        );

        // 5. Apply New Effect
        console.log("Applying New Effect...");
        const txType = oldTx.type; // Assuming type doesn't change
        if (txType === 'DEPOSIT_FROM_BANK') {
            if (!finalToWalletId) throw new Error("Target wallet ID required");
            await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [finalAmount, finalToWalletId]);
        }

        await client.query('ROLLBACK'); // Rollback test
        console.log("SUCCESS: Simulation validated (Rolled back).");

    } catch (e) {
        console.error("ERROR:", e);
        await client.query('ROLLBACK');
    }

    await client.end();
}
run();
