import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { School, User } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { Building2, Plus, Search, CheckCircle, XCircle, Edit2, Trash2, KeyRound, ExternalLink, Users, GraduationCap, Banknote, Shield, Activity, Phone, Mail, MapPin } from 'lucide-react';
import { useMoney } from '../utils/money.ts';

export const SuperAdminDashboard: React.FC = () => {
  const money = useMoney();
  const { showNotification, switchSchoolContext, setActiveTab } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // Selected school state
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedSchoolDetails, setSelectedSchoolDetails] = useState<any>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    currency: 'NPR',
    currencySymbol: 'Rs.',
    principalName: '',
    panNo: '',
    establishedYear: new Date().getFullYear(),
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    currency: 'NPR',
    currencySymbol: 'Rs.',
    principalName: '',
    establishedYear: new Date().getFullYear(),
  });

  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'accountant',
  });

  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [selectedUserToReset, setSelectedUserToReset] = useState<string | null>(null);

  const fetchSchools = async () => {
    setIsLoading(true);
    try {
      const res = await api.schools.getAll({ search, status: statusFilter });
      if (res.success) {
        setSchools(res.schools);
        setMeta(res.meta);
      }
    } catch (err: any) {
      showNotification('Failed to load schools: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, [search, statusFilter]);

  const handleToggleStatus = async (school: School) => {
    const newStatus = school.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await api.schools.toggleStatus(school.schoolId, newStatus);
      if (res.success) {
        showNotification(res.message, newStatus === 'active' ? 'success' : 'info');
        fetchSchools();
      }
    } catch (err: any) {
      showNotification('Error updating status: ' + err.message, 'error');
    }
  };

  const handleDeleteSchool = async (school: School) => {
    if (!window.confirm(`Are you sure you want to delete "${school.name}"? School staff will be permanently denied login.`)) {
      return;
    }
    try {
      const res = await api.schools.delete(school.schoolId);
      if (res.success) {
        showNotification(res.message, 'info');
        fetchSchools();
      }
    } catch (err: any) {
      showNotification('Delete failed: ' + err.message, 'error');
    }
  };

  const handleOpenDetail = async (school: School) => {
    setSelectedSchool(school);
    try {
      const res = await api.schools.getById(school.schoolId);
      if (res.success) {
        setSelectedSchoolDetails(res);
        setIsDetailModalOpen(true);
      }
    } catch (err: any) {
      showNotification('Failed to fetch details: ' + err.message, 'error');
    }
  };

  const handleOpenEdit = (school: School) => {
    setSelectedSchool(school);
    setEditForm({
      name: school.name,
      code: school.code,
      email: school.email,
      phone: school.phone,
      address: school.address,
      currency: school.currency,
      currencySymbol: school.currencySymbol,
      principalName: school.principalName,
      establishedYear: school.establishedYear,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenUsers = async (school: School) => {
    setSelectedSchool(school);
    try {
      const res = await api.schools.getById(school.schoolId);
      if (res.success) {
        setSelectedSchoolDetails(res);
        setIsUserModalOpen(true);
      }
    } catch (err: any) {
      showNotification('Error loading users: ' + err.message, 'error');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.schools.create(createForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsCreateModalOpen(false);
        setCreateForm({
          name: '',
          code: '',
          email: '',
          phone: '',
          address: '',
          currency: 'NPR',
          currencySymbol: 'Rs.',
          principalName: '',
          panNo: '',
          establishedYear: new Date().getFullYear(),
          adminName: '',
          adminEmail: '',
          adminPassword: '',
        });
        fetchSchools();
      }
    } catch (err: any) {
      showNotification(err.message || 'Creation failed', 'error');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) return;
    try {
      const res = await api.schools.update(selectedSchool.schoolId, editForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsEditModalOpen(false);
        fetchSchools();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) return;
    try {
      const res = await api.schools.addUser(selectedSchool.schoolId, newUserForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setNewUserForm({ name: '', email: '', password: '', role: 'accountant' });
        // Refresh school details
        handleOpenUsers(selectedSchool);
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!selectedSchool || !resetPasswordInput) return;
    try {
      const res = await api.schools.resetUserPassword(selectedSchool.schoolId, userId, resetPasswordInput);
      if (res.success) {
        showNotification(res.message, 'success');
        setResetPasswordInput('');
        setSelectedUserToReset(null);
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleToggleUserStatus = async (usr: any) => {
    if (!selectedSchool) return;
    const newStatus = usr.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await api.schools.toggleUserStatus(selectedSchool.schoolId, usr.id, newStatus);
      if (res.success) {
        showNotification(res.message, newStatus === 'active' ? 'success' : 'info');
        handleOpenUsers(selectedSchool);
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteUser = async (usr: any) => {
    if (!selectedSchool) return;
    if (!window.confirm(`Delete the login for "${usr.name}" (${usr.email})? This person will not be able to log in any more.`)) return;
    try {
      const res = await api.schools.deleteUser(selectedSchool.schoolId, usr.id);
      if (res.success) {
        showNotification(res.message, 'info');
        if (selectedUserToReset === usr.id) setSelectedUserToReset(null);
        handleOpenUsers(selectedSchool);
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleInspectSchool = (school: School) => {
    switchSchoolContext(school.schoolId);
    setActiveTab('dashboard');
    showNotification(`Switched workspace to ${school.name}`, 'info');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Super Admin Dashboard</h1>
            <Badge variant="purple">System Owner</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global management of registered school tenants, subscription statuses, credential control, and revenue analytics.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register New School</span>
        </button>
      </div>

      {/* Platform Metric Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Schools</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {meta?.totalSchools ?? schools.length}
            </span>
            <div className="flex items-center gap-2 mt-1.5 text-[11px]">
              <span className="text-brand-600 font-bold">{meta?.activeSchools ?? 0} Active</span>
              <span className="text-slate-300">•</span>
              <span className="text-rose-600 font-bold">{meta?.inactiveSchools ?? 0} Inactive</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Students Enrolled</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {meta?.totalStudentsPlatform ?? 0}
            </span>
            <span className="text-[11px] text-brand-700 font-semibold mt-1 block">Across all active schools</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">System Collections</span>
            <span className="text-2xl font-bold text-brand-600 mt-1 block">
              {money((meta?.totalRevenuePlatform ?? 0))}
            </span>
            <span className="text-[11px] text-brand-700 font-semibold mt-1 block">Platform fee throughput</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
            <Banknote className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-brand-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Status</span>
            <span className="text-2xl font-bold text-brand-900 mt-1 block">100% Isolated</span>
            <span className="text-[11px] text-brand-700 font-semibold mt-1 block">Enforced backend rules</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
            <Shield className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Schools Directory & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by school name, ID (e.g. SCH-1001), code, or principal..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-600 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive / Deactivated Only</option>
            </select>
          </div>
        </div>

        {/* Table of Schools */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">School Profile</th>
                <th className="py-3.5 px-4">School ID</th>
                <th className="py-3.5 px-4">Principal & Contact</th>
                <th className="py-3.5 px-4 text-center">Students</th>
                <th className="py-3.5 px-4 text-center">Staff</th>
                <th className="py-3.5 px-4 text-right">Collections</th>
                <th className="py-3.5 px-4 text-center">Login Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading school registry...</span>
                    </div>
                  </td>
                </tr>
              ) : schools.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No schools match your search query.
                  </td>
                </tr>
              ) : (
                schools.map(school => {
                  const isActive = school.status === 'active';
                  return (
                    <tr key={school.schoolId} className="hover:bg-brand-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-100 border border-brand-200 text-brand-800 font-bold flex items-center justify-center text-sm shadow-xs">
                            {school.code}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{school.name}</span>
                            <span className="text-[11px] text-slate-500">{school.address}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-brand-900 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                          {school.schoolId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-semibold">{school.principalName}</div>
                        <div className="text-[11px] text-slate-500">{school.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {school.studentCount ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {school.staffCount ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-brand-700">
                        {money((school.totalCollected ?? 0))}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(school)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                          title={isActive ? 'Click to deactivate school login access' : 'Click to activate school login access'}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-brand-500" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-500" />
                              <span>Deactivated</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleInspectSchool(school)}
                            className="p-1.5 rounded-lg text-brand-700 hover:bg-brand-100 transition-colors"
                            title="Inspect School Workspace (Switch view)"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDetail(school)}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                            title="View School Account Details"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenUsers(school)}
                            className="p-1.5 rounded-lg text-brand-700 hover:bg-brand-50 transition-colors"
                            title="Manage School Login Credentials"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(school)}
                            className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50 transition-colors"
                            title="Edit School Account"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSchool(school)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete School Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Modal: Register New School Account */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New School Tenant"
        subtitle="Creates the school and its first admin login"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">School Full Name *</label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Shree Janata Secondary School"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">School Code (Unique) *</label>
              <input
                type="text"
                required
                value={createForm.code}
                onChange={e => setCreateForm({ ...createForm, code: e.target.value })}
                placeholder="e.g. SJSS"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Official Email *</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="info@school.edu.np"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={createForm.phone}
                onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="01-XXXXXXX"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Principal</label>
              <input
                type="text"
                value={createForm.principalName}
                onChange={e => setCreateForm({ ...createForm, principalName: e.target.value })}
                placeholder="Principal's name"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">PAN No.</label>
              <input
                type="text"
                value={createForm.panNo}
                onChange={e => setCreateForm({ ...createForm, panNo: e.target.value })}
                placeholder="Shown on receipts"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={createForm.address}
                onChange={e => setCreateForm({ ...createForm, address: e.target.value })}
                placeholder="e.g. Biratnagar-5, Morang"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h4 className="font-semibold text-sm text-brand-900 mb-2 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-brand-600" /> Initial School Admin Credentials
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Admin Full Name</label>
                <input
                  type="text"
                  value={createForm.adminName}
                  onChange={e => setCreateForm({ ...createForm, adminName: e.target.value })}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Admin Login Email *</label>
                <input
                  type="email"
                  required
                  value={createForm.adminEmail}
                  onChange={e => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                  placeholder="admin@school.edu.np"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Admin Password *</label>
                <input
                  type="password"
                  required
                  value={createForm.adminPassword}
                  onChange={e => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg shadow-md transition-all cursor-pointer"
            >
              Provision School Account
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal: Edit School Account */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit School Account"
        subtitle={`Modifying profile for ${selectedSchool?.name}`}
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">School Name</label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Code</label>
              <input
                type="text"
                required
                value={editForm.code}
                onChange={e => setEditForm({ ...editForm, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={editForm.email}
              onChange={e => setEditForm({ ...editForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={editForm.address}
              onChange={e => setEditForm({ ...editForm, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3">
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
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Modal: School Details & Financial Health */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="School Account Profile"
        subtitle={`${selectedSchoolDetails?.school?.name} (${selectedSchoolDetails?.school?.schoolId})`}
        maxWidth="2xl"
      >
        {selectedSchoolDetails && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-brand-50/50 p-4 rounded-xl border border-brand-100">
              <div>
                <span className="text-slate-400 block font-medium">Status</span>
                <Badge variant={selectedSchoolDetails.school.status === 'active' ? 'brand' : 'rose'}>
                  {selectedSchoolDetails.school.status}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Students</span>
                <span className="text-sm font-semibold text-slate-900">{selectedSchoolDetails.stats.totalStudents}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Staff Members</span>
                <span className="text-sm font-semibold text-slate-900">{selectedSchoolDetails.stats.totalStaff}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Total Fees Collected</span>
                <span className="text-sm font-semibold text-brand-600">
                  {money(selectedSchoolDetails.stats.totalCollected)}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-slate-800 text-sm">School Contact Information</h4>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-brand-600" /> {selectedSchoolDetails.school.email}</p>
                <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-brand-600" /> {selectedSchoolDetails.school.phone}</p>
                <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-brand-600" /> {selectedSchoolDetails.school.address}</p>
                <p className="font-semibold text-slate-800">Principal: {selectedSchoolDetails.school.principalName}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => handleInspectSchool(selectedSchoolDetails.school)}
                className="px-4 py-2 bg-brand-700 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-brand-800 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" /> Open Full School Workspace
              </button>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 4. Modal: Manage School Users & Credentials */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setSelectedUserToReset(null);
        }}
        title="Manage School User Credentials"
        subtitle={`Authorized staff accounts for ${selectedSchool?.name}`}
        maxWidth="2xl"
      >
        <div className="space-y-6 text-xs">
                   {/* User List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-800">Registered School Accounts</h4>
              <span className="text-[11px] text-slate-500">
                {selectedSchoolDetails?.users?.filter((u: any) => u.status === 'active').length ?? 0} active of {selectedSchoolDetails?.users?.length ?? 0}
              </span>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {selectedSchoolDetails?.users?.length === 0 && (
                <div className="p-6 text-center text-slate-400">No logins yet. Add one below.</div>
              )}
              {selectedSchoolDetails?.users?.map((usr: any) => {
                const isActiveUser = usr.status === 'active';
                return (
                  <div
                    key={usr.id}
                    className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      isActiveUser ? 'hover:bg-brand-50/40' : 'bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          isActiveUser ? 'bg-brand-100 text-brand-800' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {usr.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className={`font-bold block truncate ${isActiveUser ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                          {usr.name}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px] truncate block">{usr.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                      <Badge variant={usr.role === 'school_admin' ? 'purple' : usr.role === 'accountant' ? 'blue' : 'amber'}>
                        {usr.role.replace('_', ' ')}
                      </Badge>

                      <button
                        onClick={() => handleToggleUserStatus(usr)}
                        title={isActiveUser ? 'Click to deactivate this login' : 'Click to activate this login'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                          isActiveUser
                            ? 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        {isActiveUser ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {isActiveUser ? 'Active' : 'Inactive'}
                      </button>

                      <button
                        onClick={() => setSelectedUserToReset(selectedUserToReset === usr.id ? null : usr.id)}
                        title="Reset password"
                        className="p-1.5 rounded-lg text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteUser(usr)}
                        title="Delete this login"
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reset password form if triggered */}
          {selectedUserToReset && (
            <div className="p-3 bg-brand-50 rounded-xl border border-brand-200 flex items-center gap-2">
              <input
                type="password"
                placeholder="New password (at least 8 characters)"
                value={resetPasswordInput}
                onChange={e => setResetPasswordInput(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white border border-brand-200 rounded-lg text-xs"
              />
              <button
                onClick={() => handleResetPassword(selectedUserToReset)}
                className="px-3 py-1.5 bg-brand-700 text-white font-bold rounded-lg hover:bg-brand-800 cursor-pointer"
              >
                Apply Reset
              </button>
            </div>
          )}

          {/* Create New User for this School */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="font-bold text-slate-800 mb-2">Add New Staff Login</h4>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                required
                placeholder="Full Name"
                value={newUserForm.name}
                onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
              <input
                type="email"
                required
                placeholder="Staff Email"
                value={newUserForm.email}
                onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={newUserForm.password}
                onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
              <div className="flex gap-1.5">
                <select
                  value={newUserForm.role}
                  onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  className="px-2 py-2 border border-slate-200 rounded-lg text-xs flex-1 cursor-pointer"
                >
                  <option value="accountant">Accountant</option>
                  <option value="reception">Reception</option>
                  <option value="school_admin">School Admin</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-2 bg-brand-700 text-white font-bold rounded-lg hover:bg-brand-800 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
};
