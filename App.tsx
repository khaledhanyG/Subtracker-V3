import React, { useState, useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { Wallets } from "./components/Wallets";
import { Subscriptions } from "./components/Subscriptions";
import { Departments } from "./components/Departments";
import { Qoyod } from "./components/Qoyod";
import { InvoiceOCR } from "./components/InvoiceOCR";
import { Auth } from "./components/Auth";
import {
  AppState,
  WalletType,
  Wallet,
  Department,
  Account,
  Subscription,
} from "./types";
import {
  LayoutDashboard,
  WalletCards,
  List,
  Users,
  BookOpen,
  FileText,
  LogOut,
  Loader2,
} from "lucide-react";
import api, { clearToken } from "./services/api";

const INITIAL_STATE: AppState = {
  wallets: [],
  departments: [],
  accounts: [],
  subscriptions: [],
  transactions: [],
};

import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  // Authentication State
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Data State
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [loadingData, setLoadingData] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "wallets" | "subscriptions" | "departments" | "qoyod" | "ocr" | "inactive_cards"
  >("dashboard");

  const checkAuth = async () => {
    const token = localStorage.getItem("subtracker_token");
    if (token) {
      try {
        // Optionally verify token or just load data
        await loadData();
        setIsAuthenticated(true);
        // You might want to decode token to get user name if not stored
      } catch (e) {
        console.error("Auth failed", e);
        clearToken();
        setIsAuthenticated(false);
      }
    }
    setIsAuthChecking(false);
  };

  const loadData = async () => {
    setLoadingData(true);
    try {
      const res = await api.get("/data");
      const fixNumbers = (item: any, fields: string[]) => {
        const newItem = { ...item };
        fields.forEach((f) => {
          if (newItem[f]) newItem[f] = parseFloat(newItem[f]);
        });
        return newItem;
      };

      if (!res.data || !res.data.wallets) {
        throw new Error("Invalid API response format");
      }

      setState({
        wallets: (res.data.wallets || []).map((w: any) =>
          fixNumbers(w, ["balance"]),
        ),
        subscriptions: (res.data.subscriptions || []).map((s: any) =>
          fixNumbers(s, ["id", "baseAmount", "lastPaymentAmount"]),
        ),
        transactions: (res.data.transactions || []).map((t: any) =>
          fixNumbers(t, ["amount", "vatAmount", "subscriptionId"]),
        ),
        departments: res.data.departments || [],
        accounts: res.data.accounts || [],
      });
    } catch (e) {
      console.error("Failed to load data", e);
      // If 401, logout
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    setIsAuthenticated(true);
    loadData();
  };

  const handleLogout = () => {
    clearToken();
    setIsAuthenticated(false);
    setUser(null);
    setState(INITIAL_STATE);
  };

  // --- Actions (API Calls) ---

  const addWallet = async (wallet: Wallet) => {
    try {
      await api.post("/wallets", wallet);
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to add wallet");
    }
  };

  const updateWallet = async (id: string, updates: Partial<Wallet>) => {
    try {
      await api.put("/wallets", { id, ...updates });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to update wallet");
    }
  };

  const deleteWallet = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api.delete(`/wallets?id=${id}`);
      loadData();
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to delete wallet");
    }
  };

  const syncWalletBalances = async () => {
    try {
      const confirmSync = confirm(
        "This will recalculate all wallet balances based on the transaction history. Continue?",
      );
      if (!confirmSync) return;

      await api.post("/wallets", { action: "RECONCILE" });
      alert("Balances Synchronized Successfully!");
      loadData();
    } catch (e: any) {
      console.error(e);
      alert(
        "Failed to sync balances: " + (e.response?.data?.error || e.message),
      );
    }
  };

  const fundMainWallet = async (amount: number) => {
    try {
      const mainWallet = state.wallets.find((w) => w.type === "MAIN");
      if (!mainWallet) {
        alert("Main wallet not found! Please contact support.");
        return;
      }

      await api.post("/transactions", {
        type: "DEPOSIT_FROM_BANK",
        amount,
        toWalletId: mainWallet.id,
        date: new Date().toISOString(),
        description: "Bank Deposit",
      });
      loadData();
    } catch (e: any) {
      console.error("Fund wallet error:", e);
      const msg =
        e.response?.data?.error || e.message || "Failed to fund wallet";
      alert(`Error: ${msg}`);
    }
  };

  const transferFunds = async (
    fromId: string,
    toId: string,
    amount: number,
    date: string,
  ) => {
    try {
      await api.post("/transactions", {
        type: "INTERNAL_TRANSFER",
        amount,
        fromWalletId: fromId,
        toWalletId: toId,
        date: date,
        description: "Internal Transfer",
      });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Transfer failed");
    }
  };

  const editTransaction = async (txId: number, updates: any) => {
    try {
      await api.put("/transactions", { id: txId, ...updates });
      loadData();
    } catch (e: any) {
      console.error(e);
      let msg =
        e.response?.data?.error || e.message || "Failed to update transaction";
      if (typeof msg === "object") msg = JSON.stringify(msg);
      alert(`Error: ${msg}`);
    }
  };

  const deleteTransaction = async (txId: number) => {
    if (!confirm("Revert this transaction?")) return;
    try {
      await api.delete(`/transactions?id=${txId}`);
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to revert transaction");
    }
  };

  const addSubscription = async (subData: any) => {
    try {
      await api.post("/subscriptions", subData);
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to add subscription");
    }
  };

  const updateSubscription = async (
    id: number,
    updates: Partial<Subscription>,
  ) => {
    try {
      await api.put("/subscriptions", { id, ...updates });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to update subscription");
    }
  };

  const deleteSubscription = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api.delete(`/subscriptions?id=${id}`);
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to delete subscription");
    }
  };

  const recordPayment = async (
    subscriptionId: number,
    walletId: string,
    amount: number,
    date: string,
    nextRenewalDate: string,
    vatAmount?: number,
  ) => {
    try {
      await api.post("/transactions", {
        type: "SUBSCRIPTION_PAYMENT",
        amount,
        fromWalletId: walletId,
        subscriptionId,
        date,
        nextRenewalDate,
        vatAmount,
        description: "Subscription Payment",
      });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Payment failed");
    }
  };

  const recordRefund = async (
    subscriptionId: number,
    walletId: string,
    amount: number,
    date: string,
  ) => {
    try {
      await api.post("/transactions", {
        type: "REFUND",
        amount,
        toWalletId: walletId,
        subscriptionId,
        date,
        description: "Refund",
      });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Refund failed");
    }
  };

  // Departments
  const addDepartment = async (name: string, color: string) => {
    try {
      await api.post("/departments", { name, color });
      loadData();
    } catch (e) {
      alert("Error");
    }
  };

  const updateDepartment = (id: string, updates: Partial<Department>) => {
    // Implement API
    console.log("Update Dept not implemented");
  };

  const deleteDepartment = async (id: string) => {
    try {
      await api.delete(`/departments?id=${id}`);
      loadData();
    } catch (e) {
      alert("Error");
    }
  };

  // Accounts
  const addAccount = async (name: string, code: string) => {
    try {
      await api.post("/accounts", { name, code });
      loadData();
    } catch (e) {
      alert("Error");
    }
  };

  const updateAccount = async (id: string, updates: Partial<Account>) => {
    try {
      await api.put("/accounts", { id, ...updates });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to update account");
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await api.delete(`/accounts?id=${id}`);
      loadData();
    } catch (e) {
      alert("Error");
    }
  };

  // --- Auth Gate ---
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-2 text-indigo-600 mr-8">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                  S
                </div>
                <span className="text-xl font-bold tracking-tight text-gray-900">
                  SubTrack AI
                </span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
                <NavButton
                  label="Dashboard"
                  icon={LayoutDashboard}
                  id="dashboard"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
                <NavButton
                  label="Wallets & Funds"
                  icon={WalletCards}
                  id="wallets"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
                <NavButton
                  label="Subscriptions"
                  icon={List}
                  id="subscriptions"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
                <NavButton
                  label="Departments"
                  icon={Users}
                  id="departments"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
                <NavButton
                  label="Qoyod"
                  icon={BookOpen}
                  id="qoyod"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
                <NavButton
                  label="Invoice OCR"
                  icon={FileText}
                  id="ocr"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
                <NavButton
                  label="INACTIVE CARDS"
                  icon={LogOut}
                  id="inactive_cards"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">U</div>
                <span className="text-sm font-medium text-gray-700">{user?.name || 'User'}</span>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 transition p-2" title="Logout">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 capitalize">
            {activeTab === "ocr"
              ? "Invoice OCR Scanner"
              : activeTab === "inactive_cards"
                ? "Inactive Employee Cards"
                : activeTab === "wallets"
                  ? "Wallets & Funds"
                  : activeTab}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </header>

        {loadingData ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
        ) : (
          <div className="animation-fade-in">
            {activeTab === "dashboard" && <Dashboard state={state} />}
            {activeTab === "wallets" && (
              <Wallets
                state={state}
                onAddWallet={addWallet}
                onUpdateWallet={updateWallet}
                onDeleteWallet={deleteWallet}
                onTransfer={transferFunds}
                onFundMain={fundMainWallet}
                onEditTransaction={editTransaction}
                onDeleteTransaction={deleteTransaction}
                onSyncBalances={syncWalletBalances}
                showInactive={false}
              />
            )}
            {activeTab === "inactive_cards" && (
              <Wallets
                state={state}
                onAddWallet={addWallet}
                onUpdateWallet={updateWallet}
                onDeleteWallet={deleteWallet}
                onTransfer={transferFunds}
                onFundMain={fundMainWallet}
                onEditTransaction={editTransaction}
                onDeleteTransaction={deleteTransaction}
                onSyncBalances={syncWalletBalances}
                showInactive={true}
              />
            )}
            {activeTab === "subscriptions" && (
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
            {activeTab === "departments" && (
              <Departments
                departments={state.departments}
                onAdd={addDepartment}
                onUpdate={updateDepartment}
                onDelete={deleteDepartment}
              />
            )}
            {activeTab === "qoyod" && (
              <Qoyod
                accounts={state.accounts}
                onAdd={addAccount}
                onUpdate={updateAccount}
                onDelete={deleteAccount}
              />
            )}
            {activeTab === "ocr" && <InvoiceOCR accounts={state.accounts} />}
          </div>
        )}
      </main>
    </div>
  );
}

// Helper for Nav Buttons
const NavButton = ({ label, icon: Icon, id, activeTab, setActiveTab }: any) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`inline-flex items-center px-3 pt-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
      activeTab === id
        ? "border-indigo-500 text-indigo-700 bg-indigo-50/50"
        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50"
    }`}
  >
    <Icon size={16} className="mr-2" />
    {label}
  </button>
);

export default App;
