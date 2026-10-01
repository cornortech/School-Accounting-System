import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { UserPlus, Pencil, KeyRound, Trash2, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';

interface SchoolUser {
  id: string;
  name: string;
  email: string;
  role: 'school_admin' | 'accountant' | 'reception';
  status: 'active' | 'inactive';
}

const ROLE_INFO: Record<string, { label: string; can: string; color: string }> = {
  school_admin: {
    label: 'School Admin',
    can: 'Everything, including staff, salary and user accounts',
    color: 'bg-brand-100 text-brand-800 border-brand-200',
  },
  accountant: {
    label: 'Accountant',
    can: 'Fees, receipts, salary, expenses, cash book and reports',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  reception: {
    label: 'Reception',
    can: 'Students, fees and receipts',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

const emptyForm = { name: '', email: '', password: '', role: 'accountant' };

export const UsersPage: React.FC = () => {
  const { showNotification, activeSchool } = useAuth();
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [myId, setMyId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<SchoolUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<SchoolUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.users.getAll();
      if (res.success) {
        setUsers(res.users);
        setMyId(res.myId);
      }
    } catch (err: any) {
      showNotification('Could not load accounts: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeSchool]);

  // Small helper: run an API call, show its message, reload the list
  const run = async (call: Promise<any>, after?: () => void) => {
    try {
      const res = await call;
      if (res.success) {
        showNotification(res.message, 'success');
        after?.();
        fetchUsers();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    run(api.users.create(form), () => {
      setIsAddOpen(false);
      setForm(emptyForm);
    });
  };

  const openEdit = (u: SchoolUser) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    run(api.users.update(editUser.id, { name: form.name, email: form.email, role: form.role }), () => setEditUser(null));
  };

  const handlePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    run(api.users.resetPassword(passwordUser.id, newPassword), () => {
      setPasswordUser(null);
      setNewPassword('');
    });
  };

  const toggleStatus = (u: SchoolUser) =>
    run(api.users.setStatus(u.id, u.status === 'active' ? 'inactive' : 'active'));

  const handleDelete = (u: SchoolUser) => {
    if (!window.confirm(`Delete the account of "${u.name}" (${u.email})?\n\nThey will not be able to log in any more. This can't be undone.`)) return;
    run(api.users.remove(u.id));
  };

  const activeCount = users.filter(u => u.status === 'active').length;
  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600';

  // Name / email / role fields, shared by the Add and Edit windows
  const renderFields = (isEdit: boolean) => (
    <>
      <div>
        <label className="block font-bold text-slate-700 mb-1">Full name *</label>
        <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className="block font-bold text-slate-700 mb-1">Email (used to log in) *</label>
        <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
      </div>
      {!isEdit && (
        <div>
          <label className="block font-bold text-slate-700 mb-1">Password *</label>
          <input
            type="text"
            required
            minLength={8}
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="At least 8 characters"
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-slate-500">Give this password to the person. They can change it after logging in.</p>
        </div>
      )}
      <div>
        <span className="block font-bold text-slate-700 mb-1">Role *</span>
        <div className="space-y-2">
          {Object.entries(ROLE_INFO).map(([key, info]) => {
            const disabled = isEdit && editUser?.id === myId && key !== editUser?.role;
            return (
              <label
                key={key}
                className={`flex items-start gap-3 p-3 border rounded-xl transition-colors ${
                  form.role === key ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 hover:bg-slate-50'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={key}
                  disabled={disabled}
                  checked={form.role === key}
                  onChange={() => setForm({ ...form, role: key })}
                  className="mt-0.5 accent-brand-700"
                />
                <div>
                  <span className="font-bold text-slate-900 block">{info.label}</span>
                  <span className="text-[11px] text-slate-500">{info.can}</span>
                </div>
              </label>
            );
          })}
        </div>
        {isEdit && editUser?.id === myId && (
          <p className="mt-1 text-[11px] text-slate-500">You can't change your own role.</p>
        )}
      </div>
    </>
  );

  const footer = (onCancel: () => void, label: string) => (
    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
      <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
        Cancel
      </button>
      <button type="submit" className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg shadow-md cursor-pointer">
        {label}
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User Accounts</h1>
          <p className="text-xs text-slate-500 mt-1">
            People who can log in to {activeSchool?.name || 'this school'}. {activeCount} active of {users.length}.
          </p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setIsAddOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add account</span>
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden divide-y divide-slate-100">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading…</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No accounts yet.</div>
        ) : (
          users.map(u => {
            const isActive = u.status === 'active';
            const isMe = u.id === myId;
            const info = ROLE_INFO[u.role];
            return (
              <div
                key={u.id}
                className={`px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${isActive ? 'hover:bg-brand-50/30' : 'bg-slate-50/70'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      isActive ? 'bg-brand-100 text-brand-800' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm truncate ${isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{u.name}</span>
                      {isMe && <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">You</span>}
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono truncate block">{u.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap md:justify-end">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${info?.color}`}>
                    {u.role === 'school_admin' && <ShieldCheck className="w-3 h-3" />}
                    {info?.label}
                  </span>

                  <button
                    onClick={() => toggleStatus(u)}
                    disabled={isMe}
                    title={isMe ? "You can't deactivate yourself" : isActive ? 'Click to deactivate' : 'Click to activate'}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors disabled:cursor-not-allowed ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100'
                        : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    } ${isMe ? '' : 'cursor-pointer'}`}
                  >
                    {isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {isActive ? 'Active' : 'Inactive'}
                  </button>

                  <button onClick={() => openEdit(u)} title="Edit" className="p-2 rounded-lg text-slate-600 hover:bg-brand-50 hover:text-brand-700 cursor-pointer">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setPasswordUser(u);
                      setNewPassword('');
                    }}
                    title="Set a new password"
                    className="p-2 rounded-lg text-slate-600 hover:bg-brand-50 hover:text-brand-700 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  {!isMe && (
                    <button onClick={() => handleDelete(u)} title="Delete account" className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add account" subtitle="Create a login for someone at this school" maxWidth="md">
        <form onSubmit={handleAdd} className="space-y-4 text-xs">
          {renderFields(false)}
          {footer(() => setIsAddOpen(false), 'Create account')}
        </form>
      </Modal>

      {/* Edit */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit account" subtitle={editUser?.email} maxWidth="md">
        <form onSubmit={handleEdit} className="space-y-4 text-xs">
          {renderFields(true)}
          {footer(() => setEditUser(null), 'Save changes')}
        </form>
      </Modal>

      {/* New password */}
      <Modal isOpen={!!passwordUser} onClose={() => setPasswordUser(null)} title="Set a new password" subtitle={passwordUser?.name} maxWidth="sm">
        <form onSubmit={handlePassword} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">New password *</label>
            <input
              type="text"
              required
              minLength={8}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-slate-500">Tell the person their new password. The old one stops working.</p>
          </div>
          {footer(() => setPasswordUser(null), 'Save password')}
        </form>
      </Modal>
    </div>
  );
};