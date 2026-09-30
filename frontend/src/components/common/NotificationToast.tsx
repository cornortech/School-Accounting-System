import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { notification, dismissNotification } = useAuth();

  if (!notification) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-brand-600 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-200 bg-white shadow-emerald-500/10',
    error: 'border-rose-200 bg-white shadow-rose-500/10',
    info: 'border-brand-200 bg-white',
  };

  return (
    <div className="fixed top-5 right-5 z-50 max-w-md animate-in slide-in-from-top-2 duration-300">
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl ${borders[notification.type]}`}
      >
        {icons[notification.type]}
        <div className="flex-1 text-sm font-medium text-slate-800 leading-snug">
          {notification.message}
        </div>
        <button
          onClick={dismissNotification}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
