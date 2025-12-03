import React, { useState, useEffect } from 'react';
import { AppState, Subscription, WalletType, BillingCycle, AllocationType, DepartmentSplit, AccountSplit, TransactionType, EntityStatus, Transaction } from '../types';
import { Plus, AlertTriangle, Search, Trash2, Receipt, Users, ArrowRight, History, Edit2, StickyNote, CreditCard, Save, X, FileText, Undo2, Coins } from 'lucide-react';

// ========= Google Sheets Logging =========
const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw8grU2D5aqxAUZ9Cvq4pTU0XM5hfplRt0cWonNyjA8x1z8UQohh7J4BmUPJiyQCRfDEw/exec'; 

const logToSheet = async (payload: any) => {
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Failed to log to Google Sheets:', error);
  }
};

// ========================================

interface SubscriptionsProps {
  state: AppState;
  onAddSubscription: (sub: Omit<Subscription, 'id'>) => void;
  onDeleteSubscription: (id: string) => void;
  onRecordPayment: (
    subscriptionId: string,
    walletId: string,
    amount: number,
    date: string,
    nextRenewalDate: string,
    vatAmount?: number
  ) => void;
  onUpdateSubscription: (id: string, updates: Partial<Subscription>) => void;
  onEditTransaction: (id: string, updates: Partial<Transaction>) => void;
  onDeleteTransaction: (id: string) => void;
  onRecordRefund: (subscriptionId: string, walletId: string, amount: number, date: string) => void;
}

export const Subscriptions: React.FC<SubscriptionsProps> = ({
  state,
  onAddSubscription,
  onDeleteSubscription,
  onRecordPayment,
  onUpdateSubscription,
  onEditTransaction,
  onDeleteTransaction,
  onRecordRefund,
}) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'ADD' | 'PAY' | 'REFUND' | 'HISTORY'>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  const [nameError, setNameError] = useState('');

  // --- Modal States ---
  const [deleteModalSub, setDeleteModalSub] = useState<Subscription | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');

  // --- History Filters & Accounting ---
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterServiceId, setFilterServiceId] = useState('');
  const [showAccountingModal, setShowAccountingModal] = useState(false);

  // --- Edit History State ---
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editTxData, setEditTxData] = useState<{
    amount: string;
    date: string;
    walletId: string;
    subId: string;
  }>({ amount: '', date: '', walletId: '', subId: '' });

  // --- Add/Edit Subscription Form State ---
  const [subForm, setSubForm] = useState<{
    id?: string;
    name: string;
    baseAmount: string;
    billingCycle: BillingCycle;
    userCount: string;

    // Dept Allocation
    allocationType: AllocationType;
    selectedDeptIds: string[];
    percentages: Record<string, string>;

    // Account Allocation
    accountAllocationType: AllocationType;
    selectedAccountIds: string[];
    accountPercentages: Record<string, string>;

    startDate: string;
    renewalDate: string;
    notes: string;
    status: EntityStatus;
  }>({
    name: '',
    baseAmount: '',
    billingCycle: BillingCycle.MONTHLY,
    userCount: '1',
    allocationType: AllocationType.SINGLE,
    selectedDeptIds: [],
    percentages: {},
    accountAllocationType: AllocationType.SINGLE,
    selectedAccountIds: [],
    accountPercentages: {},
    startDate: new Date().toISOString().split('T')[0],
    renewalDate: '',
    notes: '',
    status: EntityStatus.ACTIVE,
  });

  // --- Record Payment Form State ---
  const [payForm, setPayForm] = useState({
    subscriptionId: '',
    walletId: '',
    amount: '', // Base Amount
    date: new Date().toISOString().split('T')[0],
    nextRenewalDate: '',
    isTaxable: false,
    vatAmount: '',
  });

  // --- Record Refund Form State ---
  const [refundForm, setRefundForm] = useState({
    subscriptionId: '',
    walletId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Calculate VAT when amount or taxable changes
  useEffect(() => {
    if (payForm.isTaxable && payForm.amount) {
      const base = parseFloat(payForm.amount);
      if (!isNaN(base)) {
        const autoVat = (base * 0.15).toFixed(2);
        if (payForm.vatAmount === '') {
          setPayForm((prev) => ({ ...prev, vatAmount: autoVat }));
        }
      }
    } else if (!payForm.isTaxable) {
      setPayForm((prev) => ({ ...prev, vatAmount: '' }));
    }
  }, [payForm.isTaxable, payForm.amount]);

  const employeeWallets = state.wallets.filter((w) => w.type === WalletType.EMPLOYEE);
  const departments = state.departments;
  const accounts = state.accounts;

  const handleDeptToggle = (deptId: string) => {
    setSubForm((prev) => {
      const exists = prev.selectedDeptIds.includes(deptId);
      let newIds = exists ? prev.selectedDeptIds.filter((id) => id !== deptId) : [...prev.selectedDeptIds, deptId];

      if (prev.allocationType === AllocationType.SINGLE && newIds.length > 1) {
        newIds = [deptId];
      }
      return { ...prev, selectedDeptIds: newIds };
    });
  };

  const handleAccountToggle = (accId: string) => {
    setSubForm((prev) => {
      const exists = prev.selectedAccountIds.includes(accId);
      let newIds = exists ? prev.selectedAccountIds.filter((id) => id !== accId) : [...prev.selectedAccountIds, accId];

      if (prev.accountAllocationType === AllocationType.SINGLE && newIds.length > 1) {
        newIds = [accId];
      }
      return { ...prev, selectedAccountIds: newIds };
    });
  };

  const handleAddOrUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicate names
    const normalizedName = subForm.name.trim().toLowerCase();
    const duplicate = state.subscriptions.find(
      (s) => s.name.trim().toLowerCase() === normalizedName && s.id !== subForm.id
    );

    if (duplicate) {
      setNameError(`Service name "${subForm.name}" is already registered.`);
      return;
    }

    // Dept Splits
    const deptSplits: DepartmentSplit[] = subForm.selectedDeptIds.map((id) => ({
      departmentId: id,
      percentage:
        subForm.allocationType === AllocationType.PERCENTAGE ? parseFloat(subForm.percentages[id] || '0') : undefined,
    }));

    // Account Splits
    const accountSplits: AccountSplit[] = subForm.selectedAccountIds.map((id) => ({
      accountId: id,
      percentage:
        subForm.accountAllocationType === AllocationType.PERCENTAGE
          ? parseFloat(subForm.accountPercentages[id] || '0')
          : undefined,
    }));

    const payload = {
      name: subForm.name.trim(),
      baseAmount: parseFloat(subForm.baseAmount),
      billingCycle: subForm.billingCycle,
      userCount: parseInt(subForm.userCount),

      allocationType: subForm.allocationType,
      departments: deptSplits,

      accountAllocationType: subForm.accountAllocationType,
      accounts: accountSplits,

      startDate: subForm.startDate,
      nextRenewalDate: subForm.renewalDate,
      notes: subForm.notes,
      status: subForm.status,
    };

    if (subForm.id) {
      onUpdateSubscription(subForm.id, payload);
    } else {
      onAddSubscription(payload);
    }

    setViewMode('LIST');
    resetSubForm();
  };

  const resetSubForm = () => {
    setSubForm({
      name: '',
      baseAmount: '',
      billingCycle: BillingCycle.MONTHLY,
      userCount: '1',
      allocationType: AllocationType.SINGLE,
      selectedDeptIds: [],
      percentages: {},
      accountAllocationType: AllocationType.SINGLE,
      selectedAccountIds: [],
      accountPercentages: {},
      startDate: new Date().toISOString().split('T')[0],
      renewalDate: '',
      notes: '',
      status: EntityStatus.ACTIVE,
      id: undefined,
    });
    setNameError('');
  };

  const startEditing = (sub: Subscription) => {
    const percentageMap: Record<string, string> = {};
    sub.departments.forEach((d) => {
      if (d.percentage) percentageMap[d.departmentId] = d.percentage.toString();
    });

    const accPercentageMap: Record<string, string> = {};
    sub.accounts.forEach((a) => {
      if (a.percentage) accPercentageMap[a.accountId] = a.percentage.toString();
    });

    setSubForm({
      id: sub.id,
      name: sub.name,
      baseAmount: sub.baseAmount.toString(),
      billingCycle: sub.billingCycle,
      userCount: sub.userCount.toString(),

      allocationType: sub.allocationType,
      selectedDeptIds: sub.departments.map((d) => d.departmentId),
      percentages: percentageMap,

      accountAllocationType: sub.accountAllocationType || AllocationType.SINGLE,
      selectedAccountIds: sub.accounts ? sub.accounts.map((a) => a.accountId) : [],
      accountPercentages: accPercentageMap,

      startDate: sub.startDate,
      renewalDate: sub.nextRenewalDate,
      notes: sub.notes || '',
      status: sub.status,
    });
    setNameError('');
    setViewMode('ADD');
  };

  // --- Delete Logic ---
  const promptDeleteSub = (sub: Subscription) => {
    setDeleteModalSub(sub);
    setDeleteConfirmText('');
  };

  const promptDeleteTx = (id: string) => {
    setDeleteTxId(id);
    setDeleteConfirmText('');
  };

  const confirmDelete = () => {
    if (deleteConfirmText.toLowerCase() === 'delete') {
      if (deleteModalSub) {
        onDeleteSubscription(deleteModalSub.id);
        setDeleteModalSub(null);
      }
      if (deleteTxId) {
        onDeleteTransaction(deleteTxId);
        setDeleteTxId(null);
      }
    }
  };

  // --- History Edit Logic ---
  const startEditingTx = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditTxData({
      amount: tx.amount.toString(),
      date: tx.date.split('T')[0],
      walletId: tx.fromWalletId || '',
      subId: tx.subscriptionId || '',
    });
  };

  const saveEditingTx = () => {
    if (editingTxId) {
      onEditTransaction(editingTxId, {
        amount: parseFloat(editTxData.amount),
        date: new Date(editTxData.date).toISOString(),
        fromWalletId: editTxData.walletId,
        subscriptionId: editTxData.subId,
      });
      setEditingTxId(null);
    }
  };

  // --- Payment Submit (مع إرسال لجوجل شيت) ---
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const baseVal = parseFloat(payForm.amount || '0') || 0;
    const vatVal = payForm.isTaxable ? parseFloat(payForm.vatAmount || '0') || 0 : 0;
    const totalVal = baseVal + vatVal;

    const wallet = state.wallets.find((w) => w.id === payForm.walletId);

    if (wallet && wallet.balance < totalVal) {
      alert(
        `Transaction Failed: Insufficient funds in "${wallet.name}".\n\nAvailable Balance: ${wallet.balance.toLocaleString()} SAR\nRequired Amount: ${totalVal.toLocaleString()} SAR\n\nPlease transfer funds to this card before proceeding.`
      );
      return;
    }

    // 1) سجل الحركة في البرنامج
    onRecordPayment(
      payForm.subscriptionId,
      payForm.walletId,
      totalVal,
      payForm.date,
      payForm.nextRenewalDate,
      vatVal > 0 ? vatVal : undefined
    );

    // 2) ابعت اللوج لجوجل شيت
    const sub = state.subscriptions.find((s) => s.id === payForm.subscriptionId);
    const walletName = wallet ? wallet.name : '';

    logToSheet({
      type: 'PAYMENT',
      subscriptionId: payForm.subscriptionId,
      subscriptionName: sub ? sub.name : '',
      walletId: payForm.walletId,
      walletName,
      baseAmount: baseVal,
      vatAmount: vatVal,
      totalAmount: totalVal,
      date: payForm.date,
      nextRenewalDate: payForm.nextRenewalDate,
    });

    // 3) Reset form
    setPayForm({
      ...payForm,
      subscriptionId: '',
      walletId: '',
      amount: '',
      nextRenewalDate: '',
      isTaxable: false,
      vatAmount: '',
    });
    setViewMode('HISTORY');
  };

  // --- Refund Submit (مع إرسال لجوجل شيت) ---
  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(refundForm.amount || '0') || 0;

    onRecordRefund(refundForm.subscriptionId, refundForm.walletId, amount, refundForm.date);

    const sub = state.subscriptions.find((s) => s.id === refundForm.subscriptionId);
    const wallet = state.wallets.find((w) => w.id === refundForm.walletId);

    logToSheet({
      type: 'REFUND',
      subscriptionId: refundForm.subscriptionId,
      subscriptionName: sub ? sub.name : '',
      walletId: refundForm.walletId,
      walletName: wallet ? wallet.name : '',
      amount,
      date: refundForm.date,
    });

    setRefundForm({
      subscriptionId: '',
      walletId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
    });
    setViewMode('HISTORY');
  };

  const getWalletName = (id?: string) => {
    const w = state.wallets.find((w) => w.id === id);
    return w ? w.name : 'Unknown Wallet';
  };

  const getSubscriptionName = (id?: string) => {
    const s = state.subscriptions.find((s) => s.id === id);
    return s ? s.name : 'Unknown Service';
  };

  const filteredSubs = state.subscriptions.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  let paymentHistory = state.transactions
    .filter((t) => t.type === TransactionType.SUBSCRIPTION_PAYMENT || t.type === TransactionType.REFUND)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (filterDateStart) {
    paymentHistory = paymentHistory.filter((t) => t.date.split('T')[0] >= filterDateStart);
  }
  if (filterDateEnd) {
    paymentHistory = paymentHistory.filter((t) => t.date.split('T')[0] <= filterDateEnd);
  }
  if (filterServiceId) {
    paymentHistory = paymentHistory.filter((t) => t.subscriptionId === filterServiceId);
  }

  const filteredTotalPaid = paymentHistory
    .filter((t) => t.type === TransactionType.SUBSCRIPTION_PAYMENT)
    .reduce((sum, t) => sum + t.amount, 0);

  const filteredTotalRefund = paymentHistory
    .filter((t) => t.type === TransactionType.REFUND)
    .reduce((sum, t) => sum + t.amount, 0);

  const netFilteredTotal = filteredTotalPaid - filteredTotalRefund;

  const getDaysUntilRenewal = (dateStr: string) => {
    const today = new Date();
    const end = new Date(dateStr);
    const diff = end.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const openNoteModal = (title: string, content: string) => {
    setNoteTitle(title);
    setNoteContent(content);
    setShowNoteModal(true);
  };

  // --- Accounting Entry Generation ---
  const generateAccountingEntry = () => {
    const txs = paymentHistory.filter((t) => t.type === TransactionType.SUBSCRIPTION_PAYMENT);

    const debitEntries: Record<string, number> = {};
    const creditEntries: { name: string; amount: number; vat?: number }[] = [];
    const missingAccountSubs: string[] = [];
    let totalVat = 0;

    txs.forEach((tx) => {
      const sub = state.subscriptions.find((s) => s.id === tx.subscriptionId);
      if (!sub) return;

      creditEntries.push({ name: sub.name, amount: tx.amount, vat: tx.vatAmount });

      const vat = tx.vatAmount || 0;
      totalVat += vat;
      const baseAmount = tx.amount - vat;

      if (!sub.accounts || sub.accounts.length === 0) {
        missingAccountSubs.push(sub.name);
        debitEntries['unallocated'] = (debitEntries['unallocated'] || 0) + baseAmount;
      } else if (sub.accountAllocationType === AllocationType.SINGLE && sub.accounts.length > 0) {
        const accId = sub.accounts[0].accountId;
        debitEntries[accId] = (debitEntries[accId] || 0) + baseAmount;
      } else if (sub.accountAllocationType === AllocationType.EQUAL && sub.accounts.length > 0) {
        const split = baseAmount / sub.accounts.length;
        sub.accounts.forEach((a) => {
          debitEntries[a.accountId] = (debitEntries[a.accountId] || 0) + split;
        });
      } else if (sub.accountAllocationType === AllocationType.PERCENTAGE) {
        sub.accounts.forEach((a) => {
          const pct = a.percentage || 0;
          const amt = baseAmount * (pct / 100);
          debitEntries[a.accountId] = (debitEntries[a.accountId] || 0) + amt;
        });
      }
    });

    if (totalVat > 0) {
      debitEntries['vat_tax_account'] = totalVat;
    }

    const getAccountName = (accId: string) => {
      if (accId === 'unallocated') return 'Unallocated Expense (No Qoyod Set)';
      if (accId === 'vat_tax_account') return 'ضريبة القيمة المضافة';
      const acc = state.accounts.find((a) => a.id === accId);
      return acc ? `${acc.name} ${acc.code ? `(${acc.code})` : ''}` : 'Unknown Account';
    };

    return { debitEntries, creditEntries, getAccountName, missingAccountSubs };
  };

  return (
    <div className="space-y-6 relative">
      {/* Delete Modal */}
      {(deleteModalSub || deleteTxId) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl text-center">
            <div className="flex justify-center text-red-500 mb-4">
              <AlertTriangle size={48} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Deletion</h3>
            <p className="text-sm text-gray-500 mb-4">
              Type <strong>delete</strong> to confirm this action. This cannot be undone.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full border border-red-200 rounded p-2 mb-4 text-center focus:border-red-500 outline-none"
              placeholder="delete"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setDeleteModalSub(null);
                  setDeleteTxId(null);
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowNoteModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <StickyNote className="text-yellow-500" /> {noteTitle}
            </h3>
            <div className="bg-yellow-50 p-4 rounded-lg text-gray-700 text-sm whitespace-pre-wrap">
              {noteContent}
            </div>
          </div>
        </div>
      )}

      {/* Accounting Modal */}
      {showAccountingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Accounting Entry (قيد يومية)</h3>
              <button onClick={() => setShowAccountingModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-8 overflow-y-auto bg-amber-50/30" dir="rtl">
              {(() => {
                const { debitEntries, creditEntries, getAccountName, missingAccountSubs } =
                  generateAccountingEntry();
                return (
                  <div className="font-mono text-right space-y-6 text-gray-800">
                    <div className="text-center font-bold border-b pb-2 mb-4 text-lg">
                      قيد استحقاق الاشتراكات - {filterDateStart || 'فترة محددة'}
                    </div>

                    {missingAccountSubs.length > 0 && (
                      <div className="mb-4 bg-red-100 border border-red-200 text-red-800 p-3 rounded text-sm text-center">
                        Warning: The following services have no Accounting Codes (Qoyod) assigned:
                        <br />
                        {missingAccountSubs.join(', ')}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="font-bold text-gray-500 text-sm mb-1 border-b w-fit">من المذكورين:</div>
                      {Object.entries(debitEntries).map(([accId, amount]) => (
                        <div key={accId} className="flex items-center justify-between gap-8">
                          <span>{amount.toLocaleString()}</span>
                          <span className="font-bold">من حـ/ {getAccountName(accId)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="font-bold text-gray-500 text-sm mb-1 border-b w-fit">
                        الى المذكورين:
                      </div>
                      {creditEntries.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-8">
                          <span>{entry.amount.toLocaleString()}</span>
                          <span className="font-bold">
                            الى حـ/ مولا {entry.name}{' '}
                            {entry.vat ? `(شامل الضريبة ${entry.vat})` : ''}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t-2 border-black mt-6 pt-2 flex justify-between text-sm text-gray-500">
                      <div>
                        Total Debit:{' '}
                        {Object.values(debitEntries)
                          .reduce((a, b) => a + b, 0)
                          .toLocaleString()}
                      </div>
                      <div>
                        Total Credit:{' '}
                        {creditEntries.reduce((a, b) => a + b.amount, 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowAccountingModal(false)}
                className="bg-gray-800 text-white px-4 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 pb-1">
        <button
          onClick={() => {
            setViewMode('LIST');
            resetSubForm();
          }}
          className={`pb-2 px-4 font-medium text-sm transition-colors ${
            viewMode === 'LIST'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Active Subscriptions
        </button>
        <button
          onClick={() => {
            setViewMode('ADD');
            resetSubForm();
          }}
          className={`pb-2 px-4 font-medium text-sm transition-colors ${
            viewMode === 'ADD'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus size={16} /> {subForm.id ? 'Edit Service' : 'Add New Service'}
          </div>
        </button>
        <button
          onClick={() => setViewMode('PAY')}
          className={`pb-2 px-4 font-medium text-sm transition-colors ${
            viewMode === 'PAY'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Receipt size={16} /> Record Payment
          </div>
        </button>
        <button
          onClick={() => setViewMode('REFUND')}
          className={`pb-2 px-4 font-medium text-sm transition-colors ${
            viewMode === 'REFUND'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2 text-red-600">
            <Undo2 size={16} /> Record Refund
          </div>
        </button>
        <button
          onClick={() => setViewMode('HISTORY')}
          className={`pb-2 px-4 font-medium text-sm transition-colors ${
            viewMode === 'HISTORY'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <History size={16} /> Payment History
          </div>
        </button>
      </div>

      {/* باقي الواجهات (ADD, PAY, REFUND, HISTORY, LIST) زي ما كانت في كودك الأصلي */}
      {/* عشان الرد مايبقاش أطول من اللازم، لو حابب أكمّل لك جزء معين منهم ابعتهولي أظبطه مع اللوج برضه. */}
    </div>
  );
};
