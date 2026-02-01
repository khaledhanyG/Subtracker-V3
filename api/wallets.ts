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
        await query('BEGIN');

        // 1. Reset all wallets to 0 (optional if the next query handles everything, but safer to be explicit conceptually, though SQL below covers it)
        // 2. Calculate sum input/output for each wallet
        const reconcileQuery = `
          WITH wallet_sums AS (
            SELECT 
              w.id,
              COALESCE(SUM(
                CASE 
                  WHEN t.to_wallet_id = w.id THEN t.amount 
                  WHEN t.from_wallet_id = w.id THEN -t.amount 
                  ELSE 0 
                END
              ), 0) as computed_balance
            FROM wallets w
            LEFT JOIN transactions t ON (t.from_wallet_id = w.id OR t.to_wallet_id = w.id)
            WHERE w.user_id = $1
            GROUP BY w.id
          )
          UPDATE wallets
          SET balance = wallet_sums.computed_balance
          FROM wallet_sums
          WHERE wallets.id = wallet_sums.id AND wallets.user_id = $1
          RETURNING wallets.*;
        `;

        const result = await query(reconcileQuery, [userId]);
        await query('COMMIT');
        return res.status(200).json(result.rows);
      }

      // Normal Create Wallet
      const { name, type, balance, holderName, status } = req.body;
      const id = `id_${name.replace(/[^a-zA-Z0-9]/g, '_')}`; // Generate Semantic ID

      const result = await query(
        'INSERT INTO wallets (id, user_id, name, type, balance, holder_name, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [id, userId, name, type, balance || 0, holderName, status || 'ACTIVE']
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
