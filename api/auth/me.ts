import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../../db/index.js';
import { authenticated } from '../../lib/auth.js';

const handler = async (req: VercelRequest, res: VercelResponse, userPayload: { userId: string, email: string }) => {
  try {
    const result = await query('SELECT id, name, email FROM users WHERE id = $1', [userPayload.userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    return res.status(200).json({ 
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (error: any) {
    console.error('Get me error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export default authenticated(handler);
