import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db/index';
import { authenticated } from '../lib/auth';

const handler = async (req: VercelRequest, res: VercelResponse, user: any) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = user.userId;

    const [wallets, subscriptions, transactions, departments, accounts] = await Promise.all([
      query('SELECT * FROM wallets WHERE user_id = $1 ORDER BY created_at', [userId]),
      query('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at', [userId]),
      query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC', [userId]),
      query('SELECT * FROM departments WHERE user_id = $1 ORDER BY created_at', [userId]),
      query('SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at', [userId])
    ]);

    return res.status(200).json({
      wallets: wallets.rows,
      subscriptions: subscriptions.rows,
      transactions: transactions.rows,
      departments: departments.rows,
      accounts: accounts.rows
    });
  } catch (error) {
    console.error('Data fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default authenticated(handler);
