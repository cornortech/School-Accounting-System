import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Expense, ExpenseCategory, PaymentMethod } from '../types/index.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { TrendingDown, Plus, Search, Filter, Banknote, Calendar, CreditCard, Edit2, Trash2, PieChart, Tag, Building } from 'lucide-react';
import { useMoney } from '../utils/money.ts';

export const ExpensesPage: React.FC = () => {
  const money = useMoney();
  const { activeSchool, showNotification } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Form
  const [expenseForm, setExpenseForm] = useState({
    category: 'Utilities' as ExpenseCategory,
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Bank Transfer' as PaymentMethod,
    description: '',
    vendorOrPerson: '',
    receiptRef: '',
  });

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const res = await api.expenses.getAll({
        search,
        category: categoryFilter,
        startDate,
        endDate,
      });
      if (res.success) {
        setExpenses(res.expenses);
        setMeta(res.meta);
      }
    } catch (err: any) {
      showNotification('Failed to fetch expenses: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [search, categoryFilter, startDate, endDate, activeSchool]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.expenses.create(expenseForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsAddModalOpen(false);
        setExpenseForm({
          category: 'Utilities',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'Bank Transfer',
          description: '',
          vendorOrPerson: '',
          receiptRef: '',
        });
        fetchExpenses();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense) return;
    try {
      const res = await api.expenses.update(selectedExpense.expenseId, expenseForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsEditModalOpen(false);
        fetchExpenses();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!window.confirm(`Delete expense "${expense.description}"? Ledger entry will be reversed.`)) return;
    try {
      const res = await api.expenses.delete(expense.expenseId);
      if (res.success) {
        showNotification(res.message, 'info');
        fetchExpenses();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleOpenEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setExpenseForm({
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date,
      paymentMethod: expense.paymentMethod,
      description: expense.description,
      vendorOrPerson: expense.vendorOrPerson,
      receiptRef: expense.receiptRef || '',
    });
    setIsEditModalOpen(true);
  };

  const categories: ExpenseCategory[] = [
    'Utilities', 'Maintenance', 'Lab Supplies', 'Office Supplies',
    'Sports Equipment', 'Events', 'Transport & Fuel', 'Software & IT', 'Miscellaneous'
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operating Expense Tracker</h1>
            <Badge variant="purple">Ledger Integrated</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Record maintenance, lab consumables, utilities, vendor invoices, and fleet fuel expenses.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Expense</span>
        </button>
      </div>

      {/* Expense Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Operating Outflow</span>
          <span className="text-2xl font-bold text-rose-600 mt-1 block">
            {money((meta?.totalAmount || 0))}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {meta?.totalCount || 0} Invoices & vouchers paid
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Top Category</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">
            {meta?.categorySummary ? Object.entries(meta.categorySummary).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'Utilities' : 'Utilities'}
          </span>
          <span className="text-[11px] text-brand-700 font-semibold mt-0.5 block">Campus facilities priority</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Automatic Ledger Post</span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">Active</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Debit recorded on submit</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Audit Trail</span>
          <span className="text-2xl font-bold text-brand-900 mt-1 block">100% Traceable</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Vendor reference logging</span>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by description, vendor, invoice #..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg font-semibold cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-semibold">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="py-1 px-2 bg-white border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-semibold">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="py-1 px-2 bg-white border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Expense ID</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Vendor / Person</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading expense ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                expenses.map(exp => (
                  <tr key={exp.expenseId} className="hover:bg-brand-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-900">
                      {exp.expenseId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-50 text-brand-800 border border-brand-200">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {exp.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{exp.vendorOrPerson}</div>
                      {exp.receiptRef && (
                        <div className="text-[10px] text-slate-400 font-mono">Ref: {exp.receiptRef}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {exp.date}
                    </td>
                    <td className="py-3 px-4 font-semibold uppercase text-slate-700">
                      {exp.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600 text-sm">
                      {money(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(exp)}
                          className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete & Reverse in Ledger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Expense */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Record Operating Expense"
        subtitle="Saved as money out in the cash book"
        maxWidth="lg"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Expense Description *</label>
            <input
              type="text"
              required
              value={expenseForm.description}
              onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
              placeholder="e.g. Electricity bill for Bhadra"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Expense Category *</label>
              <select
                value={expenseForm.category}
                onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount ($) *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={expenseForm.amount}
                onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Vendor / Payee Name *</label>
              <input
                type="text"
                required
                value={expenseForm.vendorOrPerson}
                onChange={e => setExpenseForm({ ...expenseForm, vendorOrPerson: e.target.value })}
                placeholder="e.g. Nepal Electricity Authority"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={expenseForm.paymentMethod}
                onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer font-semibold text-brand-900"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Online/UPI">Online / UPI</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={expenseForm.date}
                onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Receipt / Invoice Ref #</label>
              <input
                type="text"
                value={expenseForm.receiptRef}
                onChange={e => setExpenseForm({ ...expenseForm, receiptRef: e.target.value })}
                placeholder="Bill no."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg cursor-pointer"
            >
              Post Expense
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Expense */}
           {/* Modal: Edit Expense */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Expense"
        subtitle={`Updating ${selectedExpense?.expenseId} (the cash book is updated too)`}
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Expense Description *</label>
            <input
              type="text"
              required
              value={expenseForm.description}
              onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Expense Category *</label>
              <select
                value={expenseForm.category}
                onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer focus:ring-2 focus:ring-brand-600"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={expenseForm.amount}
                onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Vendor / Payee Name *</label>
              <input
                type="text"
                required
                value={expenseForm.vendorOrPerson}
                onChange={e => setExpenseForm({ ...expenseForm, vendorOrPerson: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={expenseForm.paymentMethod}
                onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer font-semibold text-brand-900 focus:ring-2 focus:ring-brand-600"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Online/UPI">Online / UPI</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={expenseForm.date}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Receipt / Invoice Ref #</label>
              <input
                type="text"
                value={expenseForm.receiptRef}
                onChange={e => setExpenseForm({ ...expenseForm, receiptRef: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-brand-600"
              />
            </div>
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
              Update Expense
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
