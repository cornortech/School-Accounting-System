import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ReceiptText,
  Users,
  BarChart3,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '../config.ts';

const features = [
  { icon: ReceiptText, text: 'Fee collection with printed receipts' },
  { icon: Users, text: 'Staff salaries and payslips' },
  { icon: BarChart3, text: 'Cash book, expenses and yearly reports' },
];

const inputClass =
  'w-full pl-10 pr-3 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 ' +
  'placeholder:text-slate-400 transition-shadow ' +
  'focus:outline-none focus:ring-4 focus:ring-violet-200 focus:border-violet-600';

export const LoginPage: React.FC = () => {
  const { login, loginError, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password && !isLoading) await login(email.trim(), password);
  };

  return (
    <div className="min-h-screen bg-violet-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl shadow-violet-900/10 border border-violet-100 overflow-hidden grid grid-cols-1 md:grid-cols-5">
        {/* Brand panel */}
        <aside className="relative md:col-span-2 bg-gradient-to-br from-violet-800 via-violet-700 to-purple-900 text-white p-7 sm:p-9 flex flex-col justify-between overflow-hidden">
          {/* soft background shapes */}
          <div aria-hidden className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-20 -left-12 w-64 h-64 rounded-full bg-fuchsia-500/20" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white text-violet-800 flex items-center justify-center font-bold shadow-md">
                {APP_NAME.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-semibold leading-tight">{APP_NAME}</p>
                <p className="text-xs text-violet-200">{APP_TAGLINE}</p>
              </div>
            </div>

            {/* Receipt preview: the one memorable element */}
            <div
              aria-hidden
              className="hidden md:block mt-10 -rotate-2 bg-white text-slate-800 rounded-2xl p-4 shadow-2xl shadow-violet-950/40 max-w-[15rem]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-violet-800">Fee receipt</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                  Paid
                </span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-2 w-3/4 rounded bg-slate-200" />
                <div className="h-2 w-1/2 rounded bg-slate-200" />
              </div>
              <div className="mt-4 pt-3 border-t border-dashed border-slate-300 flex items-center justify-between">
                <span className="text-xs text-slate-500">Total</span>
                <span className="h-3 w-16 rounded bg-violet-200" />
              </div>
            </div>

            <ul className="mt-8 space-y-4 text-sm text-violet-50">
              {features.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-violet-100" />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative mt-10 text-xs text-violet-200 flex gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              Each school's records are kept separate. Ask your administrator if you need an account.
            </span>
          </p>
        </aside>

        {/* Form panel */}
        <main className="md:col-span-3 p-7 sm:p-12 flex flex-col justify-center">
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Sign in with the email and password given by your school or administrator.
          </p>

          {loginError && (
            <div
              role="alert"
              className="mt-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex gap-2.5"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5" aria-busy={isLoading}>
            <div>
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative mt-1.5">
                <Mail className="w-4 h-4 text-violet-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative mt-1.5">
                <Lock className="w-4 h-4 text-violet-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyUp={e => setCapsOn(e.getModifierState('CapsLock'))}
                  onBlur={() => setCapsOn(false)}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-violet-700 hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {capsOn && (
                <p className="mt-1.5 text-xs text-amber-700" role="status">
                  Caps Lock is on.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-violet-700 hover:bg-violet-800 active:bg-violet-900 text-white font-medium text-sm rounded-xl shadow-md shadow-violet-700/30 transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />}
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-xs text-slate-400 text-center">
            Forgot your password? Ask your school administrator to reset it.
          </p>
        </main>
      </div>
    </div>
  );
};