import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db/index.js';
import { authenticated } from '../lib/auth.js';

const handler = async (req: VercelRequest, res: VercelResponse, user: any) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = user.userId;

    let [wallets, subscriptions, transactions, departments, accounts] = await Promise.all([
      query(`
        SELECT 
          id, user_id, name, type, balance, status, 
          holder_name as "holderName", 
          created_at 
        FROM wallets WHERE user_id = $1 ORDER BY created_at
      `, [userId]),
      query(`
        SELECT 
          id, user_id, name, 
          base_amount as "baseAmount", 
          billing_cycle as "billingCycle", 
          user_count as "userCount", 
          notes, status,
          allocation_type as "allocationType", 
          departments, 
          account_allocation_type as "accountAllocationType", 
          accounts,
          start_date as "startDate", 
          next_renewal_date as "nextRenewalDate", 
          last_payment_date as "lastPaymentDate", 
          last_payment_amount as "lastPaymentAmount",
          created_at
        FROM subscriptions WHERE user_id = $1 ORDER BY created_at
      `, [userId]),
      query(`
        SELECT 
          id, user_id, date, amount, type, description, 
          from_wallet_id as "fromWalletId", 
          to_wallet_id as "toWalletId", 
          subscription_id as "subscriptionId", 
          vat_amount as "vatAmount",
          created_at
        FROM transactions WHERE user_id = $1 ORDER BY date DESC
      `, [userId]),
      query('SELECT * FROM departments WHERE user_id = $1 ORDER BY created_at', [userId]),
      query('SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at', [userId])
    ]);

    // Auto-create Main Wallet if it doesn't exist
    if (!wallets.rows.find((w: any) => w.type === 'MAIN')) {
      console.log("Creating default MAIN wallet for user", userId);
      const mainWalletRes = await query(
        "INSERT INTO wallets (user_id, name, type, balance, status) VALUES ($1, 'Main Company Wallet', 'MAIN', 0, 'ACTIVE') RETURNING *",
        [userId]
      );
      // Add the new wallet to the list
      wallets.rows.push(mainWalletRes.rows[0]);
    }

    return res.status(200).json({
      wallets: wallets.rows,
      subscriptions: subscriptions.rows,
      transactions: transactions.rows,
      departments: departments.rows,
      accounts: accounts.rows
    });
  } catch (error) {
    console.error('Data fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default authenticated(handler);
