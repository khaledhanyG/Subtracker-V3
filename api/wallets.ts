import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db/index.js';
import { authenticated } from '../lib/auth.js';

const handler = async (req: VercelRequest, res: VercelResponse, user: any) => {
  const userId = user.userId;

  try {
    if (req.method === 'POST') {
      const { action } = req.body;

      // RECONCILE BALANCES LOGIC
      if (action === 'RECONCILE') {
        // 1. Recalculate balances for ALL wallets based on transaction history
        // If a wallet has no transactions, its balance becomes 0.
        const reconcileQuery = `
          UPDATE wallets w
          SET balance = COALESCE((
            SELECT SUM(
              CASE 
                WHEN t.to_wallet_id = w.id THEN t.amount 
                WHEN t.from_wallet_id = w.id THEN -t.amount 
                ELSE 0 
              END
            )
            FROM transactions t
            WHERE (t.to_wallet_id = w.id OR t.from_wallet_id = w.id)
          ), 0)
          WHERE w.user_id = $1
          RETURNING *;
        `;

        const result = await query(reconcileQuery, [userId]);
        await query('COMMIT');
        return res.status(200).json(result.rows);
      }

      // Normal Create Wallet
      const { name, type, balance, holderName, status } = req.body;
      const result = await query(
        'INSERT INTO wallets (user_id, name, type, balance, holder_name, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [userId, name, type, balance || 0, holderName, status || 'ACTIVE']
      );
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      // Construct dynamic update query
      const keys = Object.keys(updates);
      if (keys.length === 0) return res.status(400).json({ error: 'No updates provided' });

      const setClause = keys.map((key, index) => `${key === 'holderName' ? 'holder_name' : key} = $${index + 2}`).join(', ');
      const values = keys.map(key => updates[key]);

      const result = await query(
        `UPDATE wallets SET ${setClause} WHERE id = $1 AND user_id = $${keys.length + 2} RETURNING *`,
        [id, ...values, userId]
      );
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await query('DELETE FROM wallets WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Wallets API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default authenticated(handler);
