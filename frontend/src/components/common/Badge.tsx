import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'purple' | 'emerald' | 'amber' | 'rose' | 'slate' | 'blue';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'purple', size = 'sm' }) => {
  const variantStyles = {
    purple: 'bg-brand-50 text-brand-700 border-brand-200 ring-1 ring-brand-500/10',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-500/10',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-500/10',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-500/10',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 ring-1 ring-slate-500/10',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-500/10',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-xs font-semibold',
    md: 'px-3 py-1 text-sm font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border tracking-wide uppercase ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        variant === 'emerald' ? 'bg-emerald-500' :
        variant === 'rose' ? 'bg-rose-500' :
        variant === 'amber' ? 'bg-amber-500' :
        variant === 'blue' ? 'bg-blue-500' :
        variant === 'purple' ? 'bg-brand-500' : 'bg-slate-400'
      }`} />
      {children}
    </span>
  );
};
