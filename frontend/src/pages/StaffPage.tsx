import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Staff, StaffRoleType } from '../types/index.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { Users, Plus, Search, BookOpen, Briefcase, Mail, Phone, Calendar, Banknote, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { useMoney } from '../utils/money.ts';

export const StaffPage: React.FC = () => {
  const money = useMoney();
  const { activeSchool, showNotification } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [roleTypeFilter, setRoleTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  // Form
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    roleType: 'teaching' as StaffRoleType,
    designation: '',
    department: '',
    teachingSubject: 'Science Teacher',
    nonTeachingRole: 'Accountant',
        joiningDate: new Date().toISOString().split('T')[0],
    salaryStartDate: new Date().toISOString().split('T')[0],
    baseSalary: '',
    allowances: '0',
    deductions: '0',
    status: 'active',
  });

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const res = await api.staff.getAll({
        search,
        roleType: roleTypeFilter,
        status: statusFilter,
      });
      if (res.success) {
        setStaffList(res.staff);
        setMeta(res.meta);
      }
    } catch (err: any) {
      showNotification('Failed to fetch staff directory: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [search, roleTypeFilter, statusFilter, activeSchool]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.staff.create(staffForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsAddModalOpen(false);
        setStaffForm({
          fullName: '',
          email: '',
          phone: '',
          address: '',
          roleType: 'teaching',
          designation: '',
          department: '',
          teachingSubject: 'Science Teacher',
          nonTeachingRole: 'Accountant',
          joiningDate: new Date().toISOString().split('T')[0],
          salaryStartDate: new Date().toISOString().split('T')[0],
          baseSalary: '',
          allowances: '0',
          deductions: '0',
          status: 'active',
        });
        fetchStaff();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    try {
      const res = await api.staff.update(selectedStaff.staffId, staffForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsEditModalOpen(false);
        fetchStaff();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteStaff = async (staff: Staff) => {
    if (!window.confirm(`Delete staff record for "${staff.fullName}"?`)) return;
    try {
      const res = await api.staff.delete(staff.staffId);
      if (res.success) {
        showNotification(res.message, 'info');
        fetchStaff();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleOpenEdit = (staff: Staff) => {
    setSelectedStaff(staff);
    setStaffForm({
      fullName: staff.fullName,
      email: staff.email,
      phone: staff.phone,
      address: staff.address,
      roleType: staff.roleType,
      designation: staff.designation,
      department: staff.department,
      teachingSubject: staff.teachingSubject || 'Science Teacher',
      nonTeachingRole: staff.nonTeachingRole || 'Accountant',
      joiningDate: staff.joiningDate,
      salaryStartDate: staff.salaryStartDate || staff.joiningDate,
      baseSalary: String(staff.baseSalary),
      allowances: String(staff.allowances),
      deductions: String(staff.deductions),
      status: staff.status,
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Directory & Faculty</h1>
            <Badge variant="purple">Human Resources</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Maintain teaching faculty, support staff records, subject specializations, and salary structures.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Staff</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{meta?.total ?? staffList.length}</span>
            <span className="text-[11px] text-brand-700 font-semibold mt-0.5 block">Active personnel</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Teaching Faculty</span>
            <span className="text-2xl font-bold text-brand-900 mt-1 block">{meta?.teachingCount ?? 0}</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Subject specialists</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Non-Teaching Staff</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{meta?.nonTeachingCount ?? 0}</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Admin & operations</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Monthly Payroll Commitment</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">
              {money((meta?.monthlyPayrollCommitment ?? 0))}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Base + allowances</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Banknote className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, ID, role, or subject (e.g. Science, Mathematics)..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleTypeFilter}
              onChange={e => setRoleTypeFilter(e.target.value)}
              className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="teaching">Teaching Faculty</option>
              <option value="non_teaching">Non-Teaching Staff</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Staff ID</th>
                <th className="py-3 px-4">Designation & Subject</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-right">Net Monthly Salary</th>
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
                      <span>Loading staff records...</span>
                    </div>
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No staff records found.
                  </td>
                </tr>
              ) : (
                staffList.map(staff => (
                  <tr key={staff.staffId} className="hover:bg-brand-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-100 border border-brand-200 text-brand-800 font-bold flex items-center justify-center text-xs">
                          {staff.fullName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{staff.fullName}</span>
                          <span className="text-[11px] text-slate-500">{staff.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-brand-900">
                      {staff.staffId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 block">{staff.designation}</span>
                      <span className="text-[11px] text-brand-700 font-semibold">
                        {staff.roleType === 'teaching' ? staff.teachingSubject : staff.nonTeachingRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {staff.department}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {staff.phone}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {money(staff.netSalary)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={staff.status === 'active' ? 'emerald' : 'amber'}>
                        {staff.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(staff)}
                          className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(staff)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
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

      {/* Modal: Add Staff Member */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Staff Member"
        subtitle="Teachers and non-teaching staff"
        maxWidth="2xl"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={staffForm.fullName}
                onChange={e => setStaffForm({ ...staffForm, fullName: e.target.value })}
                placeholder="e.g. Sunita Shrestha"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Role Type *</label>
              <select
                value={staffForm.roleType}
                onChange={e => setStaffForm({ ...staffForm, roleType: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer"
              >
                <option value="teaching">Teaching Faculty</option>
                <option value="non_teaching">Non-Teaching Staff</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Designation *</label>
              <input
                type="text"
                required
                value={staffForm.designation}
                onChange={e => setStaffForm({ ...staffForm, designation: e.target.value })}
                placeholder="e.g. Science Teacher"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={staffForm.department}
                onChange={e => setStaffForm({ ...staffForm, department: e.target.value })}
                placeholder="e.g. Science"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

                        {/* Teaching Subject (if teaching) - type OR pick */}
            {staffForm.roleType === 'teaching' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Teaching Subject</label>
                <input
                  type="text"
                  list="teaching-subject-options"
                  value={staffForm.teachingSubject}
                  onChange={e => setStaffForm({ ...staffForm, teachingSubject: e.target.value })}
                  placeholder="Type or pick, e.g. Science Teacher"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold text-brand-900 focus:ring-2 focus:ring-brand-600"
                />
              </div>
            )}

            {/* Non-Teaching Role (if non-teaching) - type OR pick */}
            {staffForm.roleType === 'non_teaching' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Position / Function</label>
                <input
                  type="text"
                  list="position-options"
                  value={staffForm.nonTeachingRole}
                  onChange={e => setStaffForm({ ...staffForm, nonTeachingRole: e.target.value })}
                  placeholder="Type or pick, e.g. Accountant"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold text-brand-900 focus:ring-2 focus:ring-brand-600"
                />
              </div>
            )}

            <datalist id="teaching-subject-options">
              <option value="Science Teacher" />
              <option value="Mathematics Teacher" />
              <option value="Computer Teacher" />
              <option value="English Teacher" />
              <option value="Nepali Teacher" />
              <option value="Social Studies Teacher" />
              <option value="Art & Music Teacher" />
            </datalist>
            <datalist id="position-options">
              <option value="Accountant" />
              <option value="Receptionist" />
              <option value="Cleaner / Janitor" />
              <option value="Security Guard" />
              <option value="Bus Driver" />
              <option value="Peon / Office Helper" />
              <option value="Librarian" />
              <option value="Other Staff" />
            </datalist>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={staffForm.email}
                onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                placeholder="name@example.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={staffForm.phone}
                onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                placeholder="98XXXXXXXX"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Joining Date</label>
              <input
                type="date"
                value={staffForm.joiningDate}
                onChange={e => setStaffForm({ ...staffForm, joiningDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
                        <div>
              <label className="block font-bold text-slate-700 mb-1">Salary Starts From</label>
              <input
                type="date"
                value={staffForm.salaryStartDate}
                onChange={e => setStaffForm({ ...staffForm, salaryStartDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
              <p className="mt-1 text-[11px] text-slate-500">First salary is due one month after this date.</p>
            </div>
          </div>

          {/* Salary Configuration */}
          <div className="pt-3 border-t border-slate-200">
            <h4 className="font-semibold text-sm text-brand-900 mb-2">Payroll & Compensation</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Base Monthly Salary ($) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={staffForm.baseSalary}
                  onChange={e => setStaffForm({ ...staffForm, baseSalary: e.target.value })}
                  placeholder="35000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Allowances ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={staffForm.allowances}
                  onChange={e => setStaffForm({ ...staffForm, allowances: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deductions (Tax/PF) ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={staffForm.deductions}
                  onChange={e => setStaffForm({ ...staffForm, deductions: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg shadow-md cursor-pointer"
            >
              Save Staff Member
            </button>
          </div>
        </form>
      </Modal>

            {/* Modal: Edit Staff Member */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Staff Member"
        subtitle={`Updating ${selectedStaff?.fullName} (${selectedStaff?.staffId})`}
        maxWidth="2xl"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={staffForm.fullName}
                onChange={e => setStaffForm({ ...staffForm, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Role Type *</label>
              <select
                value={staffForm.roleType}
                onChange={e => setStaffForm({ ...staffForm, roleType: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer focus:ring-2 focus:ring-brand-600"
              >
                <option value="teaching">Teaching Faculty</option>
                <option value="non_teaching">Non-Teaching Staff</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Designation *</label>
              <input
                type="text"
                required
                value={staffForm.designation}
                onChange={e => setStaffForm({ ...staffForm, designation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={staffForm.department}
                onChange={e => setStaffForm({ ...staffForm, department: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>

            {staffForm.roleType === 'teaching' ? (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Teaching Subject</label>
                <input
                  type="text"
                  list="teaching-subject-options"
                  value={staffForm.teachingSubject}
                  onChange={e => setStaffForm({ ...staffForm, teachingSubject: e.target.value })}
                  placeholder="Type or pick"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold text-brand-900 focus:ring-2 focus:ring-brand-600"
                />
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Position / Function</label>
                <input
                  type="text"
                  list="position-options"
                  value={staffForm.nonTeachingRole}
                  onChange={e => setStaffForm({ ...staffForm, nonTeachingRole: e.target.value })}
                  placeholder="Type or pick"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold text-brand-900 focus:ring-2 focus:ring-brand-600"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status</label>
              <select
                value={staffForm.status}
                onChange={e => setStaffForm({ ...staffForm, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer focus:ring-2 focus:ring-brand-600"
              >
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={staffForm.email}
                onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={staffForm.phone}
                onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Joining Date</label>
              <input
                type="date"
                value={staffForm.joiningDate}
                onChange={e => setStaffForm({ ...staffForm, joiningDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>

                        <div>
              <label className="block font-bold text-slate-700 mb-1">Salary Starts From</label>
              <input
                type="date"
                value={staffForm.salaryStartDate}
                onChange={e => setStaffForm({ ...staffForm, salaryStartDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
              <p className="mt-1 text-[11px] text-slate-500">First salary is due one month after this date.</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={staffForm.address}
                onChange={e => setStaffForm({ ...staffForm, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <h4 className="font-semibold text-sm text-brand-900 mb-2">Payroll & Compensation</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Base Monthly Salary *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={staffForm.baseSalary}
                  onChange={e => setStaffForm({ ...staffForm, baseSalary: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold focus:ring-2 focus:ring-brand-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Allowances</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={staffForm.allowances}
                  onChange={e => setStaffForm({ ...staffForm, allowances: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Deductions (Tax/PF)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={staffForm.deductions}
                  onChange={e => setStaffForm({ ...staffForm, deductions: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Net salary:{' '}
              <span className="font-bold text-brand-800">
                {money(Math.max(0, (Number(staffForm.baseSalary) || 0) + (Number(staffForm.allowances) || 0) - (Number(staffForm.deductions) || 0)))}
              </span>
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg shadow-md cursor-pointer"
            >
              Update Profile
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
