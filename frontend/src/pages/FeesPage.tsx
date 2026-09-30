import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { FeeStructure, FeeCategory } from '../types/index.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { CreditCard, Plus, Edit2, Trash2, Banknote, Clock, AlertTriangle, CheckCircle, Calendar, Layers, Search, Filter } from 'lucide-react';
import { useMoney } from '../utils/money.ts';

export const FeesPage: React.FC = () => {
  const money = useMoney();
  const { activeSchool, showNotification, setActiveTab } = useAuth();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [studentBalances, setStudentBalances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTabSub, setActiveTabSub] = useState<'structures' | 'balances'>('structures');

  // Search & filter for balances
  const [balanceSearch, setBalanceSearch] = useState('');
  const [balanceStatus, setBalanceStatus] = useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<FeeStructure | null>(null);
  
  // Edit pending fee (one student)
  const [adjustStudent, setAdjustStudent] = useState<any>(null);
  const [adjustPending, setAdjustPending] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Form
  const [feeForm, setFeeForm] = useState({
    title: '',
    category: 'Tuition' as FeeCategory,
    amount: '',
    class: 'All',
    frequency: 'Monthly' as any,
    dueDate: '2026-10-15',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [overviewRes, balancesRes] = await Promise.all([
        api.fees.getOverview(),
        api.fees.getStudentBalances({ search: balanceSearch, status: balanceStatus }),
      ]);
      if (overviewRes.success) {
        setStructures(overviewRes.structures);
        setAnalytics(overviewRes.analytics);
      }
      if (balancesRes.success) {
        setStudentBalances(balancesRes.records);
      }
    } catch (err: any) {
      showNotification('Failed to load fee information: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [balanceSearch, balanceStatus, activeSchool]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.fees.createStructure(feeForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsCreateModalOpen(false);
        setFeeForm({
          title: '',
          category: 'Tuition',
          amount: '',
          class: 'All',
          frequency: 'Monthly',
          dueDate: '2026-10-15',
        });
        fetchData();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFee) return;
    try {
      const res = await api.fees.updateStructure(selectedFee.id, feeForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsEditModalOpen(false);
        fetchData();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteStructure = async (fee: FeeStructure) => {
    if (!window.confirm(`Delete fee category "${fee.title}"?`)) return;
    try {
      const res = await api.fees.deleteStructure(fee.id);
      if (res.success) {
        showNotification(res.message, 'info');
        fetchData();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

    const handleOpenAdjust = (sb: any) => {
    setAdjustStudent(sb);
    setAdjustPending(String(sb.feeAccount?.pendingAmount ?? 0));
    setAdjustReason('');
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustStudent) return;
    try {
      const res = await api.fees.adjustPending(adjustStudent.studentId, {
        pendingAmount: Number(adjustPending),
        reason: adjustReason,
      });
      if (res.success) {
        showNotification(res.message, 'success');
        setAdjustStudent(null);
        fetchData();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleApplyStructure = async (fee: FeeStructure) => {
    const who = fee.class === 'All' ? 'ALL active students' : `all active students in "${fee.class}"`;
    if (!window.confirm(`Add "${fee.title}" (${money(fee.amount)}) to ${who}?\n\nStudents who already have this fee will be skipped.`)) return;
    try {
      const res = await api.fees.applyStructure(fee.id);
      if (res.success) {
        showNotification(res.message, res.added > 0 ? 'success' : 'info');
        fetchData();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleOpenEdit = (fee: FeeStructure) => {
    setSelectedFee(fee);
    setFeeForm({
      title: fee.title,
      category: fee.category,
      amount: String(fee.amount),
      class: fee.class,
      frequency: fee.frequency,
      dueDate: fee.dueDate,
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fee Management & Structures</h1>
            <Badge variant="purple">Accounting Rules</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure tuition, laboratory, and transport schedules, track collection rates, and monitor student dues.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Fee Structure</span>
        </button>
      </div>

      {/* Analytics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Expected Fees</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {money((analytics?.totalExpected || 0))}
          </span>
          <span className="text-[11px] text-brand-700 font-semibold mt-1 block">
            {analytics?.collectionRate || 0}% current collection efficiency
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Collected</span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">
            {money((analytics?.totalPaid || 0))}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Posted directly to general ledger</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pending Collections</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            {money((analytics?.totalPending || 0))}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Outstanding student balances</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Overdue Receivables</span>
          <span className="text-2xl font-bold text-rose-600 mt-1 block">
            {money((analytics?.totalOverdue || 0))}
          </span>
          <span className="text-[11px] text-rose-500 font-medium mt-1 block">Exceeded designated due date</span>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex border-b border-brand-100 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTabSub('structures')}
          className={`pb-3 px-1 border-b-2 transition-all cursor-pointer ${
            activeTabSub === 'structures'
              ? 'border-brand-700 text-brand-900'
              : 'border-transparent text-slate-500 hover:text-brand-700'
          }`}
        >
          Fee Structures & Categories ({structures.length})
        </button>
        <button
          onClick={() => setActiveTabSub('balances')}
          className={`pb-3 px-1 border-b-2 transition-all cursor-pointer ${
            activeTabSub === 'balances'
              ? 'border-brand-700 text-brand-900'
              : 'border-transparent text-slate-500 hover:text-brand-700'
          }`}
        >
          Student Fee Status & Balances ({studentBalances.length})
        </button>
      </div>

      {/* Tab 1: Fee Structures Grid */}
      {activeTabSub === 'structures' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {structures.map(fee => (
            <div
              key={fee.id}
              className="bg-white p-5 rounded-2xl border border-brand-100/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-100 text-brand-800">
                    {fee.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(fee)}
                      className="p-1 text-slate-400 hover:text-brand-700 rounded transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteStructure(fee)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-sm text-slate-900 leading-snug">{fee.title}</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Applicable: <span className="font-semibold text-slate-700">{fee.class}</span> • Frequency: <span className="font-semibold text-slate-700">{fee.frequency}</span>
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-end justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Due Date</span>
                  <span className="text-xs font-semibold text-slate-700">{fee.dueDate}</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-brand-900">
                                        {money(fee.amount)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleApplyStructure(fee)}
                className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                title="Add this fee to the pending bill of students in this class"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Apply to {fee.class === 'All' ? 'all students' : `${fee.class} students`}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Student Fee Balances Table */}
      {activeTabSub === 'balances' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={balanceSearch}
                onChange={e => setBalanceSearch(e.target.value)}
                placeholder="Search student by name, admission #..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Fee Status:</span>
              <select
                value={balanceStatus}
                onChange={e => setBalanceStatus(e.target.value)}
                className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4 text-right">Total Fee</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Pending Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentBalances.map(sb => {
                  const fa = sb.feeAccount;
                  return (
                    <tr key={sb.studentId} className="hover:bg-brand-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{sb.fullName}</span>
                        <span className="text-[11px] text-slate-500">{sb.admissionNo}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {sb.class}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {money((fa.totalFee || 0))}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {money((fa.paidAmount || 0))}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-600">
                        {money((fa.pendingAmount || 0))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            fa.status === 'paid' ? 'emerald' :
                            fa.status === 'partial' ? 'amber' :
                            fa.status === 'overdue' ? 'rose' : 'slate'
                          }
                        >
                          {fa.status}
                        </Badge>
                      </td>
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenAdjust(sb)}
                          className="px-2.5 py-1 mr-1.5 bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                          title="Change this student's pending fee"
                        >
                          Edit Pending
                        </button>
                        <button
                          onClick={() => setActiveTab('billing')}
                          className="px-3 py-1 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                        >
                          Collect Fee →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Fee Structure */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Fee Structure"
        subtitle="A fee that applies to one class or all classes"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Fee Item Title *</label>
            <input
              type="text"
              required
              value={feeForm.title}
              onChange={e => setFeeForm({ ...feeForm, title: e.target.value })}
              placeholder="e.g. Monthly tuition fee"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Category *</label>
              <select
                value={feeForm.category}
                onChange={e => setFeeForm({ ...feeForm, category: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer"
              >
                <option value="Admission">Admission</option>
                <option value="Exam">Exam</option>
                <option value="Lab">Lab</option>
                <option value="Library">Library</option>
                <option value="Transport">Transport</option>
                <option value="Sports">Sports</option>
                <option value="Hostel">Hostel</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={feeForm.amount}
                onChange={e => setFeeForm({ ...feeForm, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Cohort / Grade</label>
              <input
                type="text"
                value={feeForm.class}
                onChange={e => setFeeForm({ ...feeForm, class: e.target.value })}
                placeholder="All, or e.g. Grade 10"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Billing Frequency</label>
              <select
                value={feeForm.frequency}
                onChange={e => setFeeForm({ ...feeForm, frequency: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer"
              >
                <option value="Monthly">Monthly</option>
                <option value="Termly">Termly</option>
                <option value="Annually">Annually</option>
                <option value="One-Time">One-Time</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              value={feeForm.dueDate}
              onChange={e => setFeeForm({ ...feeForm, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg cursor-pointer"
            >
              Save Structure
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Fee Structure */}
           {/* Modal: Edit Fee Structure */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Fee Structure"
        subtitle={`Updating ${selectedFee?.title} (${selectedFee?.feeId})`}
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Fee Item Title *</label>
            <input
              type="text"
              required
              value={feeForm.title}
              onChange={e => setFeeForm({ ...feeForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Category *</label>
              <select
                value={feeForm.category}
                onChange={e => setFeeForm({ ...feeForm, category: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer focus:ring-2 focus:ring-brand-600"
              >
                <option value="Admission">Admission</option>
                <option value="Tuition">Tuition</option>
                <option value="Exam">Exam</option>
                <option value="Lab">Lab</option>
                <option value="Library">Library</option>
                <option value="Transport">Transport</option>
                <option value="Sports">Sports</option>
                <option value="Hostel">Hostel</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={feeForm.amount}
                onChange={e => setFeeForm({ ...feeForm, amount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Cohort / Grade</label>
              <input
                type="text"
                value={feeForm.class}
                onChange={e => setFeeForm({ ...feeForm, class: e.target.value })}
                placeholder="All, or e.g. Grade 10"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Billing Frequency</label>
              <select
                value={feeForm.frequency}
                onChange={e => setFeeForm({ ...feeForm, frequency: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer focus:ring-2 focus:ring-brand-600"
              >
                <option value="Monthly">Monthly</option>
                <option value="Termly">Termly</option>
                <option value="Annually">Annually</option>
                <option value="One-Time">One-Time</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              value={feeForm.dueDate}
              onChange={e => setFeeForm({ ...feeForm, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg cursor-pointer"
            >
              Update
            </button>
          </div>
        </form>
      </Modal>
            {/* Modal: Edit Pending Fee */}
      <Modal
        isOpen={!!adjustStudent}
        onClose={() => setAdjustStudent(null)}
        title="Edit Pending Fee"
        subtitle={`${adjustStudent?.fullName ?? ''} • ${adjustStudent?.class ?? ''}`}
        maxWidth="md"
      >
        {adjustStudent && (
          <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 bg-brand-50/60 border border-brand-100 rounded-xl">
              <div>
                <span className="text-slate-500 block">Total fee</span>
                <span className="font-bold text-slate-900">{money(adjustStudent.feeAccount?.totalFee || 0)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Paid</span>
                <span className="font-bold text-slate-900">{money(adjustStudent.feeAccount?.paidAmount || 0)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Discount given</span>
                <span className="font-bold text-slate-900">{money(adjustStudent.feeAccount?.discountAmount || 0)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Pending now</span>
                <span className="font-bold text-amber-600">{money(adjustStudent.feeAccount?.pendingAmount || 0)}</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">New Pending Amount *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={adjustPending}
                onChange={e => setAdjustPending(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-600"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Total fee will become{' '}
                <span className="font-bold text-brand-800">
                  {money((adjustStudent.feeAccount?.paidAmount || 0) + (adjustStudent.feeAccount?.discountAmount || 0) + (Number(adjustPending) || 0))}
                </span>
                . Payments already received are not changed.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Reason *</label>
              <input
                type="text"
                required
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                placeholder="e.g. 50% scholarship, joined in mid-year, correction"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustStudent(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg cursor-pointer"
              >
                Save Pending Fee
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
