
import React, { useState } from 'react';
import { Account } from '../types';
import { Trash2, Plus, BookOpen, Edit2, Save, X, AlertTriangle } from 'lucide-react';

interface QoyodProps {
  accounts: Account[];
  onAdd: (name: string, code: string) => void;
  onUpdate: (id: string, updates: Partial<Account>) => void;
  onDelete: (id: string) => void;
}

export const Qoyod: React.FC<QoyodProps> = ({ accounts, onAdd, onUpdate, onDelete }) => {
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');

  // Delete Modal
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onAdd(newName, newCode);
      setNewName('');
      setNewCode('');
    }
  };

  const startEditing = (acc: Account) => {
    setEditingId(acc.id);
    setEditName(acc.name);
    setEditCode(acc.code || '');
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdate(editingId, { name: editName, code: editCode });
      setEditingId(null);
    }
  };

  const promptDelete = (id: string) => {
    setDeleteId(id);
    setDeleteConfirmText('');
  };

  const confirmDelete = () => {
    if (deleteId && deleteConfirmText.toLowerCase() === 'delete') {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 relative">
      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl text-center">
            <div className="flex justify-center text-red-500 mb-4"><AlertTriangle size={48} /></div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Account?</h3>
            <p className="text-sm text-gray-500 mb-4">
               Type <strong>delete</strong> to confirm removal of this account code.
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
                 onClick={confirmDelete}
                 disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                 className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Delete
               </button>
               <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
           <BookOpen size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Qoyod (Chart of Accounts)</h2>
          <p className="text-gray-500">Manage account codes for accounting entries.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-4 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700">
             Defined Accounts
           </div>
           <ul className="divide-y divide-gray-100">
             {accounts.map(acc => {
               const isEditing = editingId === acc.id;
               return (
                <li key={acc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group">
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input 
                        value={editCode} 
                        onChange={e => setEditCode(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        className="border rounded px-2 py-1 text-sm w-24" 
                        placeholder="Code" 
                      />
                      <input 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        className="border rounded px-2 py-1 text-sm flex-1" 
                        placeholder="Account Name" 
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                        {acc.code && <span className="text-xs font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded">{acc.code}</span>}
                        <span className="font-medium text-gray-800">{acc.name}</span>
                    </div>
                  )}
                  
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    {isEditing ? (
                      <>
                        <button onClick={saveEdit} className="text-green-600 hover:bg-green-100 p-1 rounded"><Save size={16}/></button>
                        <button onClick={() => setEditingId(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded"><X size={16}/></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEditing(acc)} className="text-gray-400 hover:text-blue-500"><Edit2 size={16} /></button>
                        <button onClick={() => promptDelete(acc.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </li>
               );
             })}
             {accounts.length === 0 && <li className="p-6 text-center text-gray-400">No accounting codes defined yet.</li>}
           </ul>
        </div>

        {/* Add Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
           <h3 className="text-lg font-bold text-gray-800 mb-4">Add Account</h3>
           <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name (Arabic/English)</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. اشتراكات تسويق"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Code (Optional)</label>
                <input 
                  type="text" 
                  value={newCode} 
                  onChange={e => setNewCode(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. 4001"
                />
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 flex justify-center items-center gap-2">
                <Plus size={18} /> Add Account
              </button>
           </form>
        </div>
      </div>
    </div>
  );
};
