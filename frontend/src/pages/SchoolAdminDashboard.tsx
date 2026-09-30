import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Badge } from '../components/common/Badge.tsx';
import { PrintableReceiptModal } from '../components/receipts/PrintableReceiptModal.tsx';
import { PaymentReceipt } from '../types/index.ts';
import { GraduationCap, Banknote, TrendingDown, AlertCircle, Users, Wallet, ArrowUpRight, ArrowDownRight, ReceiptText, PlusCircle, Eye, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { useMoney } from '../utils/money.ts';

export const SchoolAdminDashboard: React.FC = () => {
  const money = useMoney();
  const { activeSchool, setActiveTab, showNotification } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);

  const fetchSummary = async () => {
    setIsLoading(true);
    try {
      const res = await api.reports.getSummary();
      if (res.success) {
        setData(res);
      }
    } catch (err: any) {
      showNotification('Failed to load dashboard metrics: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [activeSchool]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-3">
        <span className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <span className="font-semibold text-sm">Calculating school accounting metrics...</span>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const monthlyTrends = data?.monthlyTrends || [];
  const recentReceipts: PaymentReceipt[] = data?.recentReceipts || [];
  const pendingStudents = data?.pendingStudents || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-brand-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-200 font-medium">Overview</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-white">
            {activeSchool?.name || 'School Dashboard'}
          </h1>
          <p className="text-xs text-brand-200 mt-0.5">
            {activeSchool?.principalName ? `Principal: ${activeSchool.principalName} | ` : ''}
            School Code: <span className="font-mono font-bold text-white">{activeSchool?.code}</span>
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('billing')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-brand-900 hover:bg-brand-50 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            <ReceiptText className="w-4 h-4 text-brand-700" />
            <span>Collect Fee</span>
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-700/60 hover:bg-brand-700 border border-white/20 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Enroll Student</span>
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-700/60 hover:bg-brand-700 border border-white/20 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            <TrendingDown className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Fee Collected */}
        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Fee Collections</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-slate-900">
              {money((kpis.totalFeeCollected || 0))}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{kpis.collectionEfficiency || 0}% collected</span>
            </div>
          </div>
        </div>

        {/* Pending Fee */}
        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Dues</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-amber-600">
              {money((kpis.totalPendingFee || 0))}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">Still to collect</span>
          </div>
        </div>

        {/* Overdue Fee */}
        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overdue Dues</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-rose-600">
              {money((kpis.totalOverdueFee || 0))}
            </span>
            <span className="text-[11px] text-rose-500 font-medium block mt-1">Past the due date</span>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Operating Expenses</span>
            <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-brand-900">
              {money((kpis.totalOperationalExpenses || 0))}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">Supplies, repairs & IT</span>
          </div>
        </div>

        {/* Net Salary Paid */}
        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Staff Salaries</span>
            <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-brand-900">
              {money((kpis.totalSalaryPaid || 0))}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              {money((kpis.totalSalaryPending || 0))} pending
            </span>
          </div>
        </div>

        {/* Net Reserve / Cash Flow */}
        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Surplus / deficit</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              (kpis.netSurplus || 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className={`text-xl font-bold ${
              (kpis.netSurplus || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {money((kpis.netSurplus || 0))}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">Fees minus spending</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart & Pending Dues */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Income vs Expense Visual Bar Chart */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-brand-100 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Money in and out</h3>
              <p className="text-xs text-slate-500">Fees collected vs expenses and salaries, last 6 months</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-brand-800">
                <span className="w-3 h-3 bg-brand-600 rounded-sm" /> Income
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 bg-slate-300 rounded-sm" /> Expenditure
              </span>
            </div>
          </div>

          {/* Bar Visualizer */}
          <div className="h-56 flex items-end justify-between gap-4 pt-4 pb-2 border-b border-slate-100">
            {monthlyTrends.map((trend: any, idx: number) => {
              const maxVal = Math.max(...monthlyTrends.map((t: any) => Math.max(t.income, t.expense)), 6000);
              const incomeHeight = Math.max(12, Math.round((trend.income / maxVal) * 160));
              const expenseHeight = Math.max(12, Math.round((trend.expense / maxVal) * 160));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="text-[10px] font-bold text-slate-400 group-hover:text-brand-700 transition-colors">
                    {money(trend.income)}
                  </div>
                  <div className="w-full flex items-end justify-center gap-1.5 h-44">
                    {/* Income Bar (Purple) */}
                    <div
                      style={{ height: `${incomeHeight}px` }}
                      className="w-1/2 max-w-[28px] bg-brand-700 rounded-t-md transition-all group-hover:brightness-110 shadow-xs"
                      title={`Income: ${money(trend.income)}`}
                    />
                    {/* Expense Bar (Neutral Slate) */}
                    <div
                      style={{ height: `${expenseHeight}px` }}
                      className="w-1/2 max-w-[28px] bg-slate-300 rounded-t-md transition-all group-hover:bg-slate-400"
                      title={`Expenditure: ${money(trend.expense)}`}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 mt-1">{trend.month}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 text-[11px] text-slate-500">
            <span>From the cash book</span>
            <button
              onClick={() => setActiveTab('reports')}
              className="text-brand-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              View detailed P&L statement <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Top Outstanding Fee Balances */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-brand-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">Highest Pending Dues</h3>
                <p className="text-xs text-slate-500">Students with outstanding balances</p>
              </div>
              <button
                onClick={() => setActiveTab('fees')}
                className="text-xs font-bold text-brand-700 hover:underline cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {pendingStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-1 opacity-60" />
                  All students are fully settled!
                </div>
              ) : (
                pendingStudents.map((st: any) => (
                  <div
                    key={st.studentId}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-brand-50/40 transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{st.fullName}</span>
                      <span className="text-[11px] text-slate-500">
                        {st.class} • {st.admissionNo}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-semibold text-amber-600 block">
                        {money(st.pendingAmount)}
                      </span>
                      <button
                        onClick={() => setActiveTab('billing')}
                        className="text-[10px] font-bold text-brand-700 hover:text-brand-900 hover:underline cursor-pointer"
                      >
                        Collect Fee →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Recent Receipts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-semibold text-sm text-slate-900">Recent Payment Receipts</h3>
            <p className="text-xs text-slate-500">Latest fee receipts</p>
          </div>
          <button
            onClick={() => setActiveTab('billing')}
            className="text-xs font-bold text-brand-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Receipt Journal</span> <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Print Voucher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No receipts issued yet.
                  </td>
                </tr>
              ) : (
                recentReceipts.map(rcp => (
                  <tr key={rcp.receiptNumber} className="hover:bg-brand-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-900">
                      {rcp.receiptNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {rcp.studentName}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {rcp.class}
                    </td>
                    <td className="py-3 px-4 text-slate-700 uppercase font-semibold">
                      {rcp.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {rcp.paymentDate}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                      {money(rcp.paidAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={rcp.status === 'valid' ? 'emerald' : 'rose'}>
                        {rcp.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedReceipt(rcp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Print Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      <PrintableReceiptModal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        receipt={selectedReceipt}
        school={activeSchool}
      />
    </div>
  );
};
