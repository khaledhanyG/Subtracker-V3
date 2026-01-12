
import React, { useState } from 'react';
import { Lock, User, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLogin: (success: boolean) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay for effect
    setTimeout(() => {
      if (username === 'AdminL' && password === 'Llaifeafd281ai*@') {
        onLogin(true);
      } else {
        setError('Invalid credentials. Access denied.');
        setIsLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header Section */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-center text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-sm mb-4 shadow-inner">
             <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">SubTrack AI</h1>
          <p className="text-indigo-100 mt-2 text-sm">Secure Expense & Subscription Management</p>
        </div>

        {/* Login Form */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-pulse">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-gray-50 focus:bg-white outline-none"
                  placeholder="Enter username"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-gray-50 focus:bg-white outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? 'Authenticating...' : 'Access Dashboard'}
              {!isLoading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Authorized personnel only. <br/> All access attempts are monitored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
