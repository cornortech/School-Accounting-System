import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { LayoutDashboard, GraduationCap, CreditCard, ReceiptText, Users, Wallet, TrendingDown, BookOpen, FileSpreadsheet, Building2, ShieldCheck, ChevronRight, UserCog }from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, activeTab, setActiveTab, activeSchool } = useAuth();

  const isSuperAdmin = user?.role === 'super_admin';
  const role = user?.role;

  interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    roles: string[];
    badge?: string;
  }

  const navItems: NavItem[] = [
    // Super Admin items
    {
      id: 'schools',
      label: 'School Accounts',
      icon: <Building2 className="w-4 h-4" />,
      roles: ['super_admin'],
    },
    // School items
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      roles: ['school_admin', 'accountant', 'reception'],
    },
    {
      id: 'students',
      label: 'Student Records',
      icon: <GraduationCap className="w-4 h-4" />,
      roles: ['school_admin', 'reception'],
    },
    {
      id: 'fees',
      label: 'Fee Management',
      icon: <CreditCard className="w-4 h-4" />,
      roles: ['school_admin', 'accountant', 'reception'],
    },
    {
      id: 'billing',
      label: 'Billing & Receipts',
      icon: <ReceiptText className="w-4 h-4" />,
      roles: ['school_admin', 'accountant', 'reception'],
    },
    {
      id: 'staff',
      label: 'Staff Directory',
      icon: <Users className="w-4 h-4" />,
      roles: ['school_admin'],
    },
    {
      id: 'salary',
      label: 'Salary & Payroll',
      icon: <Wallet className="w-4 h-4" />,
      roles: ['school_admin', 'accountant'],
    },
    {
      id: 'expenses',
      label: 'Expense Tracker',
      icon: <TrendingDown className="w-4 h-4" />,
      roles: ['school_admin', 'accountant'],
    },
    {
      id: 'ledger',
      label: 'Cash Book',
      icon: <BookOpen className="w-4 h-4" />,
      roles: ['school_admin', 'accountant'],
    },
    {
      id: 'reports',
      label: 'Financial Reports',
      icon: <FileSpreadsheet className="w-4 h-4" />,
            roles: ['school_admin', 'accountant'],
    },
    {
      id: 'users',
      label: 'User Accounts',
      icon: <UserCog className="w-4 h-4" />,
      roles: ['school_admin'],
    },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role || ''));

  return (
    <aside className="w-full lg:w-64 bg-white border-r border-brand-100 flex flex-col shrink-0 min-h-[calc(100vh-61px)]">
      {/* Current school */}
      <div className="p-4 border-b border-brand-100/70 bg-brand-50/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-700 text-white flex items-center justify-center font-bold text-sm shadow-md">
            {isSuperAdmin ? <ShieldCheck className="w-5 h-5" /> : (activeSchool?.code || 'SCH')}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-bold text-slate-900 truncate">
              {isSuperAdmin ? 'All schools' : activeSchool?.name}
            </h4>
            <p className="text-[11px] text-brand-700 font-semibold truncate">
              {isSuperAdmin ? 'Platform admin' : activeSchool?.schoolId}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Menu
        </div>

        {visibleItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group cursor-pointer ${
                isActive
                  ? 'bg-brand-700 text-white shadow-md font-bold'
                  : 'text-slate-600 hover:text-brand-700 hover:bg-brand-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-600'}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                      isActive ? 'bg-brand-800 text-brand-200' : 'bg-brand-100 text-brand-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-brand-300" />}
              </div>
            </button>
          );
        })}
      </nav>

    </aside>
  );
};
