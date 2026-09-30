import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { LedgerTransaction } from '../types/index.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { BookOpen, Plus, Search, Filter, ArrowDownLeft, ArrowUpRight, Banknote, Calendar, Layers, Printer, ShieldCheck } from 'lucide-react';
import { useMoney } from '../utils/money.ts';

export const LedgerPage: React.FC = () => {
  const money = useMoney();
  const { activeSchool, showNotification } = useAuth();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState('all');
  const [refTypeFilter, setRefTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [journalForm, setJournalForm] = useState({
    type: 'credit',
    category: 'Bank Interest & Misc Income',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const res = await api.ledger.getAll({
        type: typeFilter,
        referenceType: refTypeFilter,
        search,
        startDate,
        endDate,
      });
      if (res.success) {
        setTransactions(res.transactions);
        setSummary(res.summary);
      }
    } catch (err: any) {
      showNotification('Failed to load ledger: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [typeFilter, refTypeFilter, search, startDate, endDate, activeSchool]);

  const handleJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.ledger.addJournalEntry(journalForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsJournalModalOpen(false);
        setJournalForm({
          type: 'credit',
          category: 'Bank Interest & Misc Income',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
        });
        fetchLedger();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cash Book</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time automated transaction journal unifying student tuition collections, staff salary disbursements, and campus operating expenses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer no-print"
          >
            <Printer className="w-4 h-4" />
            <span>Print Ledger</span>
          </button>
          <button
            onClick={() => setIsJournalModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer no-print"
          >
            <Plus className="w-4 h-4" />
            <span>New Journal Entry</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Inflow (Credits)</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">
              +{money((summary?.totalCredits || 0))}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Fee income & credits</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Outflow (Debits)</span>
            <span className="text-2xl font-bold text-rose-600 mt-1 block">
              -{money((summary?.totalDebits || 0))}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Salaries & operational expenses</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Current Ledger Balance</span>
            <span className={`text-2xl font-bold mt-1 block ${
              (summary?.currentBalance || 0) >= 0 ? 'text-brand-900' : 'text-rose-600'
            }`}>
              {money((summary?.currentBalance || 0))}
            </span>
            <span className="text-[11px] text-brand-700 font-semibold mt-0.5 block">Reconciled closing balance</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
            <Banknote className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Transaction Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" id="printable-document">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-50/50 no-print">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by description, transaction ID, reference #..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg font-semibold cursor-pointer"
            >
              <option value="all">All Flow Types</option>
              <option value="credit">Credit (Inflow)</option>
              <option value="debit">Debit (Outflow)</option>
            </select>

            <select
              value={refTypeFilter}
              onChange={e => setRefTypeFilter(e.target.value)}
              className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg font-semibold cursor-pointer"
            >
              <option value="all">All Reference Modules</option>
              <option value="fee_payment">Student Fee Collections</option>
              <option value="salary_payout">Staff Salary Disbursements</option>
              <option value="expense">Operating Expenses</option>
              <option value="manual">Journal Entries</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Ref Module / ID</th>
                <th className="py-3 px-4 text-right">Debit (-)</th>
                <th className="py-3 px-4 text-right">Credit (+)</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                      <span>Reconciling general ledger balances...</span>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No ledger transactions found matching filters.
                  </td>
                </tr>
              ) : (
                transactions.map(txn => {
                  const isCredit = txn.type === 'credit';
                  return (
                    <tr key={txn.id} className="hover:bg-brand-50/20 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {txn.date}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {txn.transactionId}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{txn.category}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {txn.description}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {txn.referenceId}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        {!isCredit ? money(txn.amount) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {isCredit ? `+${money(txn.amount)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-brand-950 text-sm">
                        {money(txn.runningBalance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Journal Entry */}
      <Modal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        title="Post Manual Journal Entry"
        subtitle="Opening balance, bank charges, donations or other adjustments"
        maxWidth="md"
      >
        <form onSubmit={handleJournalSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Flow Type *</label>
              <select
                value={journalForm.type}
                onChange={e => setJournalForm({ ...journalForm, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer font-bold text-brand-900"
              >
                <option value="credit">Credit (Income / Cash Inflow)</option>
                <option value="debit">Debit (Expense / Cash Outflow)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount ($) *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={journalForm.amount}
                onChange={e => setJournalForm({ ...journalForm, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Category / Account Head *</label>
            <input
              type="text"
              required
              value={journalForm.category}
              onChange={e => setJournalForm({ ...journalForm, category: e.target.value })}
              placeholder="e.g. Bank Interest Income or Audit Adjustment"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Particulars / Description *</label>
            <input
              type="text"
              required
              value={journalForm.description}
              onChange={e => setJournalForm({ ...journalForm, description: e.target.value })}
              placeholder="Detailed memorandum of the transaction..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={journalForm.date}
              onChange={e => setJournalForm({ ...journalForm, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsJournalModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg cursor-pointer"
            >
              Post to Ledger
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
