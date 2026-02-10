import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db/index.js';

export default async function (req: VercelRequest, res: VercelResponse) {
  const secret = (req.query && (req.query as any).secret) || req.headers['x-diag-secret'];
  if (!process.env.DIAG_SECRET || secret !== process.env.DIAG_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await query('SELECT NOW() as now');
    return res.status(200).json({ ok: true, now: result.rows[0].now });
  } catch (error) {
    console.error('Debug DB error:', error);
    return res.status(500).json({ error: String(error) });
  }
}
