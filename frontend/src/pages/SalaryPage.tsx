import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { SalaryPayroll, PaymentMethod } from '../types/index.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { PrintablePayslipModal } from '../components/receipts/PrintablePayslipModal.tsx';
import { Search, Printer, CheckCircle2, Wallet, Info } from 'lucide-react';
import { useMoney } from '../utils/money.ts';

interface StaffDue {
  staffId: string;
  staffName: string;
  designation: string;
  totalDue: number;
  months: SalaryPayroll[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const todayStr = () => new Date().toISOString().split('T')[0];
const shortMonth = (p: SalaryPayroll) => `${p.month.slice(0, 3)} ${p.year}`;

export const SalaryPage: React.FC = () => {
  const money = useMoney();
  const { activeSchool, showNotification } = useAuth();

  const [payrolls, setPayrolls] = useState<SalaryPayroll[]>([]);
  const [dues, setDues] = useState<StaffDue[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // History filters
  const thisYear = new Date().getFullYear();
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState<number | 'all'>(thisYear);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Pay modal
  const [payFor, setPayFor] = useState<StaffDue | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [payDate, setPayDate] = useState(todayStr());
  const [payRemarks, setPayRemarks] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const [selectedPayslip, setSelectedPayslip] = useState<SalaryPayroll | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params: any = { status: statusFilter, search };
      if (monthFilter !== 'all') params.month = monthFilter;
      if (yearFilter !== 'all') params.year = yearFilter;
      const res = await api.salary.getAll(params);
      if (res.success) {
        setPayrolls(res.payrolls);
        setDues(res.dues || []);
        setAnalytics(res.analytics);
      }
    } catch (err: any) {
      showNotification('Could not load salaries: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [monthFilter, yearFilter, statusFilter, search, activeSchool]);

  // Total still owed for the months ticked in the pay window
  const selectedTotal = (payFor?.months || [])
    .filter(m => selectedIds.includes(m.payrollId))
    .reduce((s, m) => s + (m.dueAmount || 0), 0);

  const openPay = (d: StaffDue) => {
    setPayFor(d);
    setSelectedIds(d.months.map(m => m.payrollId)); // all months ticked by default
    setPayAmount(String(d.totalDue));
    setPayMethod('Cash');
    setPayDate(todayStr());
    setPayRemarks('');
  };

  const toggleMonth = (id: string) => {
    if (!payFor) return;
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    setSelectedIds(next);
    const total = payFor.months.filter(m => next.includes(m.payrollId)).reduce((s, m) => s + (m.dueAmount || 0), 0);
    setPayAmount(total ? String(Math.round(total * 100) / 100) : '');
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payFor) return;
    const amount = Number(payAmount);
    if (selectedIds.length === 0) return showNotification('Tick at least one month to pay.', 'error');
    if (!(amount > 0)) return showNotification('Enter an amount greater than 0.', 'error');
    if (amount > selectedTotal + 0.001) return showNotification(`You can pay at most ${money(selectedTotal)} for the ticked months.`, 'error');

    setIsPaying(true);
    try {
      const res = await api.salary.pay({
        staffId: payFor.staffId,
        payrollIds: selectedIds,
        amount,
        paymentMethod: payMethod,
        paymentDate: payDate,
        remarks: payRemarks,
      });
      if (res.success) {
        showNotification(res.message, 'success');
        setPayFor(null);
        fetchData();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setIsPaying(false);
    }
  };

  const statusBadge = (s: string) =>
    s === 'paid' ? <Badge variant="emerald">Paid</Badge> :
    s === 'partial' ? <Badge variant="amber">Part paid</Badge> :
    <Badge variant="rose">Pending</Badge>;

  const leftAfter = Math.max(0, selectedTotal - (Number(payAmount) || 0));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Salary</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-2xl">
          Salary becomes due after each full month of work, counted from the staff member's salary start date.
          Unpaid months add up until you pay them.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-brand-700 text-white shadow-lg">
          <span className="text-xs text-brand-100 block">Salary owed now</span>
          <span className="text-3xl font-bold mt-1 block">{money(analytics?.totalDueNow || 0)}</span>
          <span className="text-xs text-brand-200 mt-1 block">
            {analytics?.staffWithDues || 0} staff member{(analytics?.staffWithDues || 0) === 1 ? '' : 's'} waiting to be paid
          </span>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-brand-100">
          <span className="text-xs text-slate-500 block">Paid (shown in history below)</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{money(analytics?.totalPaid || 0)}</span>
          <span className="text-xs text-slate-500 mt-1 block">{analytics?.paidCount || 0} months fully paid</span>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-brand-100">
          <span className="text-xs text-slate-500 block">Still pending (shown below)</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">{money(analytics?.totalPending || 0)}</span>
          <span className="text-xs text-slate-500 mt-1 block">{analytics?.pendingCount || 0} months not fully paid</span>
        </div>
      </div>

      {/* Salary due, grouped by staff */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-brand-700" />
          <h2 className="font-bold text-slate-900 text-sm">Salary to pay</h2>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-slate-400 text-xs">Loading…</div>
        ) : dues.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-slate-500">
            <CheckCircle2 className="w-6 h-6 text-brand-600 mx-auto mb-2" />
            Everyone is paid up. New salary appears here when a staff member finishes another month of work.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dues.map(d => (
              <div key={d.staffId} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-brand-50/30">
                <div className="md:w-56 shrink-0">
                  <span className="font-bold text-slate-900 block text-sm">{d.staffName}</span>
                  <span className="text-[11px] text-slate-500">{d.designation} • {d.staffId}</span>
                </div>

                <div className="flex-1 flex flex-wrap gap-1.5">
                  {d.months.map(m => (
                    <span
                      key={m.payrollId}
                      title={m.periodStart ? `${m.periodStart} to ${m.periodEnd}` : undefined}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                        m.status === 'partial'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-brand-50 text-brand-800 border-brand-200'
                      }`}
                    >
                      {shortMonth(m)}: {money(m.dueAmount)}
                      {m.status === 'partial' && ' left'}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3 md:justify-end">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">
                      {d.months.length} month{d.months.length === 1 ? '' : 's'}
                    </span>
                    <span className="font-bold text-slate-900 text-base">{money(d.totalDue)}</span>
                  </div>
                  <button
                    onClick={() => openPay(d)}
                    className="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Pay salary
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payslip history */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <h2 className="font-bold text-slate-900 text-sm">Payslip history</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or ID"
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <select
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg font-semibold cursor-pointer"
            >
              <option value="all">All months</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg font-semibold cursor-pointer"
            >
              <option value="all">All years</option>
              {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg font-semibold cursor-pointer"
            >
              <option value="all">All</option>
              <option value="unpaid">Not fully paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Part paid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-3 px-4">Staff</th>
                <th className="py-3 px-4">Month worked</th>
                <th className="py-3 px-4 text-right">Net salary</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Payslip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">Loading…</td></tr>
              ) : payrolls.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">No payslips match these filters.</td></tr>
              ) : (
                payrolls.map(p => (
                  <tr key={p.payrollId} className="hover:bg-brand-50/30">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{p.staffName}</span>
                      <span className="text-[11px] text-slate-400">{p.payrollId}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 block">{p.month} {p.year}</span>
                      {p.periodStart && <span className="text-[11px] text-slate-500">{p.periodStart} to {p.periodEnd}</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">{money(p.netSalary)}</td>
                    <td className="py-3 px-4 text-right text-slate-700">{money(p.paidAmount || 0)}</td>
                    <td className={`py-3 px-4 text-right font-bold ${(p.dueAmount || 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {money(p.dueAmount || 0)}
                    </td>
                    <td className="py-3 px-4 text-center">{statusBadge(p.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedPayslip(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg font-bold text-[11px] cursor-pointer"
                      >
                        <Printer className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay salary window */}
      <Modal
        isOpen={!!payFor}
        onClose={() => setPayFor(null)}
        title={`Pay salary: ${payFor?.staffName ?? ''}`}
        subtitle={payFor?.designation}
        maxWidth="lg"
      >
        {payFor && (
          <form onSubmit={handlePay} className="space-y-4 text-xs">
            <div>
              <span className="block font-bold text-slate-700 mb-2">Which months are you paying for?</span>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {payFor.months.map(m => {
                  const checked = selectedIds.includes(m.payrollId);
                  return (
                    <label
                      key={m.payrollId}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${checked ? 'bg-brand-50/60' : 'hover:bg-slate-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMonth(m.payrollId)}
                        className="w-4 h-4 accent-brand-700 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="font-bold text-slate-900 block">{m.month} {m.year}</span>
                        {m.periodStart && <span className="text-[11px] text-slate-500">{m.periodStart} to {m.periodEnd}</span>}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">{money(m.dueAmount)}</span>
                        {(m.paidAmount || 0) > 0 && (
                          <span className="text-[11px] text-slate-500">
                            {money(m.paidAmount)} of {money(m.netSalary)} already paid
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 px-1 font-bold text-slate-700">
                <span>Total for ticked months</span>
                <span>{money(selectedTotal)}</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount to pay now *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                max={selectedTotal || undefined}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base font-bold focus:ring-2 focus:ring-brand-600"
              />
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                {leftAfter > 0
                  ? <span>You can pay less than the total. <b className="text-amber-700">{money(leftAfter)}</b> will stay pending. The oldest month is paid first.</span>
                  : <span>This pays the ticked months in full.</span>}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Paid by</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer focus:ring-2 focus:ring-brand-600"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online/UPI">Online</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment date</label>
                <input
                  type="date"
                  value={payDate}
                  max={todayStr()}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Note (optional)</label>
              <input
                type="text"
                value={payRemarks}
                onChange={e => setPayRemarks(e.target.value)}
                placeholder="e.g. Cheque no. 004512"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayFor(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPaying}
                className="px-5 py-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-bold rounded-lg shadow-md cursor-pointer"
              >
                {isPaying ? 'Saving…' : `Pay ${money(Number(payAmount) || 0)}`}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <PrintablePayslipModal
        isOpen={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        payroll={selectedPayslip}
        school={activeSchool}
      />
    </div>
  );
};