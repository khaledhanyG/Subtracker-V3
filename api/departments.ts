import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db/index.js';
import { authenticated } from '../lib/auth.js';

const handler = async (req: VercelRequest, res: VercelResponse, user: any) => {
  const userId = user.userId;

  try {
    if (req.method === 'POST') {
      const { name, color } = req.body;
      const id = `id_${name.replace(/[^a-zA-Z0-9]/g, '_')}`; // Generate Semantic ID

      const result = await query(
        'INSERT INTO departments (id, user_id, name, color) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, userId, name, color]
      );
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await query('DELETE FROM departments WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};

export default authenticated(handler);
