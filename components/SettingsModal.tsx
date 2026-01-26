import React, { useState } from 'react';
import { X, Save, Lock, User, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface SettingsModalProps {
  currentUser: { name: string; email: string; id: string };
  onClose: () => void;
  onUpdateUser: (user: { name: string; email: string; id: string }) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ currentUser, onClose, onUpdateUser }) => {
  const [name, setName] = useState(currentUser.name);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password && password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.updateProfile({ name, password });
      onUpdateUser(res.user);
      setSuccess('Profile updated successfully!');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="bg-[#1e1b4b] p-4 flex justify-between items-center text-white">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <User size={20} /> Admin Settings
          </h3>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm flex items-center gap-2 border border-red-200">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 p-3 rounded text-sm border border-green-200 text-center font-bold">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password (Optional)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="password"
                placeholder="Leave blank to keep current"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {password && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full border rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:outline-none ${
                    password === confirmPassword ? 'border-green-300 focus:ring-green-500' : 'border-red-300 focus:ring-red-500'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 transition font-medium flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>Saving...</>
              ) : (
                <>
                  <Save size={18} /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
