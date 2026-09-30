import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Badge } from '../components/common/Badge.tsx';
import { FileSpreadsheet, Printer, Download, Search, Filter, TrendingUp, TrendingDown, Banknote, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import { useMoney } from '../utils/money.ts';

export const ReportsPage: React.FC = () => {
  const money = useMoney();
  const { activeSchool, showNotification } = useAuth();
  const [activeReportTab, setActiveReportTab] = useState<
    'income-expense' | 'fee-collections' | 'pending-fees' | 'expenses' | 'salaries'
  >('income-expense');

  const [isLoading, setIsLoading] = useState(true);
  const [incomeExpenseData, setIncomeExpenseData] = useState<any>(null);
  const [feeCollectionData, setFeeCollectionData] = useState<any>(null);
  const [pendingFeeData, setPendingFeeData] = useState<any>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [method, setMethod] = useState('all');

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      if (activeReportTab === 'income-expense') {
        const res = await api.reports.getIncomeVsExpense();
        if (res.success) setIncomeExpenseData(res.statement);
      } else if (activeReportTab === 'fee-collections') {
        const res = await api.reports.getFeeCollections({ startDate, endDate, method });
        if (res.success) setFeeCollectionData(res);
      } else if (activeReportTab === 'pending-fees') {
        const res = await api.reports.getPendingFees();
        if (res.success) setPendingFeeData(res);
      }
    } catch (err: any) {
      showNotification('Failed to generate report: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeReportTab, startDate, endDate, method, activeSchool]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = (filename: string, rows: any[]) => {
    if (!rows || rows.length === 0) {
      showNotification('No data to export', 'info');
      return;
    }
    const headers = Object.keys(rows[0]).join(',');
    const csvContent = [
      headers,
      ...rows.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification(`Exported ${filename} successfully`, 'success');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial & Accounting Reports</h1>
            <Badge variant="purple">Audited Statements</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Export official income vs expenditure statements, collection records, and aging accounts receivable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex border-b border-brand-100 gap-4 text-xs font-bold no-print overflow-x-auto">
        <button
          onClick={() => setActiveReportTab('income-expense')}
          className={`pb-3 px-1 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeReportTab === 'income-expense'
              ? 'border-brand-700 text-brand-900'
              : 'border-transparent text-slate-500 hover:text-brand-700'
          }`}
        >
          Income vs Expense (P&L)
        </button>
        <button
          onClick={() => setActiveReportTab('fee-collections')}
          className={`pb-3 px-1 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeReportTab === 'fee-collections'
              ? 'border-brand-700 text-brand-900'
              : 'border-transparent text-slate-500 hover:text-brand-700'
          }`}
        >
          Fee Collection Journal
        </button>
        <button
          onClick={() => setActiveReportTab('pending-fees')}
          className={`pb-3 px-1 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeReportTab === 'pending-fees'
              ? 'border-brand-700 text-brand-900'
              : 'border-transparent text-slate-500 hover:text-brand-700'
          }`}
        >
          Outstanding & Overdue Dues
        </button>
      </div>

      {/* Report Content Container */}
      <div id="printable-document" className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        {/* Printable Header */}
        <div className="flex justify-between items-center pb-6 border-b-2 border-brand-900">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeSchool?.name}
            </h2>
            <p className="text-xs text-slate-500">
              Department of Accounts & Finance • School Code: {activeSchool?.code}
            </p>
          </div>
          <div className="text-right">
            <span className="px-2.5 py-0.5 rounded bg-brand-100 text-brand-800 text-xs font-bold uppercase">
              Financial Statement
            </span>
            <p className="text-xs text-slate-500 mt-1">Generated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* 1. Income vs Expense (P&L) */}
        {activeReportTab === 'income-expense' && incomeExpenseData && (
          <div className="space-y-6">
            <div className="flex items-center justify-between no-print">
              <h3 className="font-semibold text-base text-slate-900">
                Operating Income & Expenditure Statement (FY {incomeExpenseData.fiscalYear})
              </h3>
              <button
                onClick={() =>
                  handleExportCSV('Income_vs_Expense', [
                    { Metric: 'Total Fee Revenue', Value: incomeExpenseData.income.totalIncome },
                    { Metric: 'Staff Salary Expense', Value: incomeExpenseData.expenses.salaryExpenses },
                    { Metric: 'General Operating Expenses', Value: incomeExpenseData.expenses.generalExpenses },
                    { Metric: 'Total Expenditure', Value: incomeExpenseData.expenses.totalExpenses },
                    { Metric: 'Net Operating Surplus', Value: incomeExpenseData.netOperatingIncome },
                  ])
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs rounded-lg border border-brand-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-brand-50/50 border border-brand-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Fee Revenue</span>
                <span className="text-2xl font-bold text-emerald-600 mt-1 block">
                  {money(incomeExpenseData.income.totalIncome)}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">Cash inflows from students</span>
              </div>

              <div className="p-4 rounded-xl bg-brand-50/50 border border-brand-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Total School Outflows</span>
                <span className="text-2xl font-bold text-rose-600 mt-1 block">
                  {money(incomeExpenseData.expenses.totalExpenses)}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">Salaries + campus operations</span>
              </div>

              <div className="p-4 rounded-xl bg-brand-50/50 border border-brand-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Net Operating Surplus</span>
                <span className={`text-2xl font-bold mt-1 block ${
                  incomeExpenseData.netOperatingIncome >= 0 ? 'text-brand-900' : 'text-rose-600'
                }`}>
                  {money(incomeExpenseData.netOperatingIncome)}
                </span>
                <span className="text-[10px] text-brand-700 font-bold mt-1 block">
                  {incomeExpenseData.profitMargin}% Operating margin
                </span>
              </div>
            </div>

            {/* Breakdown Statement Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                    <th className="py-2.5 px-4">Account Head</th>
                    <th className="py-2.5 px-4 text-right">Amount ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-emerald-50/40 font-bold text-emerald-950">
                    <td className="py-2.5 px-4">Gross Student Tuition & Fee Collections</td>
                    <td className="py-2.5 px-4 text-right text-emerald-700">
                      {money(incomeExpenseData.income.feeCollections)}
                    </td>
                  </tr>

                  {Object.entries(incomeExpenseData.expenses.breakdown).map(([cat, amt]: any) => (
                    <tr key={cat} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 pl-8 text-slate-700 font-medium">Less: {cat}</td>
                      <td className="py-2.5 px-4 text-right text-rose-600 font-semibold">
                        -{money(amt)}
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-brand-900 text-white font-semibold text-sm">
                    <td className="py-3 px-4">NET OPERATING CASH SURPLUS</td>
                    <td className="py-3 px-4 text-right">
                      {money(incomeExpenseData.netOperatingIncome)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. Fee Collection Journal */}
        {activeReportTab === 'fee-collections' && feeCollectionData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between no-print">
              <h3 className="font-semibold text-base text-slate-900">
                Verified Fee Receipts Journal ({feeCollectionData.receipts?.length || 0} Transactions)
              </h3>
              <button
                onClick={() =>
                  handleExportCSV(
                    'Fee_Collection_Journal',
                    feeCollectionData.receipts.map((r: any) => ({
                      ReceiptNo: r.receiptNumber,
                      Student: r.studentName,
                      AdmissionNo: r.admissionNo,
                      Class: r.class,
                      Method: r.paymentMethod,
                      Date: r.paymentDate,
                      PaidAmount: r.paidAmount,
                      ReceivedBy: r.receivedBy,
                    }))
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs rounded-lg border border-brand-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Admission #</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Paid Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {feeCollectionData.receipts.map((rcp: any) => (
                    <tr key={rcp.receiptNumber} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-brand-900">{rcp.receiptNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">{rcp.studentName}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono">{rcp.admissionNo}</td>
                      <td className="py-2.5 px-3 text-slate-600">{rcp.class}</td>
                      <td className="py-2.5 px-3 font-semibold uppercase">{rcp.paymentMethod}</td>
                      <td className="py-2.5 px-3 text-slate-500">{rcp.paymentDate}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {money(rcp.paidAmount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-brand-50 font-bold text-brand-950">
                    <td colSpan={6} className="py-2.5 px-3 text-right">Total Collections:</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 text-sm">
                      {money(feeCollectionData.summary.totalCollected)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Pending & Overdue Fees */}
        {activeReportTab === 'pending-fees' && pendingFeeData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between no-print">
              <h3 className="font-semibold text-base text-slate-900">
                Outstanding & Overdue Accounts Receivable ({pendingFeeData.records?.length || 0} Students)
              </h3>
              <button
                onClick={() =>
                  handleExportCSV(
                    'Outstanding_Dues_Report',
                    pendingFeeData.records.map((r: any) => ({
                      Student: r.fullName,
                      AdmissionNo: r.admissionNo,
                      Class: r.class,
                      Parent: r.parentName,
                      Phone: r.parentPhone,
                      TotalFee: r.totalFee,
                      PaidAmount: r.paidAmount,
                      PendingAmount: r.pendingAmount,
                      Status: r.status,
                    }))
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs rounded-lg border border-brand-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Admission #</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Parent Name</th>
                    <th className="py-2.5 px-3">Parent Contact</th>
                    <th className="py-2.5 px-3 text-right">Total Assigned</th>
                    <th className="py-2.5 px-3 text-right">Amount Outstanding</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingFeeData.records.map((r: any) => (
                    <tr key={r.studentId} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-800">{r.fullName}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono">{r.admissionNo}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{r.class}</td>
                      <td className="py-2.5 px-3 text-slate-600">{r.parentName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{r.parentPhone}</td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {money(r.totalFee)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-600 text-sm">
                        {money(r.pendingAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant={r.status === 'overdue' ? 'rose' : 'amber'}>
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50 font-bold text-slate-900">
                    <td colSpan={6} className="py-2.5 px-3 text-right">Total Uncollected Receivables:</td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600 text-sm">
                      {money(pendingFeeData.summary.totalPending)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
