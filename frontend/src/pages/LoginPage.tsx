import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Lock, Mail, AlertCircle, ReceiptText, Users, BarChart3 } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '../config.ts';

const features = [
  { icon: ReceiptText, text: 'Fee collection with printed receipts' },
  { icon: Users, text: 'Staff salaries and payslips' },
  { icon: BarChart3, text: 'Cash book, expenses and yearly reports' },
];

export const LoginPage: React.FC = () => {
  const { login, loginError, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) await login(email.trim(), password);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-5">
        <aside className="md:col-span-2 bg-brand-800 text-white p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center font-bold">
                {APP_NAME.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-semibold leading-tight">{APP_NAME}</p>
                <p className="text-xs text-brand-100">{APP_TAGLINE}</p>
              </div>
            </div>

            <ul className="mt-10 space-y-4 text-sm text-brand-50">
              {features.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-brand-200 shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-10 text-xs text-brand-200">
            Each school's records are kept separate. Ask your administrator if you need an account.
          </p>
        </aside>

        <main className="md:col-span-3 p-8 sm:p-10">
          <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-500 mt-1">Use the email and password given by your school or administrator.</p>

          {loginError && (
            <div role="alert" className="mt-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-60"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
};
