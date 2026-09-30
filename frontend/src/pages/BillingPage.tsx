import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { PaymentReceipt, Student, PaymentMethod } from '../types/index.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { PrintableReceiptModal } from '../components/receipts/PrintableReceiptModal.tsx';
import { ReceiptText, Plus, Search, Filter, Eye, Printer, Ban, CheckCircle, Calendar, CreditCard, User, ArrowRight, Sparkles } from 'lucide-react';
import { useMoney } from '../utils/money.ts';

export const BillingPage: React.FC = () => {
  const money = useMoney();
  const { activeSchool, showNotification, user } = useAuth();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [receiptToCancel, setReceiptToCancel] = useState<PaymentReceipt | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Collect Payment Form
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [feeCategory, setFeeCategory] = useState('Tuition Fee');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rcpRes, stuRes] = await Promise.all([
        api.billing.getReceipts({
          search,
          paymentMethod: methodFilter,
          status: statusFilter,
          startDate,
          endDate,
        }),
        api.students.getAll(),
      ]);
      if (rcpRes.success) setReceipts(rcpRes.receipts);
      if (stuRes.success) setStudents(stuRes.students);
    } catch (err: any) {
      showNotification('Failed to load receipts: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, methodFilter, statusFilter, startDate, endDate, activeSchool]);

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    const stu = students.find(s => s.studentId === studentId);
    if (stu?.feeAccount) {
      // Pre-fill amount with pending fee
      setPaidAmount(stu.feeAccount.pendingAmount ? String(stu.feeAccount.pendingAmount) : '');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !paidAmount) return;

    try {
      const payload = {
        studentId: selectedStudentId,
        feeItems: [{ category: feeCategory.trim() || 'Fee Payment', amount: Number(paidAmount) + (Number(discount) || 0) }],
        paidAmount: Number(paidAmount),
        discount: Number(discount) || 0,
        paymentMethod,
        transactionRef,
        paymentDate,
        notes,
      };

      const res = await api.billing.recordPayment(payload);
      if (res.success) {
        showNotification(res.message, 'success');

        setIsCollectModalOpen(false);
        // Reset form
        setSelectedStudentId('');
        setPaidAmount('');
        setDiscount('0');
        setTransactionRef('');
        setNotes('');

        fetchData();
        // Immediately show the official printable receipt!
        setSelectedReceipt(res.receipt);
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleCancelReceipt = async () => {
    if (!receiptToCancel) return;
    try {
      const res = await api.billing.cancelReceipt(receiptToCancel.receiptNumber, cancelReason);
      if (res.success) {
        showNotification(res.message, 'info');
        setIsCancelModalOpen(false);
        setReceiptToCancel(null);
        setCancelReason('');
        fetchData();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const chosenStudent = students.find(s => s.studentId === selectedStudentId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Billing & Official Receipts</h1>
            <Badge variant="purple">Cashier Desk</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Accept fee settlements, issue verified print-ready receipts, and log double-entry revenue vouchers.
          </p>
        </div>

        <button
          onClick={() => setIsCollectModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <ReceiptText className="w-4 h-4" />
          <span>Collect Fee / New Receipt</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search receipt #, student name, admission #, ref..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Method:</span>
              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
              >
                <option value="all">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Online/UPI">Online / UPI</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
              >
                <option value="all">All</option>
                <option value="valid">Valid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>

        {/* Receipts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Student & Admission</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading payment records...</span>
                    </div>
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No receipts found matching your criteria.
                  </td>
                </tr>
              ) : (
                receipts.map(rcp => (
                  <tr key={rcp.receiptNumber} className="hover:bg-brand-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-900">
                      {rcp.receiptNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{rcp.studentName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{rcp.admissionNo}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {rcp.class}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 uppercase">{rcp.paymentMethod}</span>
                      {rcp.transactionRef && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {rcp.transactionRef}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedReceipt(rcp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        {rcp.status === 'valid' && (user?.role === 'super_admin' || user?.role === 'school_admin') && (
                          <button
                            onClick={() => {
                              setReceiptToCancel(rcp);
                              setIsCancelModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Void / Cancel Receipt"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Modal: Collect Fee & Generate Receipt */}
      <Modal
        isOpen={isCollectModalOpen}
        onClose={() => setIsCollectModalOpen(false)}
        title="Collect Fee & Issue Receipt"
        subtitle="Updates the student's balance and the cash book"
        maxWidth="2xl"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          {/* Student Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Select Student *</label>
            <select
              required
              value={selectedStudentId}
              onChange={e => handleStudentSelect(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 cursor-pointer"
            >
              <option value="">-- Choose enrolled student --</option>
              {students.map(s => (
                <option key={s.studentId} value={s.studentId}>
                  {s.fullName} ({s.class}) - Admission: {s.admissionNo} [Due: {money(s.feeAccount?.pendingAmount || 0)}]
                </option>
              ))}
            </select>
          </div>

          {/* Student Balance Peek Banner */}
          {chosenStudent && (
            <div className="p-3 bg-brand-50 rounded-xl border border-brand-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-brand-950 block">{chosenStudent.fullName}</span>
                <span className="text-[11px] text-brand-700">
                  {chosenStudent.class} • Parent: {chosenStudent.parentName} ({chosenStudent.parentPhone})
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Current Balance</span>
                <span className="text-base font-bold text-brand-900">
                  {money((chosenStudent.feeAccount?.pendingAmount || 0))}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Fee Category</label>
                            <input
                type="text"
                list="fee-category-options"
                value={feeCategory}
                onChange={e => setFeeCategory(e.target.value)}
                placeholder="Type or pick, e.g. Admission Fee"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
              <datalist id="fee-category-options">
                <option value="Admission Fee" />
                <option value="Tuition Fee" />
                <option value="Exam Fee" />
                <option value="Computer & Science Lab Fee" />
                <option value="Bus Transportation Fee" />
                <option value="Library Fee" />
                <option value="Sports Fee" />
                <option value="Hostel Fee" />
                <option value="Miscellaneous / Development Fee" />
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount Paid ($) *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Concession / Discount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer font-semibold text-brand-900"
              >
                <option value="Cash">Cash (Front Desk)</option>
                <option value="Bank Transfer">Bank Wire / ACH</option>
                <option value="Online/UPI">Online / UPI Gateway</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Cheque / Transaction Ref #</label>
              <input
                type="text"
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
                placeholder="e.g. TXN-8921 or CHQ-00129"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Remarks / Note</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Sibling discount applied, full term settlement..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCollectModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Record & Generate Official Receipt</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal: Void / Cancel Receipt */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Void Payment Receipt"
        subtitle={`Cancelling #${receiptToCancel?.receiptNumber}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Cancelling this receipt will void transaction #{receiptToCancel?.receiptNumber}, reverse {money(receiptToCancel?.paidAmount || 0)} in the student fee account, and post a ledger debit adjustment.
          </p>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason for Void *</label>
            <input
              type="text"
              required
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="e.g. Bounced cheque, erroneous student selection..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 cursor-pointer"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={handleCancelReceipt}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer"
            >
              Confirm Void & Reversal
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Official Printable Receipt Modal */}
      <PrintableReceiptModal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        receipt={selectedReceipt}
        school={activeSchool}
      />
    </div>
  );
};
