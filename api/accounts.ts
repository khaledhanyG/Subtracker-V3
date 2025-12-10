import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db';
import { authenticated } from '../lib/auth';

const handler = async (req: VercelRequest, res: VercelResponse, user: any) => {
  const userId = user.userId;

  try {
    if (req.method === 'POST') {
      const { name, code } = req.body;
      const result = await query(
        'INSERT INTO accounts (user_id, name, code) VALUES ($1, $2, $3) RETURNING *',
        [userId, name, code]
      );
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
      return res.status(500).json({ error: 'server error'});
  }
};

export default authenticated(handler);
