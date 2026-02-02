import { VercelRequest, VercelResponse } from '@vercel/node';
import { getClient } from '../db/index.js';
import { authenticated } from '../lib/auth.js';

const handler = async (req: VercelRequest, res: VercelResponse, user: any) => {
  const userId = user.userId;
  const client = await getClient();

  try {
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
            from_wallet_id, to_wallet_id, subscription_id, vat_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
          RETURNING 
            id, user_id, date, amount, type, description, 
            from_wallet_id as "fromWalletId", 
            to_wallet_id as "toWalletId", 
            subscription_id as "subscriptionId", 
            vat_amount as "vatAmount",
            created_at
          [userId, amount, type, description, date, fromWalletId, toWalletId, subscriptionId, vatAmount]
        );
        const transaction = txResult.rows[0];

        // 2. Handle Wallet Balance Updates based on Type
        if (type === 'DEPOSIT_FROM_BANK') {
          if (!toWalletId) {
            throw new Error("Target wallet ID is required for deposits");
          }
          await client.query(
            'UPDATE wallets SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
            [amount, toWalletId, userId]
          );
        } else if (type === 'INTERNAL_TRANSFER') {
          if (fromWalletId && toWalletId) {
            // Deduct from source
            await client.query(
              'UPDATE wallets SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
              [amount, fromWalletId, userId]
            );
            // Add to dest
            await client.query(
              'UPDATE wallets SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
              [amount, toWalletId, userId]
            );
          }
        } else if (type === 'SUBSCRIPTION_PAYMENT') {
          if (fromWalletId && subscriptionId) {
            // Deduct from wallet
            await client.query(
              'UPDATE wallets SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
              [amount, fromWalletId, userId]
            );

            // Update Subscription Last Payment & Renewal
            // If nextRenewalDate is provided, update it.
            if (nextRenewalDate) {
              await client.query(
                `UPDATE subscriptions SET 
                      last_payment_date = $1,
          last_payment_amount = $2,
          next_renewal_date = $3
                    WHERE id = $4 AND user_id = $5`,
                [date, amount, nextRenewalDate, subscriptionId, userId]
              );
            } else {
              await client.query(
                `UPDATE subscriptions SET 
                      last_payment_date = $1,
          last_payment_amount = $2
                    WHERE id = $3 AND user_id = $4`,
                [date, amount, subscriptionId, userId]
              );
            }
          }
        } else if (type === 'REFUND') {
          if (toWalletId) {
            await client.query(
              'UPDATE wallets SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
              [amount, toWalletId, userId]
            );
          }
        }

        await client.query('COMMIT');
        return res.status(201).json(transaction);

      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    // Handle EDIT (PUT)
    if (req.method === 'PUT') {
      const { id, amount, date, description, fromWalletId, toWalletId, type } = req.body;

      try {
        await client.query('BEGIN');

        // 1. Get original transaction
        const txResult = await client.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
        if (txResult.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Transaction not found' });
        }
        const oldTx = txResult.rows[0];
        const oldAmount = parseFloat(oldTx.amount);

        // 2. Revert Original Effect
        if (oldTx.type === 'DEPOSIT_FROM_BANK') {
          if (oldTx.to_wallet_id) {
            await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [oldAmount, oldTx.to_wallet_id]);
          }
        } else if (oldTx.type === 'INTERNAL_TRANSFER') {
          if (oldTx.from_wallet_id && oldTx.to_wallet_id) {
            await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [oldAmount, oldTx.from_wallet_id]);
            await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [oldAmount, oldTx.to_wallet_id]);
          }
        } else if (oldTx.type === 'SUBSCRIPTION_PAYMENT') {
          if (oldTx.from_wallet_id) {
            await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [oldAmount, oldTx.from_wallet_id]);
          }
        } else if (oldTx.type === 'REFUND') {
          if (oldTx.to_wallet_id) {
            await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [oldAmount, oldTx.to_wallet_id]);
          }
        }

        // 3. Determine Final Values (Merge oldTx with updates)
        const finalAmount = amount !== undefined ? parseFloat(amount) : parseFloat(oldTx.amount);
        const finalDate = date !== undefined ? date : oldTx.date;
        const finalDescription = description !== undefined ? description : oldTx.description;
        const finalFromWalletId = fromWalletId !== undefined ? fromWalletId : oldTx.from_wallet_id;
        const finalToWalletId = toWalletId !== undefined ? toWalletId : oldTx.to_wallet_id;
        const finalSubId = req.body.subscriptionId !== undefined ? req.body.subscriptionId : oldTx.subscription_id;

        // 4. Update Transaction Record
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
            id,
            userId
          ]
        );

        // 5. Apply New Effect
        const txType = type || oldTx.type;

        if (txType === 'DEPOSIT_FROM_BANK') {
          if (!finalToWalletId) throw new Error("Target wallet ID required");
          await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [finalAmount, finalToWalletId]);
        } else if (txType === 'INTERNAL_TRANSFER') {
          if (!finalFromWalletId || !finalToWalletId) throw new Error("Source and Dest wallets required");
          await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [finalAmount, finalFromWalletId]);
          await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [finalAmount, finalToWalletId]);
        } else if (txType === 'SUBSCRIPTION_PAYMENT') {
          if (!finalFromWalletId) throw new Error("Source wallet ID required for payment");
          await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [finalAmount, finalFromWalletId]);
        } else if (txType === 'REFUND') {
          if (!finalToWalletId) throw new Error("Target wallet ID required for refund");
          await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [finalAmount, finalToWalletId]);
        }

        // 6. SYNC Logic: Update Subscription Last Payment Date
        if (finalSubId) {
             await client.query(`
                UPDATE subscriptions
                SET last_payment_date = (
          SELECT MAX(date)
                    FROM transactions
                    WHERE subscription_id = $1
                    AND type = 'SUBSCRIPTION_PAYMENT'
        )
                WHERE id = $1
          `, [finalSubId]);
        }
        if (oldTx.subscription_id && oldTx.subscription_id !== finalSubId) {
            await client.query(`
                UPDATE subscriptions
                SET last_payment_date = (
          SELECT MAX(date)
                    FROM transactions
                    WHERE subscription_id = $1
                    AND type = 'SUBSCRIPTION_PAYMENT'
                )
                WHERE id = $1
  `, [oldTx.subscription_id]);
        }

        await client.query('COMMIT');

        // Return updated
        const updatedTx = await client.query(`
SELECT
id, user_id, date, amount, type, description,
  from_wallet_id as "fromWalletId",
  to_wallet_id as "toWalletId",
  subscription_id as "subscriptionId",
  vat_amount as "vatAmount",
  created_at
          FROM transactions WHERE id = $1
  `, [id]);
        return res.status(200).json(updatedTx.rows[0]);

      } catch (e: any) {
        await client.query('ROLLBACK');
        console.error("Update Transaction Error:", e);
        return res.status(500).json({ error: e.message || String(e) });
      }
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;

      try {
        await client.query('BEGIN');

        // Get original transaction
        const txResult = await client.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
        if (txResult.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Transaction not found' });
        }
        const tx = txResult.rows[0];
        const amount = parseFloat(tx.amount); // Ensure number

        // Reverse effects
        if (tx.type === 'DEPOSIT_FROM_BANK') {
          await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [amount, tx.to_wallet_id]);
        } else if (tx.type === 'INTERNAL_TRANSFER') {
          await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [amount, tx.from_wallet_id]);
          await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [amount, tx.to_wallet_id]);
        } else if (tx.type === 'SUBSCRIPTION_PAYMENT') {
          await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [amount, tx.from_wallet_id]);
          // Should we revert subscription dates? Hard to know what previous date was. 
          // For now, only revert money.
        } else if (tx.type === 'REFUND') {
          await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [amount, tx.to_wallet_id]);
        }

        await client.query('DELETE FROM transactions WHERE id = $1', [id]);

        // SYNC Logic
        if (tx.subscription_id) {
            await client.query(`
                UPDATE subscriptions
                SET last_payment_date = (
  SELECT MAX(date)
                    FROM transactions
                    WHERE subscription_id = $1
                    AND type = 'SUBSCRIPTION_PAYMENT'
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
    console.error('Transactions API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  } finally {
    client.release();
  }
};

export default authenticated(handler);
