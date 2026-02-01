import { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { query } from '../../db/index.js';
import { authenticated } from '../../lib/auth.js';

const handler = async (req: VercelRequest, res: VercelResponse, user: { userId: string, email: string }) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, password } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Update Name
    updates.push(`name = $${paramIndex}`);
    values.push(name);
    paramIndex++;

    // Update Password if provided
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex}`);
      values.push(hashedPassword);
      paramIndex++;
    }

    values.push(user.userId);
    const queryText = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email`;

    const result = await query(queryText, values);
    
    if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = result.rows[0];

    return res.status(200).json({ 
        message: 'Profile updated successfully',
        user: updatedUser 
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export default authenticated(handler);
