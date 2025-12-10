import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db/index';
import { authenticated } from '../lib/auth';

const handler = async (req: VercelRequest, res: VercelResponse, user: any) => {
  const userId = user.userId;

  try {
    if (req.method === 'POST') {
      const { name, color } = req.body;
      const result = await query(
        'INSERT INTO departments (user_id, name, color) VALUES ($1, $2, $3) RETURNING *',
        [userId, name, color]
      );
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await query('DELETE FROM departments WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
      return res.status(500).json({ error: 'server error'});
  }
};

export default authenticated(handler);
