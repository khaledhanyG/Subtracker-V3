import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { Wallets } from './components/Wallets';
import { Subscriptions } from './components/Subscriptions';
import { Departments } from './components/Departments';
import { Qoyod } from './components/Qoyod';
import { InvoiceOCR } from './components/InvoiceOCR';
import { Login } from './components/Login';
import {
  AppState,
  WalletType,
  Wallet,
  Department,
  Account,
  Subscription,
  TransactionType,
  Transaction,
  EntityStatus,
} from './types';
import {
  LayoutDashboard,
  WalletCards,
  List,
  Users,
  BookOpen,
  FileText,
  LogOut,
} from 'lucide-react';

// 🔗 لينك Google Apps Script
const GOOGLE_SCRIPT_BASE =
  'https://script.google.com/macros/s/AKfycbw8grU2D5aqxAUZ9Cvq4pTU0XM5hfplRt0cWonNyjA8x1z8UQohh7J4BmUPJiyQCRfDEw/exec';

// شكل الداتا الراجعة من Google Sheets
interface RemoteWallet {
  id: string;
  name: string;
  type: string; // 'MAIN' | 'EMPLOYEE'
  balance: number;
  holderName?: string;
  status?: string; // 'ACTIVE' | 'INACTIVE'
}

interface RemoteWalletTx {
  id: string;
  date: string;
  amount: number;
  type: string; // 'DEPOSIT_FROM_BANK' | 'INTERNAL_TRANSFER'
  fromWalletId?: string;
  toWalletId?: string;
  description?: string;
}

interface RemoteState {
  wallets?: RemoteWallet[];
  walletTransactions?: RemoteWalletTx[];
}

// الحالة الافتراضية لو مفيش داتا من جوجل شيت
const INITIAL_STATE: AppState = {
  wallets: [
    {
      id: 'main-wallet',
      name: 'Main HQ Wallet',
      type: WalletType.MAIN,
      balance: 0,
      status: EntityStatus.ACTIVE,
    },
  ],
  departments: [
    { id: 'dept-1', name: 'Marketing', color: '#3B82F6' },
    { id: 'dept-2', name: 'Engineering', color: '#10B981' },
  ],
  accounts: [
    { id: 'acc-1', name: 'Software Expenses', code: '5001' },
    { id: 'acc-2', name: 'Marketing Ads', code: '5002' },
  ],
  subscriptions: [],
  transactions: [],
};

// 🛰️ Sync Wallets + WalletTransactions → Google Sheets
const syncWalletsToGoogle = (wallets: Wallet[], transactions: Transaction[]) => {
  try {
    const walletPayload = wallets.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type === WalletType.MAIN ? 'MAIN' : 'EMPLOYEE',
      balance: w.balance,
      holderName: w.holderName || '',
      status: w.status === EntityStatus.INACTIVE ? 'INACTIVE' : 'ACTIVE',
    }));

    const txPayload = transactions
      .filter(
        (t) =>
          t.type === TransactionType.DEPOSIT_FROM_BANK ||
          t.type === TransactionType.INTERNAL_TRANSFER
      )
      .map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        type:
          t.type === TransactionType.DEPOSIT_FROM_BANK
            ? 'DEPOSIT_FROM_BANK'
            : 'INTERNAL_TRANSFER',
        fromWalletId: t.fromWalletId || '',
        toWalletId: t.toWalletId || '',
        description: t.description || '',
      }));

    fetch(GOOGLE_SCRIPT_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SAVE_WALLETS_STATE',
        wallets: walletPayload,
        walletTransactions: txPayload,
      }),
    });
  } catch (err) {
    console.error('Failed to sync wallets to Google Sheets', err);
  }
};

// 🧠 تحويل Remote → Typescript types في الأبلكيشن
const mapRemoteToState = (remote: RemoteState | null): AppState => {
  if (!remote) return INITIAL_STATE;

  const nextState: AppState = {
    ...INITIAL_STATE,
    wallets: [...INITIAL_STATE.wallets],
    departments: [...INITIAL_STATE.departments],
    accounts: [...INITIAL_STATE.accounts],
    subscriptions: [...INITIAL_STATE.subscriptions],
    transactions: [...INITIAL_STATE.transactions],
  };

  if (remote.wallets && remote.wallets.length > 0) {
    nextState.wallets = remote.wallets.map((w) => ({
      id: w.id || crypto.randomUUID(),
      name: w.name || 'Wallet',
      type: w.type === 'MAIN' ? WalletType.MAIN : WalletType.EMPLOYEE,
      balance: Number(w.balance) || 0,
      holderName: w.holderName || '',
      status: w.status === 'INACTIVE' ? EntityStatus.INACTIVE : EntityStatus.ACTIVE,
    }));
  }

  if (remote.walletTransactions && remote.walletTransactions.length > 0) {
    const txs: Transaction[] = remote.walletTransactions.map((t) => ({
      id: t.id || crypto.randomUUID(),
      date: t.date || new Date().toISOString(),
      amount: Number(t.amount) || 0,
      type:
        t.type === 'DEPOSIT_FROM_BANK'
          ? TransactionType.DEPOSIT_FROM_BANK
          : TransactionType.INTERNAL_TRANSFER,
      fromWalletId: t.fromWalletId || undefined,
      toWalletId: t.toWalletId || undefined,
      description: t.description || '',
    }));

    nextState.transactions = [...nextState.transactions, ...txs];
  }

  return nextState;
};

function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // تحميل الداتا من Google Sheets
  const [isStateLoading, setIsStateLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'wallets' | 'subscriptions' | 'departments' | 'qoyod' | 'ocr'
  >('dashboard');

  const [state, setState] = useState<AppState>(INITIAL_STATE);

  // 🟣 Check auth from localStorage (زي ما هو)
  useEffect(() => {
    const authStatus = localStorage.getItem('subtrack_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsAuthChecking(false);
  }, []);

  // 🟡 تحميل أولي من Google Sheets (GET_STATE)
  useEffect(() => {
    const loadFromGoogle = async () => {
      try {
        const res = await fetch(`${GOOGLE_SCRIPT_BASE}?action=GET_STATE`, {
          method: 'GET',
        });

        if (!res.ok) {
          console.warn('GET_STATE not ok, using INITIAL_STATE');
          setState(INITIAL_STATE);
          setIsStateLoading(false);
          return;
        }

        const data = (await res.json()) as RemoteState;
        const mapped = mapRemoteToState(data);
        setState(mapped);
      } catch (err) {
        console.error('Failed to load state from Google Sheets', err);
        setState(INITIAL_STATE);
      } finally {
        setIsStateLoading(false);
      }
    };

    loadFromGoogle();
  }, []);

  // 🟢 أي تغيير في wallets أو transactions → sync مع Google Sheets
  useEffect(() => {
    if (isStateLoading) return; // ما نعملش sync قبل أول load
    const walletTx = state.transactions.filter(
      (t) =>
        t.type === TransactionType.DEPOSIT_FROM_BANK ||
        t.type === TransactionType.INTERNAL_TRANSFER
    );
    syncWalletsToGoogle(state.wallets, walletTx);
  }, [state.wallets, state.transactions, isStateLoading]);

  const handleLogin = (success: boolean) => {
    if (success) {
      localStorage.setItem('subtrack_auth', 'true');
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('subtrack_auth');
    setIsAuthenticated(false);
  };

  // --- Actions ---

  const addWallet = (wallet: Wallet) => {
    setState((prev) => ({ ...prev, wallets: [...prev.wallets, wallet] }));
  };

  const updateWallet = (id: string, updates: Partial<Wallet>) => {
    setState((prev) => ({
      ...prev,
      wallets: prev.wallets.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    }));
  };

  const deleteWallet = (id: string) => {
    setState((prev) => ({
      ...prev,
      wallets: prev.wallets.filter((w) => w.id !== id),
    }));
  };

  const fundMainWallet = (amount: number) => {
    setState((prev) => {
      const updatedWallets = prev.wallets.map((w) =>
        w.type === WalletType.MAIN ? { ...w, balance: w.balance + amount } : w
      );
      const transaction: Transaction = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        amount,
        type: TransactionType.DEPOSIT_FROM_BANK,
        toWalletId: 'main-wallet',
        description: 'Bank Deposit',
      };
      return {
        ...prev,
        wallets: updatedWallets,
        transactions: [...prev.transactions, transaction],
      };
    });
  };

  const transferFunds = (fromId: string, toId: string, amount: number) => {
    setState((prev) => {
      const fromWallet = prev.wallets.find((w) => w.id === fromId);
      if (!fromWallet || fromWallet.balance < amount) {
        alert('Insufficient funds in source Wallet');
        return prev;
      }

      const updatedWallets = prev.wallets.map((w) => {
        if (w.id === fromId) return { ...w, balance: w.balance - amount };
        if (w.id === toId) return { ...w, balance: w.balance + amount };
        return w;
      });

      const transaction: Transaction = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        amount,
        type: TransactionType.INTERNAL_TRANSFER,
        fromWalletId: fromId,
        toWalletId: toId,
        description: 'Internal Transfer',
      };

      return {
        ...prev,
        wallets: updatedWallets,
        transactions: [...prev.transactions, transaction],
      };
    });
  };

  // Enhanced Edit Transaction
  const editTransaction = (txId: string, updates: Partial<Transaction>) => {
    setState((prev) => {
      const txIndex = prev.transactions.findIndex((t) => t.id === txId);
      if (txIndex === -1) return prev;
      const oldTx = prev.transactions[txIndex];

      let tempWallets = [...prev.wallets];

      // Revert old
      if (oldTx.type === TransactionType.DEPOSIT_FROM_BANK && oldTx.toWalletId) {
        const wIndex = tempWallets.findIndex((w) => w.id === oldTx.toWalletId);
        if (wIndex > -1) {
          tempWallets[wIndex] = {
            ...tempWallets[wIndex],
            balance: tempWallets[wIndex].balance - oldTx.amount,
          };
        }
      } else if (
        oldTx.type === TransactionType.INTERNAL_TRANSFER &&
        oldTx.fromWalletId &&
        oldTx.toWalletId
      ) {
        const fromIdx = tempWallets.findIndex((w) => w.id === oldTx.fromWalletId);
        const toIdx = tempWallets.findIndex((w) => w.id === oldTx.toWalletId);
        if (fromIdx > -1) {
          tempWallets[fromIdx] = {
            ...tempWallets[fromIdx],
            balance: tempWallets[fromIdx].balance + oldTx.amount,
          };
        }
        if (toIdx > -1) {
          tempWallets[toIdx] = {
            ...tempWallets[toIdx],
            balance: tempWallets[toIdx].balance - oldTx.amount,
          };
        }
      } else if (
        oldTx.type === TransactionType.SUBSCRIPTION_PAYMENT &&
        oldTx.fromWalletId
      ) {
        const wIndex = tempWallets.findIndex((w) => w.id === oldTx.fromWalletId);
        if (wIndex > -1) {
          tempWallets[wIndex] = {
            ...tempWallets[wIndex],
            balance: tempWallets[wIndex].balance + oldTx.amount,
          };
        }
      } else if (oldTx.type === TransactionType.REFUND && oldTx.toWalletId) {
        const wIndex = tempWallets.findIndex((w) => w.id === oldTx.toWalletId);
        if (wIndex > -1) {
          tempWallets[wIndex] = {
            ...tempWallets[wIndex],
            balance: tempWallets[wIndex].balance - oldTx.amount,
          };
        }
      }

      const updatedTx = { ...oldTx, ...updates };
      const newAmount = updatedTx.amount;

      // Apply new
      if (updatedTx.type === TransactionType.DEPOSIT_FROM_BANK && updatedTx.toWalletId) {
        const wIndex = tempWallets.findIndex((w) => w.id === updatedTx.toWalletId);
        if (wIndex > -1) {
          tempWallets[wIndex] = {
            ...tempWallets[wIndex],
            balance: tempWallets[wIndex].balance + newAmount,
          };
        }
      } else if (
        updatedTx.type === TransactionType.INTERNAL_TRANSFER &&
        updatedTx.fromWalletId &&
        updatedTx.toWalletId
      ) {
        const fromIdx = tempWallets.findIndex((w) => w.id === updatedTx.fromWalletId);
        const toIdx = tempWallets.findIndex((w) => w.id === updatedTx.toWalletId);
        if (fromIdx > -1) {
          tempWallets[fromIdx] = {
            ...tempWallets[fromIdx],
            balance: tempWallets[fromIdx].balance - newAmount,
          };
        }
        if (toIdx > -1) {
          tempWallets[toIdx] = {
            ...tempWallets[toIdx],
            balance: tempWallets[toIdx].balance + newAmount,
          };
        }
      } else if (
        updatedTx.type === TransactionType.SUBSCRIPTION_PAYMENT &&
        updatedTx.fromWalletId
      ) {
        const wIndex = tempWallets.findIndex((w) => w.id === updatedTx.fromWalletId);
        if (wIndex > -1) {
          tempWallets[wIndex] = {
            ...tempWallets[wIndex],
            balance: tempWallets[wIndex].balance - newAmount,
          };
        }
      } else if (updatedTx.type === TransactionType.REFUND && updatedTx.toWalletId) {
        const wIndex = tempWallets.findIndex((w) => w.id === updatedTx.toWalletId);
        if (wIndex > -1) {
          tempWallets[wIndex] = {
            ...tempWallets[wIndex],
            balance: tempWallets[wIndex].balance + newAmount,
          };
        }
      }

      const newTransactions = [...prev.transactions];
      newTransactions[txIndex] = updatedTx;

      return {
        ...prev,
        wallets: tempWallets,
        transactions: newTransactions,
      };
    });
  };

  const deleteTransaction = (txId: string) => {
    setState((prev) => {
      const tx = prev.transactions.find((t) => t.id === txId);
      if (!tx) return prev;

      let tempWallets = [...prev.wallets];

      if (tx.type === TransactionType.SUBSCRIPTION_PAYMENT && tx.fromWalletId) {
        const wIndex = tempWallets.findIndex((w) => w.id === tx.fromWalletId);
        if (wIndex > -1) {
          tempWallets[wIndex] = {
            ...tempWallets[wIndex],
            balance: tempWallets[wIndex].balance + tx.amount,
          };
        }
      } else if (tx.type === TransactionType.DEPOSIT_FROM_BANK && tx.toWalletId) {
        const wIndex = tempWallets.findIndex((w) => w.id === tx.toWalletId);
        if (wIndex > -1) {
          tempWallets[wIndex] = {
            ...tempWallets[wIndex],
            balance: tempWallets[wIndex].balance - tx.amount,
          };
        }
      } else if (
        tx.type === TransactionType.INTERNAL_TRANSFER &&
        tx.fromWalletId &&
        tx.toWalletId
      ) {
        const fromIdx = tempWallets.findIndex((w) => w.id === tx.fromWalletId);
        const toIdx = tempWallets.findIndex((w) => w.id === tx.toWalletId);
        if (fromIdx > -1) {
          tempWallets[fromIdx] = {
            ...tempWallets[fromIdx],
            balance: tempWallets[fromIdx].balance + tx.amount,
          };
        }
        if (toIdx > -1) {
          tempWallets[toIdx] = {
            ...tempWallets[toIdx],
            balance: tempWallets[toIdx].balance - tx.amount,
          };
        }
      } else if (tx.type === TransactionType.REFUND && tx.toWalletId) {
        const wIndex = tempWallets.findIndex((w) => w.id === tx.toWalletId);
        if (wIndex > -1) {
          tempWallets[wIndex] = {
            ...tempWallets[wIndex],
            balance: tempWallets[wIndex].balance - tx.amount,
          };
        }
      }

      return {
        ...prev,
        wallets: tempWallets,
        transactions: prev.transactions.filter((t) => t.id !== txId),
      };
    });
  };

  const addSubscription = (subData: Omit<Subscription, 'id'>) => {
    setState((prev) => {
      const newSub: Subscription = { ...subData, id: crypto.randomUUID() };
      return {
        ...prev,
        subscriptions: [...prev.subscriptions, newSub],
      };
    });
  };

  const updateSubscription = (id: string, updates: Partial<Subscription>) => {
    setState((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((sub) =>
        sub.id === id ? { ...sub, ...updates } : sub
      ),
    }));
  };

  const recordPayment = (
    subscriptionId: string,
    walletId: string,
    amount: number,
    date: string,
    nextRenewalDate: string,
    vatAmount?: number
  ) => {
    setState((prev) => {
      const wallet = prev.wallets.find((w) => w.id === walletId);
      const sub = prev.subscriptions.find((s) => s.id === subscriptionId);

      if (!wallet || !sub) return prev;
      if (wallet.balance < amount) return prev;

      const updatedWallets = prev.wallets.map((w) =>
        w.id === walletId ? { ...w, balance: w.balance - amount } : w
      );

      const updatedSubs = prev.subscriptions.map((s) => {
        if (s.id === subscriptionId) {
          return {
            ...s,
            lastPaymentDate: date,
            lastPaymentAmount: amount,
            nextRenewalDate: nextRenewalDate,
          };
        }
        return s;
      });

      const transaction: Transaction = {
        id: crypto.randomUUID(),
        date,
        amount,
        type: TransactionType.SUBSCRIPTION_PAYMENT,
        fromWalletId: walletId,
        subscriptionId,
        description: `Payment for ${sub.name}`,
        vatAmount,
      };

      return {
        ...prev,
        wallets: updatedWallets,
        subscriptions: updatedSubs,
        transactions: [...prev.transactions, transaction],
      };
    });
  };

  const recordRefund = (
    subscriptionId: string,
    walletId: string,
    amount: number,
    date: string
  ) => {
    setState((prev) => {
      const updatedWallets = prev.wallets.map((w) =>
        w.id === walletId ? { ...w, balance: w.balance + amount } : w
      );

      const subName =
        prev.subscriptions.find((s) => s.id === subscriptionId)?.name || 'Service';

      const refundTx: Transaction = {
        id: crypto.randomUUID(),
        date,
        amount,
        type: TransactionType.REFUND,
        toWalletId: walletId,
        subscriptionId,
        description: `Refund from ${subName}`,
      };

      return {
        ...prev,
        wallets: updatedWallets,
        transactions: [...prev.transactions, refundTx],
      };
    });
  };

  const deleteSubscription = (id: string) => {
    setState((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.filter((s) => s.id !== id),
    }));
  };

  const addDepartment = (name: string, color: string) => {
    setState((prev) => ({
      ...prev,
      departments: [...prev.departments, { id: crypto.randomUUID(), name, color }],
    }));
  };

  const updateDepartment = (id: string, updates: Partial<Department>) => {
    setState((prev) => ({
      ...prev,
      departments: prev.departments.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    }));
  };

  const deleteDepartment = (id: string) => {
    setState((prev) => ({
      ...prev,
      departments: prev.departments.filter((d) => d.id !== id),
    }));
  };

  const addAccount = (name: string, code: string) => {
    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, { id: crypto.randomUUID(), name, code }],
    }));
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }));
  };

  const deleteAccount = (id: string) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
    }));
  };

  // --- Loading / Auth Gates ---

  if (isAuthChecking || isStateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // --- UI ---
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-10 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-indigo-600">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              S
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              SubTrack AI
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab('wallets')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'wallets'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <WalletCards size={20} /> Wallets & Funds
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'subscriptions'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <List size={20} /> Subscriptions
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'departments'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Users size={20} /> Departments
          </button>
          <button
            onClick={() => setActiveTab('qoyod')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'qoyod'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <BookOpen size={20} /> Qoyod
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'ocr'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText size={20} /> Invoice OCR
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
            <p className="text-xs font-medium opacity-80 mb-1">Total Balance</p>
            <p className="text-lg font-bold">
              {state.wallets
                .reduce((acc, w) => acc + w.balance, 0)
                .toLocaleString()}{' '}
              SAR
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 capitalize">
              {activeTab === 'ocr' ? 'Invoice OCR Scanner' : activeTab}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
              <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">
                A
              </div>
              <span className="text-sm font-medium text-gray-700">Admin</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-600 transition"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="animation-fade-in">
          {activeTab === 'dashboard' && <Dashboard state={state} />}
          {activeTab === 'wallets' && (
            <Wallets
              state={state}
              onAddWallet={addWallet}
              onUpdateWallet={updateWallet}
              onDeleteWallet={deleteWallet}
              onTransfer={transferFunds}
              onFundMain={fundMainWallet}
              onEditTransaction={editTransaction}
              onDeleteTransaction={deleteTransaction}
            />
          )}
          {activeTab === 'subscriptions' && (
            <Subscriptions
              state={state}
              onAddSubscription={addSubscription}
              onDeleteSubscription={deleteSubscription}
              onRecordPayment={recordPayment}
              onUpdateSubscription={updateSubscription}
              onEditTransaction={editTransaction}
              onDeleteTransaction={deleteTransaction}
              onRecordRefund={recordRefund}
            />
          )}
          {activeTab === 'departments' && (
            <Departments
              departments={state.departments}
              onAdd={addDepartment}
              onUpdate={updateDepartment}
              onDelete={deleteDepartment}
            />
          )}
          {activeTab === 'qoyod' && (
            <Qoyod
              accounts={state.accounts}
              onAdd={addAccount}
              onUpdate={updateAccount}
              onDelete={deleteAccount}
            />
          )}
          {activeTab === 'ocr' && <InvoiceOCR accounts={state.accounts} />}
        </div>
      </main>
    </div>
  );
}

export default App;
