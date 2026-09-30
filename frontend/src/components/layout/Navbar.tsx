import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Badge } from '../common/Badge.tsx';
import { APP_NAME, APP_TAGLINE } from '../../config.ts';
import { LogOut, School, Shield, User as UserIcon, AlertTriangle } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, activeSchool, logout } = useAuth();

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'super_admin': return 'purple';
      case 'school_admin': return 'blue';
      case 'accountant': return 'emerald';
      case 'reception': return 'amber';
      default: return 'slate';
    }
  };

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'school_admin': return 'School Admin';
      case 'accountant': return 'Chief Accountant';
      case 'reception': return 'Front Desk / Reception';
      default: return role || '';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-brand-100 shadow-xs">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between px-4 sm:px-6 py-2.5 gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center text-white shadow-md font-bold text-xl tracking-tight">
              EL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-lg">{APP_NAME}</span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">{APP_TAGLINE}</p>
            </div>
          </div>

          {/* Active School Badge */}
          {user?.role !== 'super_admin' && activeSchool && (
            <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200 ml-3">
              <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 font-bold text-xs">
                <School className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block leading-tight">{activeSchool.name}</span>
                <span className="text-[10px] text-brand-700 font-semibold">{activeSchool.schoolId} • {activeSchool.currency}</span>
              </div>
            </div>
          )}

          {user?.role === 'super_admin' && (
            <div className="hidden md:flex items-center gap-1.5 pl-4 border-l border-slate-200 ml-3 text-xs font-semibold text-brand-800 bg-brand-50/80 px-2.5 py-1 rounded-md">
              <Shield className="w-3.5 h-3.5 text-brand-600" />
              <span>Platform admin</span>
            </div>
          )}
        </div>

        {/* Right: User Profile & Logout */}
        <div className="flex items-center justify-end gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-full">
            <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {user?.name?.charAt(0) || <UserIcon className="w-3.5 h-3.5" />}
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs font-bold text-slate-800 block leading-tight">{user?.name}</span>
              <span className="text-[10px] text-brand-700 font-semibold">{getRoleDisplayName(user?.role)}</span>
            </div>
            <Badge variant={getRoleBadgeVariant(user?.role)} size="sm">
              {user?.role?.replace('_', ' ')}
            </Badge>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
