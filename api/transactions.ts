import { VercelRequest, VercelResponse } from '@vercel/node';
import { getClient } from '../db/index.js';
import { authenticated } from '../lib/auth.js';

const handler = async (req: VercelRequest, res: VercelResponse, user: any) => {
  let client;
  const userId = user.userId;

  try {
    client = await getClient();

    // --- POST: Create Transaction ---
    if (req.method === 'POST') {
      const {
        amount, type, description, date,
        fromWalletId, toWalletId, subscriptionId, vatAmount, nextRenewalDate
      } = req.body;

      try {
        await client.query('BEGIN');

        // 1. Create Transaction Record
        const txResult = await client.query(
          `INSERT INTO transactions (
            user_id, amount, type, description, date,
            from_wallet_id, to_wallet_id, subscription_id, vat_amount,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *
          `,
          [userId, amount, type, description, date, fromWalletId, toWalletId, subscriptionId, vatAmount]
        );
        const transaction = txResult.rows[0];

        // 2. Handle Wallet Balance Updates based on Type
        if (type === 'DEPOSIT_FROM_BANK') {
          if (!toWalletId) throw new Error("Target wallet ID is required for deposits");
          await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2 AND user_id = $3', [amount, toWalletId, userId]);
        } else if (type === 'INTERNAL_TRANSFER') {
          if (fromWalletId && toWalletId) {
            await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2 AND user_id = $3', [amount, fromWalletId, userId]);
            await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2 AND user_id = $3', [amount, toWalletId, userId]);
          }
        } else if (type === 'SUBSCRIPTION_PAYMENT') {
          if (fromWalletId && subscriptionId) {
            await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2 AND user_id = $3', [amount, fromWalletId, userId]);

            // SYNC: Update Last Payment Date
            await client.query(`
                    UPDATE subscriptions
                    SET last_payment_date = (
                        SELECT MAX(date) FROM transactions
                        WHERE subscription_id = $1 AND type = 'SUBSCRIPTION_PAYMENT'
                    )
                    WHERE id = $1
                `, [subscriptionId]);

            // Update Next Renewal Date if provided
            if (nextRenewalDate) {
              await client.query(
                'UPDATE subscriptions SET next_renewal_date = $1 WHERE id = $2 AND user_id = $3',
                [nextRenewalDate, subscriptionId, userId]
              );
            }
          }
        } else if (type === 'REFUND') {
          if (toWalletId && subscriptionId) {
            await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2 AND user_id = $3', [amount, toWalletId, userId]);
          }
        }

        await client.query('COMMIT');
        return res.status(200).json(transaction);
      } catch (e: any) {
        await client.query('ROLLBACK');
        console.error("Create Transaction Error:", e);
        return res.status(500).json({ error: e.message || String(e) });
      }
    }

    // --- GET: List Transactions ---
    else if (req.method === 'GET') {
      try {
        const result = await client.query(
          `SELECT 
              t.id, t.user_id, t.date, t.amount, t.type, t.description, 
              t.from_wallet_id as "fromWalletId", 
              t.to_wallet_id as "toWalletId", 
              t.subscription_id as "subscriptionId",
              t.vat_amount as "vatAmount",
              w.name as "walletName",
              s.name as "subscriptionName"
            FROM transactions t
            LEFT JOIN wallets w ON t.from_wallet_id = w.id OR t.to_wallet_id = w.id
            LEFT JOIN subscriptions s ON t.subscription_id = s.id
            WHERE t.user_id = $1
            ORDER BY t.date DESC`,
          [userId]
        );
        return res.status(200).json({ transactions: result.rows });
      } catch (e: any) {
        console.error("Get Transactions Error:", e);
        return res.status(500).json({ error: e.message });
      }
    }

    // --- PUT: Edit Transaction ---
    else if (req.method === 'PUT') {
      const { id, amount, date, fromWalletId, toWalletId, subscriptionId } = req.body;
      console.log("PUT /transactions Payload:", JSON.stringify(req.body));

      try {
        await client.query('BEGIN');

        // 1. Get Old Transaction for Logic Reversal
        const oldTxResult = await client.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
        if (oldTxResult.rows.length === 0) {
          throw new Error("Transaction not found");
        }
        const oldTx = oldTxResult.rows[0];

        // 2. Revert Old Balance Effects
        if (oldTx.type === 'SUBSCRIPTION_PAYMENT') {
          await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [oldTx.amount, oldTx.from_wallet_id]);
        } else if (oldTx.type === 'REFUND') {
          await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [oldTx.amount, oldTx.to_wallet_id]);
        }

        // 3. Update Transaction Record
        const newAmount = amount !== undefined ? amount : oldTx.amount;
        const newDate = date !== undefined ? date : oldTx.date;
        const newFrom = fromWalletId !== undefined ? (fromWalletId || null) : oldTx.from_wallet_id;
        const newTo = toWalletId !== undefined ? (toWalletId || null) : oldTx.to_wallet_id;
        const newSub = subscriptionId !== undefined ? (subscriptionId || null) : oldTx.subscription_id;

        await client.query(
          `UPDATE transactions 
             SET amount = $1, date = $2, from_wallet_id = $3, to_wallet_id = $4, subscription_id = $5 
             WHERE id = $6 AND user_id = $7`,
          [newAmount, newDate, newFrom, newTo, newSub, id, userId]
        );

        // 4. Apply New Balance Effects
        if (oldTx.type === 'SUBSCRIPTION_PAYMENT') {
          if (newFrom) {
            await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [newAmount, newFrom]);
          }
        } else if (oldTx.type === 'REFUND') {
          if (newTo) {
            await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [newAmount, newTo]);
          }
        }

        // 5. Sync Last Payment Date
        const targetSubId = newSub || oldTx.subscription_id;
        if (targetSubId) {
          await client.query(`
                  UPDATE subscriptions
                  SET last_payment_date = (
                      SELECT MAX(date) FROM transactions
                      WHERE subscription_id = $1 AND type = 'SUBSCRIPTION_PAYMENT'
                  )
                  WHERE id = $1
              `, [targetSubId]);
        }

        await client.query('COMMIT');
        return res.status(200).json({ success: true });
      } catch (e: any) {
        await client.query('ROLLBACK');
        console.error("Update Transaction Error:", e);
        return res.status(500).json({ error: e.message || String(e), stack: e.stack });
      }
    }

    // --- DELETE: Delete Transaction ---
    else if (req.method === 'DELETE') {
      const { id } = req.query;
      try {
        await client.query('BEGIN');

        const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
        if (txRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: "Not found" });
        }
        const tx = txRes.rows[0];

        // Revert Balance
        if (tx.type === 'SUBSCRIPTION_PAYMENT') {
          await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [tx.amount, tx.from_wallet_id]);
        } else if (tx.type === 'REFUND') {
          await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [tx.amount, tx.to_wallet_id]);
        }

        await client.query('DELETE FROM transactions WHERE id = $1', [id]);

        // Sync Last Payment Date
        if (tx.subscription_id) {
          await client.query(`
                   UPDATE subscriptions
                   SET last_payment_date = (
                       SELECT MAX(date) FROM transactions
                       WHERE subscription_id = $1 AND type = 'SUBSCRIPTION_PAYMENT'
                   )
                   WHERE id = $1
               `, [tx.subscription_id]);
        }

        await client.query('COMMIT');
        return res.status(200).json({ success: true });
      } catch (e: any) {
        await client.query('ROLLBACK');
        console.error("Delete Transaction Error:", e);
        return res.status(500).json({ error: e.message || String(e) });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Transactions API Top-Level Error:', error);
    return res.status(500).json({ error: `Server Error: ${error.message}` });
  } finally {
    if (client) client.release();
  }
};

export default authenticated(handler);
