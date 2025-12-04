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

// ✅ نفس INITIAL_STATE كـ fallback لو السيرفر وقع
const INITIAL_STATE: AppState = {
  wallets: [
    { id: 'main-wallet', name: 'Main HQ Wallet', type: WalletType.MAIN, balance: 0, status: EntityStatus.ACTIVE },
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

// 🔗 لينك الـ Google Script (نفس اللي استخدمناه في السكربت)
const GOOGLE_SCRIPT_BASE =
  'https://script.google.com/macros/s/AKfycbw8grU2D5aqxAUZ9Cvq4pTU0XM5hfplRt0cWonNyjA8x1z8UQohh7J4BmUPJiyQCRfDEw/exec';

// شكل الداتا راجعة من Google Sheets
type RemoteWallet = {
  id: string;
  name: string;
  type: string;
  balance: number | string;
  holderName?: string;
  status?: string;
};

type RemoteWalletTx = {
  id?: string;
  date?: string;
  amount?: number | string;
  type?: string;
  fromWalletId?: string;
  toWalletId?: string;
  description?: string;
};

function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // ✅ Loading state للداتا اللي جاية من Google Sheets
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'wallets' | 'subscriptions' | 'departments' | 'qoyod' | 'ocr'
  >('dashboard');

  // ❗ هنا شيلنا localStorage من init — دلوقتي بنبدأ بـ INITIAL_STATE
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  // ✅ Check auth مرة واحدة
  useEffect(() => {
    const authStatus = localStorage.getItem('subtrack_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsAuthChecking(false);
  }, []);

  // ✅ Load state من Google Sheets مرة واحدة على mount
  useEffect(() => {
    const fetchStateFromSheets = async () => {
      try {
        setIsDataLoading(true);
        setDataError(null);

        const url = `${GOOGLE_SCRIPT_BASE}?action=GET_STATE`;
        const res = await fetch(url, {
          method: 'GET',
        });

        // لو السكربت معمول no-cors هنا هيرجع opaque وما ينفعش نقرأ الـ body
        // فأنا افترضت إنك سايبه GET عادي (cors/anonymous) عشان نقدر نعمل res.json()
        if (!res.ok) {
          console.error('Failed to load state from Google Script', res.status);
          setDataError(`Failed to load data from server (${res.status})`);
          setIsDataLoading(false);
          return;
        }

        const data = (await res.json()) as {
          wallets?: RemoteWallet[];
          walletTransactions?: RemoteWalletTx[];
        };

        const remoteWallets = Array.isArray(data.wallets) ? data.wallets : [];
        const remoteTxs = Array.isArray(data.walletTransactions)
          ? data.walletTransactions
          : [];

        const mappedWallets: Wallet[] = remoteWallets.map((w) => ({
          id: String(w.id),
          name: String(w.name),
          type: w.type === 'MAIN' ? WalletType.MAIN : WalletType.EMPLOYEE,
          balance: Number(w.balance || 0),
          holderName: w.holderName || undefined,
          status:
            w.status === 'INACTIVE'
              ? EntityStatus.INACTIVE
              : EntityStatus.ACTIVE,
        }));

        const mappedWalletTransactions: Transaction[] = remoteTxs.map((t) => {
          let txType: TransactionType = TransactionType.DEPOSIT_FROM_BANK;
          if (t.type === 'DEPOSIT_FROM_BANK') {
            txType = TransactionType.DEPOSIT_FROM_BANK;
          } else if (t.type === 'INTERNAL_TRANSFER') {
            txType = TransactionType.INTERNAL_TRANSFER;
          }

          const isoDate =
            typeof t.date === 'string' && t.date
              ? new Date(t.date).toISOString()
              : new Date().toISOString();

          return {
            id: t.id ? String(t.id) : crypto.randomUUID(),
            date: isoDate,
            amount: Number(t.amount || 0),
            type: txType,
            fromWalletId: t.fromWalletId || undefined,
            toWalletId: t.toWalletId || undefined,
            description: t.description || '',
          };
        });

        // 🧠 خلي بالك:
        // هنا بنحط الـ wallets و الـ walletTransactions من الشيت
        // وبنسيب subscriptions/departments/accounts زي ما هي من INITIAL_STATE
        setState((prev) => ({
          ...prev,
          wallets: mappedWallets.length > 0 ? mappedWallets : prev.wallets,
          // بنسيب payments/refunds (لو ضفناها في المستقبل) — دلوقتي مفيش
          transactions: mappedWalletTransactions,
        }));
      } catch (err) {
        console.error('Error loading state from Google Script', err);
        setDataError('Error loading data from server.');
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchStateFromSheets();
  }, []);

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

  // Enhanced Edit Transaction: Handles full updates (Date, Amount, Wallets, Desc)
  const editTransaction = (txId: string, updates: Partial<Transaction>) => {
    setState((prev) => {
      const txIndex = prev.transactions.findIndex((t) => t.id === txId);
      if (txIndex === -1) return prev;
      const oldTx = prev.transactions[txIndex];

      let tempWallets = [...prev.wallets];

      // 1. Revert Old Transaction Effect
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

      // 2. Apply New Transaction Effect
      const updatedTx = { ...oldTx, ...updates };
      const newAmount = updatedTx.amount;

      if (
        updatedTx.type === TransactionType.DEPOSIT_FROM_BANK &&
        updatedTx.toWalletId
      ) {
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

      if (!wallet || !sub) {
        return prev;
      }

      if (wallet.balance < amount) {
        return prev;
      }

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
        date: date,
        amount: amount,
        type: TransactionType.SUBSCRIPTION_PAYMENT,
        fromWalletId: walletId,
        subscriptionId: subscriptionId,
        description: `Payment for ${sub.name}`,
        vatAmount: vatAmount,
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
        prev.subscriptions.find((s) => s.id === subscriptionId)?.name ||
        'Service';

      const refundTx: Transaction = {
        id: crypto.randomUUID(),
        date: date,
        amount: amount,
        type: TransactionType.REFUND,
        toWalletId: walletId,
        subscriptionId: subscriptionId,
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

  // --- Loading Gate (Auth + Data) ---
  if (isAuthChecking || isDataLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent" />
        <p className="text-sm text-gray-500">
          Loading SubTrack AI...
        </p>
        {dataError && (
          <p className="text-xs text-red-500 mt-1">
            {dataError}
          </p>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

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
