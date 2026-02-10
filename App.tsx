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
import { LayoutDashboard, Wallet as WalletIcon, List, PieChart, BookOpen, FileText, Settings, LogOut, LayoutGrid, Archive, Loader2 } from 'lucide-react';
import api, { clearToken } from "./services/api";
import { SettingsModal } from "./components/SettingsModal";
import { loadState, saveState, KEYS } from "./services/persistence";

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
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "wallets" | "subscriptions" | "departments" | "qoyod" | "ocr" | "inactive_cards"
  >(() => loadState(KEYS.ACTIVE_TAB, "dashboard"));

  useEffect(() => {
    saveState(KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  const checkAuth = async () => {
    const token = localStorage.getItem("subtracker_token");
    if (token) {
      try {
        // Load data first
        const [userData, _] = await Promise.all([
          (api as any).verifyUser(), // Fetch user details
          loadData()
        ]);

        if (userData && userData.user) {
          setUser(userData.user);
        }

        setIsAuthenticated(true);
      } catch (e) {
        console.error("Auth failed", e);
        clearToken();
        setIsAuthenticated(false);
      }
    }
    setIsAuthChecking(false);
  };

  const loadData = async () => {
    // setLoading(true); // Don't trigger full loading screen on updates to preserve UI state
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
          fixNumbers(s, ["baseAmount", "lastPaymentAmount"]),
        ),
        transactions: (res.data.transactions || []).map((t: any) =>
          fixNumbers(t, ["amount", "vatAmount"]),
        ),
        departments: res.data.departments || [],
        accounts: res.data.accounts || [],
      });
    } catch (e) {
      console.error("Failed to load data", e);
      // If 401, logout
    } finally {
      setLoading(false);
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
      const err: any = e;
      let msg = err.response?.data?.error || err.response?.data || err.message || "Failed to add subscription";
      if (typeof msg === 'object') msg = JSON.stringify(msg);
      alert(`Error: ${msg}`);
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
      <nav className="bg-[#1e1b4b] border-b border-indigo-900 sticky top-0 z-20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-2 rounded-lg shadow-inner">
                  <LayoutGrid size={24} strokeWidth={2.5} />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-200 hidden md:block">
                  SubTrack AI
                </span>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-200 md:hidden">
                  AI
                </span>
              </div>

              {/* Navigation Items */}
              <div className="hidden sm:ml-4 sm:flex sm:space-x-1 lg:space-x-2">
                <NavButton
                  label="Dashboard"
                  icon={LayoutDashboard}
                  id="dashboard"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
                <NavButton
                  label="Wallets"
                  icon={WalletIcon}
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
                  icon={PieChart}
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
                  label="Archive"
                  icon={Archive}
                  id="inactive_cards"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-3 bg-indigo-800/50 hover:bg-indigo-700/50 p-1.5 pr-4 rounded-full border border-indigo-700/50 transition-all group"
              >
                <div className="bg-indigo-600 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg group-hover:bg-indigo-500 transition">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-bold text-white leading-tight">{user?.name}</div>
                  <div className="text-[10px] text-indigo-200">ADMIN</div>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="text-indigo-300 hover:text-white p-2 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Settings Modal */}
      {showSettingsModal && user && (
        <SettingsModal
          currentUser={{ name: user.name, email: user.email, id: user.id }}
          onClose={() => setShowSettingsModal(false)}
          onUpdateUser={(updatedUser) => setUser({ ...user, ...updatedUser })}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {activeTab === "dashboard" && "Financial Dashboard"}
            {activeTab === "wallets" && "Wallets & Cards"}
            {activeTab === "inactive_cards" && "Inactive Cards Archive"}
            {activeTab === "subscriptions" && "Subscription Management"}
            {activeTab === "departments" && "Departments"}
            {activeTab === "qoyod" && "Qoyod Integration"}
            {activeTab === "ocr" && "Invoice OCR"}
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
            {activeTab === "dashboard" && "Overview of company spending and subscriptions"}
            {activeTab === "wallets" && `Manage funds across ${state.wallets.filter(w => w.status === 'ACTIVE').length} active wallets`}
            {activeTab === "inactive_cards" && "View history of decommissioned employee cards"}
            {activeTab === "subscriptions" && `Tracking ${state.subscriptions.length} active subscriptions`}
            {activeTab === "departments" && `Allocating costs across ${state.departments.length} departments`}
            {activeTab === "qoyod" && "Sync data with Qoyod accounting software"}
            {activeTab === "ocr" && "Scan invoices to auto-detect subscriptions"}
          </p>
        </header>

        {loading ? (
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
    className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === id
      ? "bg-white text-indigo-900 shadow-sm"
      : "text-indigo-200 hover:bg-white/10 hover:text-white"
      }`}
  >
    <Icon size={18} className={`mr-2 ${activeTab === id ? 'text-indigo-700' : 'text-indigo-300'}`} />
    {label}
  </button>
);

export default App;
