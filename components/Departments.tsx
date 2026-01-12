
import React, { useState } from 'react';
import { Department } from '../types';
import { Trash2, Plus, Users, Edit2, Save, X, AlertTriangle } from 'lucide-react';

interface DepartmentsProps {
  departments: Department[];
  onAdd: (name: string, color: string) => void;
  onUpdate: (id: string, updates: Partial<Department>) => void;
  onDelete: (id: string) => void;
}

const PRESET_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];

export const Departments: React.FC<DepartmentsProps> = ({ departments, onAdd, onUpdate, onDelete }) => {
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // Delete Modal
  const [deleteDeptId, setDeleteDeptId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onAdd(newName, selectedColor);
      setNewName('');
    }
  };

  const startEditing = (dept: Department) => {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditColor(dept.color);
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdate(editingId, { name: editName, color: editColor });
      setEditingId(null);
    }
  };

  const promptDelete = (id: string) => {
    setDeleteDeptId(id);
    setDeleteConfirmText('');
  };

  const confirmDelete = () => {
    if (deleteDeptId && deleteConfirmText.toLowerCase() === 'delete') {
      onDelete(deleteDeptId);
      setDeleteDeptId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 relative">
      {/* Delete Confirmation Modal */}
      {deleteDeptId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl text-center">
            <div className="flex justify-center text-red-500 mb-4"><AlertTriangle size={48} /></div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Department?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will remove the department from allocation options. Type <strong>delete</strong> to confirm.
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
               <button onClick={() => setDeleteDeptId(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}


      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-purple-100 rounded-full text-purple-600">
           <Users size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Departments</h2>
          <p className="text-gray-500">Organize subscriptions by company teams.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-4 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700">
             Existing Departments
           </div>
           <ul className="divide-y divide-gray-100">
             {departments.map(dept => {
               const isEditing = editingId === dept.id;
               return (
                <li key={dept.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group">
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex gap-1">
                        {PRESET_COLORS.slice(0,3).map(c => (
                           <button key={c} onClick={() => setEditColor(c)} className={`w-4 h-4 rounded-full ${editColor === c ? 'ring-2 ring-gray-400' : ''}`} style={{backgroundColor: c}} />
                        ))}
                      </div>
                      <input 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        className="border rounded px-2 py-1 text-sm flex-1" 
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: dept.color }}></div>
                        <span className="font-medium text-gray-800">{dept.name}</span>
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
                        <button onClick={() => startEditing(dept)} className="text-gray-400 hover:text-blue-500"><Edit2 size={16} /></button>
                        <button onClick={() => promptDelete(dept.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </li>
               );
             })}
             {departments.length === 0 && <li className="p-6 text-center text-gray-400">No departments added yet.</li>}
           </ul>
        </div>

        {/* Add Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
           <h3 className="text-lg font-bold text-gray-800 mb-4">Add Department</h3>
           <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="e.g. Engineering"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color Tag</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full transition-transform ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 flex justify-center items-center gap-2">
                <Plus size={18} /> Add Department
              </button>
           </form>
        </div>
      </div>
    </div>
  );
};
