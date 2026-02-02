-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- WALLETS TABLE
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'MAIN' or 'EMPLOYEE'
  balance DECIMAL(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  holder_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  base_amount DECIMAL(15, 2) NOT NULL,
  billing_cycle TEXT NOT NULL,
  user_count INTEGER DEFAULT 1,
  notes TEXT,
  status TEXT DEFAULT 'ACTIVE',
  
  -- Allocation Logic stored as JSONB for flexibility
  allocation_type TEXT DEFAULT 'SINGLE',
  departments JSONB DEFAULT '[]', -- Array of {departmentId, percentage}
  
  account_allocation_type TEXT DEFAULT 'SINGLE',
  accounts JSONB DEFAULT '[]', -- Array of {accountId, percentage}
  
  start_date DATE,
  next_renewal_date DATE,
  last_payment_date DATE,
  last_payment_amount DECIMAL(15, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  amount DECIMAL(15, 2) NOT NULL,
  type TEXT NOT NULL, -- 'DEPOSIT_FROM_BANK', 'INTERNAL_TRANSFER', 'SUBSCRIPTION_PAYMENT', 'REFUND'
  
  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id UUID REFERENCES wallets(id),
  
  subscription_id UUID REFERENCES subscriptions(id),
  
  description TEXT,
  vat_amount DECIMAL(15, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- IN DEXES for performance
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
