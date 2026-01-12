
import React, { useState } from 'react';
import { Upload, FileText, Loader2, Save, Trash2, X, Plus, ChevronDown, Search, AlertTriangle } from 'lucide-react';
import { InvoiceData, Account, InvoiceLineItem } from '../types';
import { parseInvoiceDocument } from '../services/geminiService';

interface InvoiceOCRProps {
  accounts: Account[];
}

export const InvoiceOCR: React.FC<InvoiceOCRProps> = ({ accounts }) => {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Detail/Edit View State
  const [detailViewId, setDetailViewId] = useState<string | null>(null);
  
  // When detailing an invoice, we work on a copy until save
  const [activeInvoice, setActiveInvoice] = useState<InvoiceData | null>(null);

  // Dropdown Search State
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState('');

  // Delete Line Item Modal State
  const [deleteLineId, setDeleteLineId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsProcessing(true);
    // Explicitly cast to File[]
    const files: File[] = Array.from(e.target.files);

    for (const file of files) {
      const base64 = await fileToBase64(file);
      const base64Data = base64.split(',')[1]; 
      
      const result = await parseInvoiceDocument(base64Data, file.type);
      
      if (result) {
        const rawItems = result.items || [];
        const items: InvoiceLineItem[] = rawItems.map(item => ({
          id: crypto.randomUUID(),
          description: item.description || 'Item',
          amount: item.amount || 0,
          selectedAccountIds: [],
          customFields: {}
        }));

        // If no items extracted, create one default item for the whole amount
        if (items.length === 0 && (result.baseAmount || result.totalAmount)) {
          items.push({
            id: crypto.randomUUID(),
            description: 'Total Invoice Amount',
            amount: result.baseAmount || result.totalAmount || 0,
            selectedAccountIds: [],
            customFields: {}
          });
        }

        const newInvoice: InvoiceData = {
          id: crypto.randomUUID(),
          fileName: file.name,
          date: result.date || new Date().toISOString().split('T')[0],
          vendorName: result.vendorName || 'Unknown Vendor',
          baseAmount: result.baseAmount || 0,
          vatAmount: result.vatAmount || 0,
          totalAmount: result.totalAmount || 0,
          items: items,
          customColumns: []
        };
        setInvoices(prev => [...prev, newInvoice]);
      }
    }
    setIsProcessing(false);
    e.target.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // --- Actions ---

  const deleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    if (detailViewId === id) {
       setDetailViewId(null);
       setActiveInvoice(null);
    }
  };

  const openDetailView = (inv: InvoiceData) => {
    setDetailViewId(inv.id);
    // Deep copy to allow editing without immediate commit
    setActiveInvoice(JSON.parse(JSON.stringify(inv)));
    setOpenDropdownId(null);
  };

  const closeDetailView = () => {
    setDetailViewId(null);
    setActiveInvoice(null);
    setOpenDropdownId(null);
  };

  const saveDetails = () => {
    if (activeInvoice) {
       // Recalculate totals based on items just in case
       const newBase = activeInvoice.items.reduce((sum, item) => sum + item.amount, 0);
       // Update base amount to match items sum if user added lines
       const updatedInvoice = {
         ...activeInvoice,
         baseAmount: newBase,
         totalAmount: newBase + activeInvoice.vatAmount
       };

       setInvoices(prev => prev.map(inv => inv.id === activeInvoice.id ? updatedInvoice : inv));
       setDetailViewId(null);
       setActiveInvoice(null);
    }
  };

  // --- Detail View Helpers ---

  const addLineItem = () => {
    if (activeInvoice) {
      const newItem: InvoiceLineItem = {
        id: crypto.randomUUID(),
        description: 'New Item',
        amount: 0,
        selectedAccountIds: [],
        customFields: {}
      };
      setActiveInvoice({
        ...activeInvoice,
        items: [...activeInvoice.items, newItem]
      });
    }
  };

  const updateLineItem = (itemId: string, updates: Partial<InvoiceLineItem>) => {
    if (activeInvoice) {
      setActiveInvoice({
        ...activeInvoice,
        items: activeInvoice.items.map(item => item.id === itemId ? { ...item, ...updates } : item)
      });
    }
  };

  const toggleAccountForLine = (itemId: string, accountId: string) => {
    if (!activeInvoice) return;
    const item = activeInvoice.items.find(i => i.id === itemId);
    if (!item) return;

    let newIds = item.selectedAccountIds.includes(accountId)
      ? item.selectedAccountIds.filter(id => id !== accountId)
      : [...item.selectedAccountIds, accountId];
    
    updateLineItem(itemId, { selectedAccountIds: newIds });
  };

  const promptDeleteLine = (itemId: string) => {
    setDeleteLineId(itemId);
    setDeleteConfirmText('');
  };

  const confirmDeleteLine = () => {
    if (activeInvoice && deleteLineId && deleteConfirmText.toLowerCase() === 'delete') {
      setActiveInvoice({
         ...activeInvoice,
         items: activeInvoice.items.filter(i => i.id !== deleteLineId)
      });
      setDeleteLineId(null);
    }
  };

  // --- Calculation Logic ---
  const calculateAllocations = () => {
     if (!activeInvoice) return { allocationMap: {}, unallocatedTotal: 0 };
     
     const allocationMap: Record<string, number> = {};
     let unallocatedTotal = 0;

     activeInvoice.items.forEach(item => {
        if (item.selectedAccountIds.length === 0) {
           unallocatedTotal += item.amount;
        } else {
           // Split equally among selected accounts
           const splitAmount = item.amount / item.selectedAccountIds.length;
           item.selectedAccountIds.forEach(accId => {
              allocationMap[accId] = (allocationMap[accId] || 0) + splitAmount;
           });
        }
     });

     return { allocationMap, unallocatedTotal };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative">
       
       {/* Delete Line Item Modal */}
       {deleteLineId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl text-center">
            <div className="flex justify-center text-red-500 mb-4"><AlertTriangle size={48} /></div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Line Item?</h3>
            <p className="text-sm text-gray-500 mb-4">
               Type <strong>delete</strong> to confirm removal of this line item.
            </p>
            <input 
              type="text" 
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              className="w-full border border-red-200 rounded p-2 mb-4 text-center focus:border-red-500 outline-none"
              placeholder="delete"
            />
            <div className="flex gap-2">
               <button 
                 onClick={confirmDeleteLine}
                 disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                 className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Delete
               </button>
               <button onClick={() => setDeleteLineId(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

       <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-orange-100 rounded-full text-orange-600">
           <FileText size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Invoice OCR & Allocation</h2>
          <p className="text-gray-500">Upload invoices, extract line items, and allocate costs to Qoyod accounts.</p>
        </div>
      </div>

      {/* Upload Area */}
      {!detailViewId && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition cursor-pointer relative mb-8">
          <input 
              type="file" 
              multiple 
              accept="application/pdf,image/*,.xlsx,.xls" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileUpload}
          />
          <div className="flex flex-col items-center gap-3">
              {isProcessing ? (
                <Loader2 className="animate-spin text-indigo-600" size={48} />
              ) : (
                <Upload className="text-gray-400" size={48} />
              )}
              <h3 className="text-lg font-semibold text-gray-700">
                {isProcessing ? 'Extracting Data & Line Items...' : 'Drop invoices here to scan'}
              </h3>
              <p className="text-sm text-gray-500">Supports PDF, PNG, JPG, Excel</p>
          </div>
        </div>
      )}

      {/* Main List View */}
      {!detailViewId && invoices.length > 0 && (
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 flex justify-between items-center">
               <span>Processed Invoices ({invoices.length})</span>
               <button className="text-xs text-red-500 hover:text-red-700 underline" onClick={() => setInvoices([])}>Clear All</button>
            </div>
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3">File</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Total Amount</th>
                      <th className="px-4 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-700">{inv.fileName}</td>
                        <td className="px-4 py-3 text-gray-600">{inv.vendorName}</td>
                        <td className="px-4 py-3 text-gray-500">{inv.date}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{inv.totalAmount.toLocaleString()} SAR</td>
                        <td className="px-4 py-3 text-center">
                           <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{inv.items.length} lines</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                           <button onClick={() => openDetailView(inv)} className="text-indigo-600 font-medium hover:underline mr-4">Allocate / Edit</button>
                           <button onClick={() => deleteInvoice(inv.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                        </td>
                    </tr>
                  ))}
                </tbody>
            </table>
         </div>
      )}

      {/* Detailed Allocation View */}
      {detailViewId && activeInvoice && (
         <div className="bg-white rounded-xl shadow-lg border border-indigo-100 flex flex-col animation-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-indigo-50/30">
               <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-1">{activeInvoice.vendorName} Invoice</h3>
                  <div className="flex gap-4 text-sm text-gray-500">
                     <span>Date: <input type="date" value={activeInvoice.date} onChange={e => setActiveInvoice({...activeInvoice, date: e.target.value})} className="bg-transparent border-b border-gray-300 focus:outline-none text-gray-800" /></span>
                     <span>File: {activeInvoice.fileName}</span>
                  </div>
               </div>
               <div className="flex gap-2">
                  <button onClick={saveDetails} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2">
                     <Save size={18} /> Save & Close
                  </button>
                  <button onClick={closeDetailView} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                     Cancel
                  </button>
               </div>
            </div>

            {/* Line Items Table */}
            <div className="p-6">
               <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-700">Line Items & Cost Allocation</h4>
                  <div className="flex gap-2">
                     <button onClick={addLineItem} className="text-sm flex items-center gap-1 text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded border border-indigo-200">
                        <Plus size={14}/> Add Item
                     </button>
                  </div>
               </div>

               <div className="overflow-x-visible border rounded-lg">
                  <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                        <tr>
                           <th className="px-4 py-3 w-10">#</th>
                           <th className="px-4 py-3 min-w-[200px]">Description</th>
                           <th className="px-4 py-3 w-[150px]">Amount (SAR)</th>
                           <th className="px-4 py-3 min-w-[250px]">
                              Allocation (Qoyod)
                              <span className="block text-[10px] font-normal text-gray-500">Search to add/remove accounts</span>
                           </th>
                           <th className="px-4 py-3 w-10"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {activeInvoice.items.map((item, idx) => {
                           const isDropdownOpen = openDropdownId === item.id;
                           const filteredAccounts = accounts.filter(acc => 
                              acc.name.toLowerCase().includes(dropdownSearch.toLowerCase()) || 
                              (acc.code && acc.code.toLowerCase().includes(dropdownSearch.toLowerCase()))
                           );

                           return (
                           <tr key={item.id} className="group hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                              <td className="px-4 py-3">
                                 <input 
                                    type="text" 
                                    className="w-full bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none"
                                    value={item.description}
                                    onChange={e => updateLineItem(item.id, { description: e.target.value })}
                                 />
                              </td>
                              <td className="px-4 py-3">
                                 <input 
                                    type="number" step="0.01"
                                    className="w-full bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none font-medium"
                                    value={item.amount}
                                    onChange={e => updateLineItem(item.id, { amount: parseFloat(e.target.value) })}
                                 />
                              </td>
                              <td className="px-4 py-3 relative">
                                 {/* Searchable Multi-Select Dropdown */}
                                 <div className="relative">
                                    <button 
                                      type="button"
                                      onClick={() => {
                                         if (openDropdownId === item.id) {
                                            setOpenDropdownId(null);
                                         } else {
                                            setOpenDropdownId(item.id);
                                            setDropdownSearch('');
                                         }
                                      }}
                                      className="flex items-center justify-between w-full border rounded px-2 py-1.5 bg-white text-xs text-left text-gray-600 hover:border-indigo-300 min-h-[32px]"
                                    >
                                       <span className="truncate max-w-[200px]">
                                          {item.selectedAccountIds.length === 0 
                                             ? 'Select Accounts...' 
                                             : item.selectedAccountIds.map(id => accounts.find(a => a.id === id)?.name).join(', ')
                                          }
                                       </span>
                                       <ChevronDown size={14} />
                                    </button>

                                    {isDropdownOpen && (
                                       <>
                                       <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setOpenDropdownId(null)}></div>
                                       <div className="absolute top-full left-0 w-64 bg-white border shadow-xl rounded-lg z-50 mt-1 flex flex-col max-h-60">
                                          {/* Search Input */}
                                          <div className="p-2 border-b bg-gray-50 rounded-t-lg">
                                             <div className="relative">
                                                <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                                                <input 
                                                   type="text" 
                                                   autoFocus
                                                   placeholder="Search accounts..." 
                                                   className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-indigo-500"
                                                   value={dropdownSearch}
                                                   onChange={e => setDropdownSearch(e.target.value)}
                                                />
                                             </div>
                                          </div>
                                          {/* Options List */}
                                          <div className="overflow-y-auto flex-1 p-1">
                                             {filteredAccounts.map(acc => (
                                                <div 
                                                   key={acc.id} 
                                                   onClick={() => toggleAccountForLine(item.id, acc.id)}
                                                   className={`px-3 py-2 text-xs cursor-pointer rounded flex items-center justify-between hover:bg-indigo-50 ${item.selectedAccountIds.includes(acc.id) ? 'text-indigo-700 font-bold bg-indigo-50' : 'text-gray-700'}`}
                                                >
                                                   <div className="flex flex-col">
                                                      <span>{acc.name}</span>
                                                      {acc.code && <span className="text-[10px] text-gray-400">{acc.code}</span>}
                                                   </div>
                                                   {item.selectedAccountIds.includes(acc.id) && <span className="text-indigo-600">✓</span>}
                                                </div>
                                             ))}
                                             {filteredAccounts.length === 0 && <div className="p-3 text-center text-gray-400 text-xs">No accounts found</div>}
                                          </div>
                                       </div>
                                       </>
                                    )}
                                 </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                 <button onClick={() => promptDeleteLine(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                                    <Trash2 size={16} />
                                 </button>
                              </td>
                           </tr>
                           )
                        })}
                     </tbody>
                  </table>
                  {activeInvoice.items.length === 0 && (
                     <div className="p-8 text-center text-gray-400 italic">No line items. Add one manually or re-scan.</div>
                  )}
               </div>
            </div>

            {/* Allocation Summary Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 rounded-b-xl">
               <h4 className="font-bold text-gray-800 mb-4">Allocation Summary (Calculated)</h4>
               {(() => {
                  const { allocationMap, unallocatedTotal } = calculateAllocations();
                  const totalBase = activeInvoice.items.reduce((s, i) => s + i.amount, 0);
                  const grandTotal = totalBase + activeInvoice.vatAmount;

                  return (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Financials */}
                        <div className="space-y-2 text-sm">
                           <div className="flex justify-between">
                              <span className="text-gray-600">Base Amount (Items Sum):</span>
                              <span className="font-bold">{totalBase.toLocaleString()} SAR</span>
                           </div>
                           <div className="flex justify-between">
                              <span className="text-gray-600">VAT (Manual):</span>
                              <div className="flex items-center gap-1">
                                 <input 
                                    type="number" className="w-20 text-right bg-transparent border-b border-gray-300 text-xs" 
                                    value={activeInvoice.vatAmount}
                                    onChange={e => setActiveInvoice({...activeInvoice, vatAmount: parseFloat(e.target.value)})}
                                 /> 
                                 <span className="font-bold">SAR</span>
                              </div>
                           </div>
                           <div className="flex justify-between pt-2 border-t border-gray-200">
                              <span className="text-gray-800 font-bold">Grand Total:</span>
                              <span className="text-indigo-600 font-bold text-lg">{grandTotal.toLocaleString()} SAR</span>
                           </div>
                        </div>

                        {/* Cost Distribution */}
                        <div className="bg-white border rounded-lg p-4 space-y-2">
                           <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-b pb-1">Cost by Account</h5>
                           {Object.entries(allocationMap).map(([accId, amt]) => {
                              const acc = accounts.find(a => a.id === accId);
                              return (
                                 <div key={accId} className="flex justify-between text-sm">
                                    <span className="text-gray-700">{acc?.name} <span className="text-xs text-gray-400">({acc?.code})</span></span>
                                    <span className="font-mono font-medium">{amt.toLocaleString()} SAR</span>
                                 </div>
                              );
                           })}
                           {unallocatedTotal > 0 && (
                              <div className="flex justify-between text-sm text-red-500 font-medium">
                                 <span>Unallocated / Pending</span>
                                 <span>{unallocatedTotal.toLocaleString()} SAR</span>
                              </div>
                           )}
                           {Object.keys(allocationMap).length === 0 && unallocatedTotal === 0 && (
                              <div className="text-xs text-gray-400 italic">No costs to display.</div>
                           )}
                        </div>
                     </div>
                  );
               })()}
            </div>
         </div>
      )}
    </div>
  );
};
