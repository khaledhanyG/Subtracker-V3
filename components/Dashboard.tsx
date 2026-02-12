
import React from 'react';
import { AppState, AllocationType, WalletType, Subscription, TransactionType, EntityStatus } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { DollarSign, AlertCircle, Wallet as WalletIcon, Users, CreditCard, FileSpreadsheet, Printer, ChevronRight } from 'lucide-react';
import { analyzeSpending } from '../services/geminiService';

interface DashboardProps {
  state: AppState;
}

export const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const [insight, setInsight] = React.useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = React.useState(false);
  const [expandedDepts, setExpandedDepts] = React.useState<Set<string>>(new Set());

  const toggleDept = (id: string) => {
    const newSet = new Set(expandedDepts);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedDepts(newSet);
  };

  // Calculate "Due" (Overdue Subscriptions)
  const overdueCount = state.subscriptions.filter(sub => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const renewalDate = new Date(sub.nextRenewalDate);
    return renewalDate < today;
  }).length;

  // Calculate "Renewing Soon" (Today <= Renewal <= Today + 7 days)
  const upcomingRenewalsCount = state.subscriptions.filter(sub => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const renewalDate = new Date(sub.nextRenewalDate);

    const diffTime = renewalDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 0 && diffDays <= 7;
  }).length;

  const employeeWallets = state.wallets.filter(w => w.type === WalletType.EMPLOYEE);
  const totalAvailableCash = state.wallets.reduce((acc, w) => acc + w.balance, 0);

  // Complex Department Spend Calculation taking Splits into account
  const deptSpendMap = new Map<string, number>();

  state.subscriptions.forEach(sub => {
    let monthlyCost = sub.baseAmount;
    if (sub.billingCycle === 'YEARLY') monthlyCost = sub.baseAmount / 12;
    if (sub.billingCycle === 'DAILY') monthlyCost = sub.baseAmount * 30;
    if (sub.billingCycle === 'WEEKLY') monthlyCost = sub.baseAmount * 4.3;

    if (sub.allocationType === AllocationType.SINGLE && sub.departments.length > 0) {
      const deptId = sub.departments[0].departmentId;
      deptSpendMap.set(deptId, (deptSpendMap.get(deptId) || 0) + monthlyCost);
    }
    else if (sub.allocationType === AllocationType.EQUAL && sub.departments.length > 0) {
      const splitAmount = monthlyCost / sub.departments.length;
      sub.departments.forEach(d => {
        deptSpendMap.set(d.departmentId, (deptSpendMap.get(d.departmentId) || 0) + splitAmount);
      });
    }
    else if (sub.allocationType === AllocationType.PERCENTAGE) {
      sub.departments.forEach(d => {
        const percent = d.percentage || 0;
        const amount = monthlyCost * (percent / 100);
        deptSpendMap.set(d.departmentId, (deptSpendMap.get(d.departmentId) || 0) + amount);
      });
    }
  });

  const deptData = state.departments.map(dept => {
    return {
      name: dept.name,
      value: deptSpendMap.get(dept.id) || 0,
      color: dept.color
    };
  }).filter(d => d.value > 0);

  const handleGetInsight = async () => {
    setLoadingInsight(true);
    const result = await analyzeSpending(state.subscriptions, state.departments, state.wallets);
    setInsight(result || "No insights available.");
    setLoadingInsight(false);
  };

  // Group Subscriptions by Department for the Board View
  const getSubscriptionGroups = () => {
    const groups: Record<string, Subscription[]> = {};
    const sortSubs = (a: Subscription, b: Subscription) => {
      const aInactive = a.status === EntityStatus.INACTIVE ? 1 : 0;
      const bInactive = b.status === EntityStatus.INACTIVE ? 1 : 0;
      if (aInactive !== bInactive) return aInactive - bInactive;
      return a.name.localeCompare(b.name);
    };
    // Initialize for all departments
    state.departments.forEach(d => groups[d.id] = []);
    groups['SHARED'] = [];

    state.subscriptions.forEach(sub => {
      // Add to ALL assigned departments
      if (sub.departments.length > 0) {
        sub.departments.forEach(d => {
          if (groups[d.departmentId]) {
            groups[d.departmentId].push(sub);
          }
        });
        // If shared, also keep in SHARED group for reference (or strictly shared view)
        if (sub.departments.length > 1) {
          groups['SHARED'].push(sub);
        }
      } else {
        // No department assigned
        groups['SHARED'].push(sub);
      }
    });

    Object.values(groups).forEach(list => list.sort(sortSubs));

    return groups;
  };

  const subGroups = getSubscriptionGroups();

  // Date Filtering State
  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');

  // Filter Transactions based on Date Range
  const filteredTransactions = React.useMemo(() => {
    return state.transactions.filter(t => {
      if (!startDate && !endDate) return true;
      const txDate = new Date(t.date);
      if (startDate && txDate < new Date(startDate)) return false;
      if (endDate && new Date(endDate).setHours(23, 59, 59, 999) < txDate.getTime()) return false;
      return true;
    });
  }, [state.transactions, startDate, endDate]);

  // Calculate Total Paid Per Department (Real Transaction History)
  const deptTotalPaidMap = new Map<string, number>();

  filteredTransactions.forEach(t => {
    if ((t.type === TransactionType.SUBSCRIPTION_PAYMENT || t.type === TransactionType.REFUND) && t.subscriptionId) {
      const sub = state.subscriptions.find(s => s.id === t.subscriptionId);
      if (!sub) return;

      const amount = t.type === TransactionType.REFUND ? -t.amount : t.amount;

      if (sub.allocationType === AllocationType.SINGLE && sub.departments.length > 0) {
        const deptId = sub.departments[0].departmentId;
        deptTotalPaidMap.set(deptId, (deptTotalPaidMap.get(deptId) || 0) + amount);
      }
      else if (sub.allocationType === AllocationType.EQUAL && sub.departments.length > 0) {
        const splitAmount = amount / sub.departments.length;
        sub.departments.forEach(d => {
          deptTotalPaidMap.set(d.departmentId, (deptTotalPaidMap.get(d.departmentId) || 0) + splitAmount);
        });
      }
      else if (sub.allocationType === AllocationType.PERCENTAGE) {
        sub.departments.forEach(d => {
          const percent = d.percentage || 0;
          const splitAmount = amount * (percent / 100);
          deptTotalPaidMap.set(d.departmentId, (deptTotalPaidMap.get(d.departmentId) || 0) + splitAmount);
        });
      }
    }
  });

  const getSubTotalPaid = (subId: string) => {
    const payments = filteredTransactions.filter(t => t.subscriptionId === subId && t.type === TransactionType.SUBSCRIPTION_PAYMENT).reduce((sum, t) => sum + t.amount, 0);
    const refunds = filteredTransactions.filter(t => t.subscriptionId === subId && t.type === TransactionType.REFUND).reduce((sum, t) => sum + t.amount, 0);
    return payments - refunds;
  };

  const exportToExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Department,Subscription Name,Cost (SAR),Users,Total Paid (SAR)\n";

    state.departments.forEach(dept => {
      const subs = subGroups[dept.id] || [];
      subs.forEach(s => {
        csvContent += `${dept.name},"${s.name}",${s.baseAmount},${s.userCount},${getSubTotalPaid(s.id)}\n`;
      });
    });

    // Shared
    const shared = subGroups['SHARED'] || [];
    shared.forEach(s => {
      csvContent += `SHARED/SPLIT,"${s.name}",${s.baseAmount},${s.userCount},${getSubTotalPaid(s.id)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "department_overview.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPdf = () => {
    window.print();
  };

  const renderCompactCard = (sub: Subscription, isSharedView = false, currentDeptId?: string) => {
    const totalPaid = getSubTotalPaid(sub.id);
    let myShare = totalPaid;
    let isSplit = false;

    // Calculate My Share if inside a specific department view and it's a shared sub
    if (currentDeptId && sub.departments.length > 1 && !isSharedView) {
      isSplit = true;
      const deptAlloc = sub.departments.find(d => d.departmentId === currentDeptId);
      if (deptAlloc) {
        if (sub.allocationType === AllocationType.EQUAL) {
          myShare = totalPaid / sub.departments.length;
        } else if (sub.allocationType === AllocationType.PERCENTAGE && deptAlloc.percentage) {
          myShare = totalPaid * (deptAlloc.percentage / 100);
        }
      }
    }

    return (
      <div key={sub.id} className={`px-3 py-2 rounded border border-gray-100 hover:shadow-sm transition-shadow flex items-center justify-between gap-2 ${sub.status === EntityStatus.INACTIVE ? 'bg-orange-50' : 'bg-white'}`}>
        <div className="flex-1 min-w-0 truncate font-medium text-sm text-gray-800" title={sub.name}>
          {sub.name}
          {isSplit && <span className="ml-2 text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-100">Shared</span>}
        </div>

        <div className="flex flex-col items-end">
          <div className="text-[10px] text-gray-400 uppercase tracking-tighter">{isSplit ? 'My Share' : 'Total Paid'}</div>
          <div className="text-xs font-semibold text-gray-600 whitespace-nowrap">
            {myShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
          </div>
          {isSplit && (
            <div className="text-[9px] text-gray-400 whitespace-nowrap">Total: {totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
          <Users size={10} /> {sub.userCount}
        </div>

        {(isSharedView || isSplit) && (
          <div className="flex -space-x-1">
            {sub.departments.map((s, i) => {
              const d = state.departments.find(dept => dept.id === s.departmentId);
              return <div key={i} className="w-2 h-2 rounded-full ring-1 ring-white" style={{ backgroundColor: d?.color || '#ccc' }} title={d?.name}></div>
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-xl shadow-sm border border-gray-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 font-medium text-sm uppercase tracking-wider">Total Available Cash</p>
              <h3 className="text-3xl font-bold mt-1">{totalAvailableCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg font-normal text-gray-400">SAR</span></h3>
              <p className="text-xs text-gray-400 mt-2">Across Main Wallet & {employeeWallets.length} Cards</p>
            </div>
            <div className="p-3 bg-gray-700/50 rounded-full text-emerald-400">
              <WalletIcon size={32} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Due (Overdue)</p>
              <h3 className="text-2xl font-bold text-gray-800">{overdueCount}</h3>
            </div>
            <div className="p-3 bg-red-50 rounded-full text-red-600">
              <AlertCircle size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Renewing Soon</p>
              <h3 className="text-2xl font-bold text-orange-600">{upcomingRenewalsCount}</h3>
            </div>
            <div className="p-3 bg-orange-50 rounded-full text-orange-600">
              <AlertCircle size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Date Filters */}
      {/* Date Filters */}
      <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-gray-200 shadow-sm no-print">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Quick Filter</label>
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            onChange={(e) => {
              const val = e.target.value;
              if (!val) return;
              const now = new Date();
              let start = new Date();
              let end = new Date();

              if (val === 'CUSTOM') {
                return; // Do nothing, let user picking
              }

              if (val === 'THIS_MONTH') {
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              } else if (val === 'LAST_MONTH') {
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
              } else if (val === 'THIS_QUARTER') {
                const q = Math.floor(now.getMonth() / 3);
                start = new Date(now.getFullYear(), q * 3, 1);
                end = new Date(now.getFullYear(), (q + 1) * 3, 0);
              } else if (val === 'LAST_QUARTER') {
                const q = Math.floor(now.getMonth() / 3);
                const prevQ = q - 1;
                if (prevQ < 0) {
                  start = new Date(now.getFullYear() - 1, 9, 1);
                  end = new Date(now.getFullYear() - 1, 12, 0);
                } else {
                  start = new Date(now.getFullYear(), prevQ * 3, 1);
                  end = new Date(now.getFullYear(), (prevQ + 1) * 3, 0);
                }
              } else if (val === 'THIS_YEAR') {
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
              } else if (val === 'LAST_YEAR') {
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() - 1, 11, 31);
              }

              // Adjust for timezone offset to get YYYY-MM-DD correct
              // Simple way: use local YYYY-MM-DD
              const fmt = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
              };

              setStartDate(fmt(start));
              setEndDate(fmt(end));
            }}
          >
            <option value="CUSTOM">Select Range...</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="THIS_QUARTER">This Quarter</option>
            <option value="LAST_QUARTER">Last Quarter</option>
            <option value="THIS_YEAR">This Year</option>
            <option value="LAST_YEAR">Last Year</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-400 pb-2">
          * Filters "Total Paid" calculations below.
        </div>
        {(startDate || endDate) && (
          <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-red-500 hover:text-red-700 pb-2 underline">
            Clear Filter
          </button>
        )}
      </div>

      {/* Departmental Subscription Board (Accordion) */}
      <div className="print-section space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-lg font-bold text-gray-800">Departmental Overview</h3>
          <div className="flex gap-2 no-print">
            <button onClick={exportToExcel} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition">
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            <button onClick={exportToPdf} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100 transition">
              <Printer size={16} /> Print / PDF
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Render Accordion for each department */}
          {[...state.departments, { id: 'SHARED', name: 'Shared / Split', color: '#4b5563' } as any].map(dept => {
            const isShared = dept.id === 'SHARED';
            const subs = subGroups[dept.id] || [];
            const deptTotal = isShared
              ? subs.reduce((acc, s) => acc + getSubTotalPaid(s.id), 0) // Approximation for shared visualization
              : (deptTotalPaidMap.get(dept.id) || 0);

            const isExpanded = expandedDepts.has(dept.id);

            return (
              <div key={dept.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200">
                {/* Accordion Header */}
                <button
                  onClick={() => toggleDept(dept.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                  style={{ borderLeft: `6px solid ${dept.color}` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                      <ChevronRight size={20} className="text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-lg">{dept.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{subs.length} Subscriptions</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Total Expense</p>
                      <p className="text-base font-bold text-gray-700">{deptTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</p>
                    </div>
                  </div>
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="p-4 bg-gray-50 border-t border-gray-100 animation-expand">
                    {subs.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm italic">No subscriptions found for this department.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {subs.map(sub => renderCompactCard(sub, isShared, dept.id))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts and AI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Effective Spend by Department</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deptData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {deptData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number) => `${value.toFixed(2)} SAR`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              ✨ AI Spending Insights
            </h3>
            <button
              onClick={handleGetInsight}
              disabled={loadingInsight}
              className="text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1 rounded-md hover:opacity-90 disabled:opacity-50 transition"
            >
              {loadingInsight ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          </div>
          <div className="flex-1 bg-gray-50 rounded-lg p-4 overflow-y-auto text-sm text-gray-700 leading-relaxed border border-gray-200">
            {insight ? (
              <div className="prose prose-sm max-w-none">
                {insight.split('\n').map((line, i) => (
                  <p key={i} className="mb-2">{line}</p>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 italic">
                Click refresh to analyze your data with Gemini AI.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
