
import { VercelRequest, VercelResponse } from '@vercel/node';

export default (req: VercelRequest, res: VercelResponse) => {
    res.json({
        version: "1.0.1",
        timestamp: new Date().toISOString(),
        features: [
            "Fix 500 Error",
            "Sync logic enabled",
            "Backfill API"
        ]
    });
};
