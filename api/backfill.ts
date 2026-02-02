
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getClient } from '../db/index.js';

export default async (req: VercelRequest, res: VercelResponse) => {
    const client = await getClient();

    try {
        const subsResult = await client.query('SELECT id, name FROM subscriptions');
        const subs = subsResult.rows;
        let updatedCount = 0;

        for (const sub of subs) {
            const txResult = await client.query(`
        SELECT date 
        FROM transactions 
        WHERE subscription_id = $1 
          AND type = 'SUBSCRIPTION_PAYMENT'
        ORDER BY date DESC 
        LIMIT 1
      `, [sub.id]);

            if (txResult.rows.length > 0) {
                const lastDate = txResult.rows[0].date;
                await client.query(`
          UPDATE subscriptions 
          SET last_payment_date = $1 
          WHERE id = $2
        `, [lastDate, sub.id]);
                updatedCount++;
            }
        }

        res.json({ success: true, updated: updatedCount, total: subs.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
};
