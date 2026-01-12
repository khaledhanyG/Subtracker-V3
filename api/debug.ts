import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db/index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const envStatus = {
      hasDbUrl: !!process.env.DATABASE_URL,
      dbUrlLength: process.env.DATABASE_URL?.length || 0,
    };

    const start = Date.now();
    const result = await query('SELECT NOW() as time');
    const duration = Date.now() - start;

    return res.status(200).json({
      status: 'ok',
      message: 'Database connection successful',
      time: result.rows[0].time,
      duration,
      env: envStatus
    });
  } catch (error: any) {
    console.error("Debug Endpoint Error:", error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL
      }
    });
  }
}
