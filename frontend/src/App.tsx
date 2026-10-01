import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { NotificationToast } from './components/common/NotificationToast.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard.tsx';
import { SchoolAdminDashboard } from './pages/SchoolAdminDashboard.tsx';
import { StudentsPage } from './pages/StudentsPage.tsx';
import { FeesPage } from './pages/FeesPage.tsx';
import { BillingPage } from './pages/BillingPage.tsx';
import { StaffPage } from './pages/StaffPage.tsx';
import { SalaryPage } from './pages/SalaryPage.tsx';
import { ExpensesPage } from './pages/ExpensesPage.tsx';
import { LedgerPage } from './pages/LedgerPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';

const AppContent: React.FC = () => {
  const { user, isLoading, activeTab } = useAuth();

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-700 flex items-center justify-center text-white font-bold text-xl shadow-lg animate-pulse">
            EL
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="w-3.5 h-3.5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <NotificationToast />
        <LoginPage />
      </>
    );
  }

  // Render appropriate module
  const renderContent = () => {
    switch (activeTab) {
      case 'schools':
        return <SuperAdminDashboard />;
      case 'dashboard':
        return <SchoolAdminDashboard />;
      case 'students':
        return <StudentsPage />;
      case 'fees':
        return <FeesPage />;
      case 'billing':
        return <BillingPage />;
      case 'staff':
        return <StaffPage />;
      case 'salary':
        return <SalaryPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'ledger':
        return <LedgerPage />;
      case 'reports':
        return <ReportsPage />;
              case 'users':
        return <UsersPage />;
      default:
        return user.role === 'super_admin' ? <SuperAdminDashboard /> : <SchoolAdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <NotificationToast />
      <Navbar />
      <div className="flex-1 flex flex-col lg:flex-row">
        <Sidebar />
        <main className="flex-1 min-w-0 bg-slate-50/60 pb-12 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
