import pkg from 'pg';
const { Pool } = pkg;

// Use a singleton pattern for the pool
let pool: any = null;

const getPool = () => {
    if (pool) return pool;

    if (!process.env.DATABASE_URL) {
        console.error("CRITICAL: DATABASE_URL is missing in getPool()");
        throw new Error("DATABASE_URL environment variable is not set. Check your .env file.");
    }

    console.log("Initializing DB Pool with URL length:", process.env.DATABASE_URL.length);
    
    // Create new pool
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false, // Required for Neon
        },
    });
    
    return pool;
};

// Lazy-loaded query function
export const query = async (text: string, params?: any[]) => {
  try {
      const p = getPool();
      const start = Date.now();
      const res = await p.query(text, params);
      const duration = Date.now() - start;
      // console.log('executed query', { text, duration, rows: res.rowCount });
      return res;
  } catch (err) {
      console.error('Database query error:', err);
      throw err;
  }
};

// Lazy-loaded client getter (for transactions)
export const getClient = async () => {
    const p = getPool();
    const client = await p.connect();
    return client;
};
