import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { API_ROOT } from '../config.ts';
import {
  Fingerprint, Users, UserCheck, UserX, Clock, Activity, Search, ChevronLeft, ChevronRight,
  Download, Printer, Plus, RefreshCw, Trash2, Wifi, WifiOff, Settings, BarChart3, Cpu, Link2, Info,
} from 'lucide-react';

// ---------- small helpers ----------
const hm = (min: number) => (min > 0 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m` : '—');
const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const prettyDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PAGE_SIZE = 15;

const STATUS: Record<string, { label: string; cls: string }> = {
  present: { label: 'Present', cls: 'bg-brand-50 text-brand-800 border-brand-200' },
  late: { label: 'Late', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  working: { label: 'Working now', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  absent: { label: 'Absent', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  not_in_yet: { label: 'Not in yet', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  weekly_off: { label: 'Weekly off', cls: 'bg-slate-50 text-slate-400 border-slate-200' },
  on_leave: { label: 'On leave', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  upcoming: { label: '—', cls: 'bg-white text-slate-300 border-slate-100' },
  not_joined: { label: 'Not joined', cls: 'bg-white text-slate-300 border-slate-100' },
};
const StatusPill: React.FC<{ status: string; late?: boolean }> = ({ status, late }) => {
  const s = STATUS[status] || STATUS.absent;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${s.cls}`}>{s.label}</span>
      {late && status === 'working' && <span className="px-2 py-0.5 rounded-full border text-[11px] font-bold bg-amber-50 text-amber-800 border-amber-200">Late</span>}
    </span>
  );
};

// Download rows as a CSV file (opens in Excel)
function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

type Tab = 'daily' | 'reports' | 'devices' | 'settings';

export const AttendancePage: React.FC = () => {
  const { user, showNotification, activeSchool } = useAuth();
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin';
  const [tab, setTab] = useState<Tab>('daily');
  const [historyFor, setHistoryFor] = useState<{ staffId: string; fullName: string } | null>(null);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; admin?: boolean }[] = [
    { id: 'daily', label: 'Daily attendance', icon: <Users className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'devices', label: 'Fingerprint devices', icon: <Cpu className="w-4 h-4" />, admin: true },
    { id: 'settings', label: 'Working hours', icon: <Settings className="w-4 h-4" />, admin: true },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-700 text-white flex items-center justify-center">
          <Fingerprint className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Attendance</h1>
          <p className="text-xs text-slate-500">First scan of the day is check-in, last scan is check-out.</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-fit overflow-x-auto print:hidden">
        {tabs.filter(t => !t.admin || isAdmin).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              tab === t.id ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'daily' && <DailyTab isAdmin={isAdmin} onOpenHistory={setHistoryFor} schoolKey={activeSchool?.schoolId} notify={showNotification} />}
      {tab === 'reports' && <ReportsTab onOpenHistory={setHistoryFor} schoolKey={activeSchool?.schoolId} notify={showNotification} />}
      {tab === 'devices' && isAdmin && <DevicesTab schoolKey={activeSchool?.schoolId} notify={showNotification} />}
      {tab === 'settings' && isAdmin && <SettingsTab schoolKey={activeSchool?.schoolId} notify={showNotification} />}

      <HistoryModal person={historyFor} onClose={() => setHistoryFor(null)} isAdmin={isAdmin} notify={showNotification} />
    </div>
  );
};

type Notify = (msg: string, type?: any) => void;

// ======================================================================
// Daily attendance
// ======================================================================
const DailyTab: React.FC<{ isAdmin: boolean; onOpenHistory: (p: any) => void; schoolKey?: string; notify: Notify }> = ({ isAdmin, onOpenHistory, schoolKey, notify }) => {
  const [date, setDate] = useState('');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ staffId: '', date: '', time: '', note: '' });

  const load = async (d?: string) => {
    setIsLoading(true);
    try {
      const res = await api.attendance.getDay(d);
      if (res.success) {
        setData(res);
        setDate(res.date);
      }
    } catch (err: any) {
      notify('Could not load attendance: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(date || undefined);
  }, [schoolKey]);

  // Refresh every 60 seconds while looking at today, so new scans appear by themselves
  useEffect(() => {
    if (!data || data.date !== data.today) return;
    const timer = setInterval(() => load(data.date), 60000);
    return () => clearInterval(timer);
  }, [data?.date, data?.today]);

  const changeDate = (d: string) => {
    setPage(1);
    load(d);
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows || []).filter((r: any) => {
      if (q && !`${r.fullName} ${r.staffId} ${r.department} ${r.designation}`.toLowerCase().includes(q)) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'present') return ['present', 'late', 'working'].includes(r.status);
      if (statusFilter === 'late') return r.isLate;
      if (statusFilter === 'absent') return ['absent', 'not_in_yet'].includes(r.status);
      return r.status === statusFilter;
    });
  }, [data, search, statusFilter]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const saveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.attendance.addManual(manual);
      if (res.success) {
        notify(res.message, 'success');
        setManualOpen(false);
        load(date);
      }
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const exportCsv = () =>
    downloadCsv(`attendance_${date}.csv`, ['Staff ID', 'Name', 'Department', 'Check-in', 'Check-out', 'Working time', 'Late (min)', 'Overtime (min)', 'Status'],
      rows.map((r: any) => [r.staffId, r.fullName, r.department, r.checkIn, r.checkOut, hm(r.workingMinutes), r.lateMinutes, r.overtimeMinutes, (STATUS[r.status] || { label: r.status }).label]));

  const s = data?.summary;
  const cards = [
    { label: 'Total staff', value: s?.totalStaff, icon: <Users className="w-4 h-4" />, cls: 'text-slate-700 bg-slate-100' },
    { label: 'Present', value: s?.present, icon: <UserCheck className="w-4 h-4" />, cls: 'text-brand-700 bg-brand-100' },
    { label: data?.date === data?.today ? 'Absent / not in' : 'Absent', value: s?.absent, icon: <UserX className="w-4 h-4" />, cls: 'text-rose-700 bg-rose-100' },
    { label: 'Late', value: s?.late, icon: <Clock className="w-4 h-4" />, cls: 'text-amber-700 bg-amber-100' },
    { label: 'Working now', value: s?.currentlyWorking, icon: <Activity className="w-4 h-4" />, cls: 'text-sky-700 bg-sky-100' },
  ];

  return (
    <div className="space-y-5">
      {/* Date bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(shiftDate(date, -1))} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer" title="Previous day">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            max={data?.today}
            onChange={e => e.target.value && changeDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-brand-600"
          />
          <button
            onClick={() => changeDate(shiftDate(date, 1))}
            disabled={!data || date >= data.today}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            title="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {data && date !== data.today && (
            <button onClick={() => changeDate(data.today)} className="px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50 rounded-lg cursor-pointer">
              Today
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => {
                setManual({ staffId: data?.rows?.[0]?.staffId || '', date, time: '', note: '' });
                setManualOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Manual entry
            </button>
          )}
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer">
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <h2 className="hidden print:block text-lg font-bold">Attendance - {date && prettyDate(date)}</h2>

      {data?.isWeeklyOff && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          {prettyDate(date)} is a weekly day off. Anyone who scanned is still shown as present.
        </div>
      )}
      {isAdmin && s?.notLinked > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2 print:hidden">
          <Info className="w-4 h-4 shrink-0 mt-px" />
          <span>
            {s.notLinked} staff member{s.notLinked === 1 ? ' is' : 's are'} not linked to the fingerprint machine yet. Add their
            <b> Device User ID</b> in Staff Directory → Edit, or link them in the Fingerprint devices tab.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className="p-4 bg-white rounded-2xl border border-slate-200/80">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c.cls}`}>{c.icon}</div>
            <span className="text-2xl font-bold text-slate-900 block">{isLoading && !data ? '…' : c.value ?? 0}</span>
            <span className="text-[11px] text-slate-500">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2 print:hidden">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, ID or department"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <option value="all">Everyone</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="working">Working now</option>
            <option value="absent">Absent / not in</option>
            <option value="on_leave">On leave</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Check-in</th>
                <th className="py-3 px-4">Check-out</th>
                <th className="py-3 px-4">Working hours</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && !data ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">No staff match.</td></tr>
              ) : (
                shown.map((r: any) => (
                  <tr key={r.staffId} onClick={() => onOpenHistory(r)} className="hover:bg-brand-50/40 cursor-pointer">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{r.fullName}</span>
                      <span className="text-[11px] text-slate-400">
                        {r.staffId}
                        {r.deviceUserId ? ` • Device ID ${r.deviceUserId}` : ' • not linked'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{r.department || '—'}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900">{r.checkIn || '—'}</span>
                      {r.lateMinutes > 0 && <span className="block text-[11px] text-amber-700">{r.lateMinutes} min late</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900">{r.checkOut || '—'}</span>
                      {r.overtimeMinutes > 0 && <span className="block text-[11px] text-brand-700">+{hm(r.overtimeMinutes)} overtime</span>}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {hm(r.workingMinutes)}
                      {r.hasManual && <span className="ml-1 text-[10px] text-slate-400">(manual)</span>}
                    </td>
                    <td className="py-3 px-4"><StatusPill status={r.status} late={r.isLate} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 print:hidden">
            <span>{rows.length} staff • page {page} of {pages}</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 cursor-pointer">Previous</button>
              <button disabled={page === pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 cursor-pointer">Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={manualOpen} onClose={() => setManualOpen(false)} title="Manual entry" subtitle="Add a scan by hand (machine not working, forgot to scan…)" maxWidth="md">
        <form onSubmit={saveManual} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Staff member *</label>
            <select required value={manual.staffId} onChange={e => setManual({ ...manual, staffId: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer">
              {(data?.rows || []).map((r: any) => <option key={r.staffId} value={r.staffId}>{r.fullName} ({r.staffId})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Date *</label>
              <input type="date" required max={data?.today} value={manual.date} onChange={e => setManual({ ...manual, date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Time *</label>
              <input type="time" required value={manual.time} onChange={e => setManual({ ...manual, time: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason</label>
            <input value={manual.note} onChange={e => setManual({ ...manual, note: e.target.value })} placeholder="e.g. Machine was off" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
          </div>
          <p className="text-[11px] text-slate-500">Add the arrival time first. Add the leaving time as a second entry.</p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setManualOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 cursor-pointer">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg cursor-pointer">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ======================================================================
// Reports
// ======================================================================
const ReportsTab: React.FC<{ onOpenHistory: (p: any) => void; schoolKey?: string; notify: Notify }> = ({ onOpenHistory, schoolKey, notify }) => {
  const todayLocal = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState({ from: `${todayLocal.slice(0, 7)}-01`, to: todayLocal });
  const [preset, setPreset] = useState('month');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async (from: string, to: string) => {
    setIsLoading(true);
    try {
      const res = await api.attendance.getReport(from, to);
      if (res.success) setData(res);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(range.from, range.to);
  }, [schoolKey]);

  const applyPreset = (p: string) => {
    const today = data?.today || todayLocal;
    let from = today, to = today;
    if (p === 'week') {
      const wd = new Date(`${today}T00:00:00Z`).getUTCDay();
      from = shiftDate(today, -wd); // from Sunday
    } else if (p === 'month') {
      from = `${today.slice(0, 7)}-01`;
    } else if (p === 'lastMonth') {
      const firstThis = `${today.slice(0, 7)}-01`;
      to = shiftDate(firstThis, -1);
      from = `${to.slice(0, 7)}-01`;
    }
    setPreset(p);
    setRange({ from, to });
    load(from, to);
  };

  const exportCsv = () =>
    downloadCsv(`attendance_report_${range.from}_to_${range.to}.csv`,
      ['Staff ID', 'Name', 'Department', 'Present days', 'Late days', 'Absent days', 'Total hours', 'Overtime hours', 'Average check-in'],
      (data?.staff || []).map((r: any) => [r.staffId, r.fullName, r.department, r.presentDays, r.lateDays, r.absentDays, r.totalWorkingHours, r.overtimeHours, r.averageCheckIn]));

  const maxBar = Math.max(1, ...(data?.daily || []).map((d: any) => d.present + d.absent));

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['lastMonth', 'Last month']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => applyPreset(id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer ${preset === id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 text-xs">
            <input type="date" value={range.from} onChange={e => { setPreset('custom'); setRange({ ...range, from: e.target.value }); }} className="px-2 py-1.5 border border-slate-200 rounded-lg" />
            <span className="text-slate-400">to</span>
            <input type="date" value={range.to} onChange={e => { setPreset('custom'); setRange({ ...range, to: e.target.value }); }} className="px-2 py-1.5 border border-slate-200 rounded-lg" />
            <button onClick={() => load(range.from, range.to)} className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg cursor-pointer">Show</button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} disabled={!data} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer">
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <h2 className="hidden print:block text-lg font-bold">Attendance report {range.from} to {range.to}</h2>

      {isLoading && !data ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading…</div>
      ) : data && (
        <>
          {/* Chart */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-900">Present vs absent per day</h3>
              <div className="flex gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-600" /> Present</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-300" /> Absent</span>
                <span className="text-slate-400">{data.workingDays} working days</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 h-40 min-w-fit">
                {data.daily.map((d: any) => (
                  <div key={d.date} className="flex flex-col items-center justify-end h-full w-5 shrink-0" title={`${d.date}: ${d.present} present, ${d.absent} absent${d.weeklyOff ? ' (day off)' : ''}`}>
                    <div className="w-full flex flex-col justify-end flex-1">
                      <div className="w-full bg-rose-300 rounded-t-sm" style={{ height: `${(d.absent / maxBar) * 100}%` }} />
                      <div className={`w-full ${d.weeklyOff ? 'bg-slate-300' : 'bg-brand-600'} ${d.absent ? '' : 'rounded-t-sm'}`} style={{ height: `${(d.present / maxBar) * 100}%` }} />
                    </div>
                    <span className={`text-[9px] mt-1 ${d.weeklyOff ? 'text-slate-300' : 'text-slate-500'}`}>{d.date.slice(8)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Per staff */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4 text-center">Present</th>
                    <th className="py-3 px-4 text-center">Late</th>
                    <th className="py-3 px-4 text-center">Absent</th>
                    <th className="py-3 px-4 text-right">Total hours</th>
                    <th className="py-3 px-4 text-right">Overtime</th>
                    <th className="py-3 px-4 text-center">Avg. check-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.staff.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-400">No active staff.</td></tr>
                  ) : data.staff.map((r: any) => (
                    <tr key={r.staffId} onClick={() => onOpenHistory(r)} className="hover:bg-brand-50/40 cursor-pointer">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{r.fullName}</span>
                        <span className="text-[11px] text-slate-400">{r.designation} • {r.department}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-brand-700">{r.presentDays}</td>
                      <td className="py-3 px-4 text-center font-bold text-amber-600">{r.lateDays}</td>
                      <td className="py-3 px-4 text-center font-bold text-rose-600">{r.absentDays}</td>
                      <td className="py-3 px-4 text-right font-semibold">{r.totalWorkingHours} h</td>
                      <td className="py-3 px-4 text-right">{r.overtimeHours} h</td>
                      <td className="py-3 px-4 text-center">{r.averageCheckIn || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 print:hidden">Click a person to see every day and every scan. Weekly days off and today are not counted as absent.</p>
        </>
      )}
    </div>
  );
};

// ======================================================================
// One person's history
// ======================================================================
const HistoryModal: React.FC<{ person: { staffId: string; fullName: string } | null; onClose: () => void; isAdmin: boolean; notify: Notify }> = ({ person, onClose, isAdmin, notify }) => {
  const todayLocal = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState({ from: `${todayLocal.slice(0, 7)}-01`, to: todayLocal });
  const [data, setData] = useState<any>(null);

  const load = async () => {
    if (!person) return;
    try {
      const res = await api.attendance.getHistory(person.staffId, range.from, range.to);
      if (res.success) setData(res);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  useEffect(() => {
    setData(null);
    load();
  }, [person?.staffId]);

  const removeManual = async (id: string) => {
    if (!window.confirm('Remove this manual entry?')) return;
    try {
      const res = await api.devices.deleteLog(id);
      if (res.success) {
        notify(res.message, 'success');
        load();
      }
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  return (
    <Modal isOpen={!!person} onClose={onClose} title={person?.fullName || ''} subtitle="Attendance history" maxWidth="2xl">
      <div className="space-y-3 text-xs">
        <div className="flex items-center gap-1.5">
          <input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} className="px-2 py-1.5 border border-slate-200 rounded-lg" />
          <span className="text-slate-400">to</span>
          <input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} className="px-2 py-1.5 border border-slate-200 rounded-lg" />
          <button onClick={load} className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg cursor-pointer">Show</button>
        </div>
        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[55vh] overflow-y-auto">
          {!data ? (
            <div className="py-8 text-center text-slate-400">Loading…</div>
          ) : data.history.map((h: any) => (
            <div key={h.date} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="sm:w-36 font-semibold text-slate-800">{prettyDate(h.date)}</div>
              <div className="flex-1 flex flex-wrap items-center gap-1.5">
                {h.scans.length === 0 && <span className="text-slate-300">no scans</span>}
                {h.scans.map((sc: any) => (
                  <span
                    key={sc.id}
                    title={sc.note || (sc.source === 'manual' ? 'Manual entry' : sc.deviceId)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono ${sc.source === 'manual' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  >
                    {sc.time}
                    {sc.source === 'manual' && isAdmin && (
                      <button onClick={() => removeManual(sc.id)} className="text-amber-700 hover:text-rose-600 cursor-pointer" title="Remove manual entry">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="sm:w-24 text-slate-600">{hm(h.workingMinutes)}</div>
              <div className="sm:w-28"><StatusPill status={h.status} /></div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">Grey = scan from the machine. Yellow = manual entry.</p>
      </div>
    </Modal>
  );
};

// ======================================================================
// Devices
// ======================================================================
const DevicesTab: React.FC<{ schoolKey?: string; notify: Notify }> = ({ schoolKey, notify }) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [unlinked, setUnlinked] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', serialNumber: '', location: '' });
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const server = (() => {
    try {
      const u = new URL(API_ROOT);
      return { host: u.hostname, port: u.port || (u.protocol === 'https:' ? '443' : '80'), https: u.protocol === 'https:' };
    } catch {
      return { host: API_ROOT, port: '', https: false };
    }
  })();

  const load = async () => {
    setIsLoading(true);
    try {
      const [d, l, s] = await Promise.all([api.devices.getAll(), api.devices.getLogs(), api.staff.getAll({ status: 'active' })]);
      if (d.success) setDevices(d.devices);
      if (l.success) {
        setLogs(l.logs);
        setUnlinked(l.unlinked);
      }
      if (s.success) setStaff(s.staff);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000); // keep "online" status fresh
    return () => clearInterval(timer);
  }, [schoolKey]);

  const run = async (call: Promise<any>, after?: () => void) => {
    try {
      const res = await call;
      if (res.success) {
        notify(res.message, 'success');
        after?.();
        load();
      }
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const register = (e: React.FormEvent) => {
    e.preventDefault();
    run(api.devices.register(form), () => {
      setAddOpen(false);
      setForm({ name: '', serialNumber: '', location: '' });
    });
  };

  const linkUser = (u: any) => {
    const staffId = linkChoice[`${u.deviceId}|${u.deviceUserId}`];
    if (!staffId) return notify('Choose a staff member first.', 'error');
    run(api.staff.update(staffId, { deviceUserId: u.deviceUserId }));
  };

  const unlinkedStaff = staff.filter((s: any) => !s.deviceUserId);
  const ago = (iso?: string) => {
    if (!iso) return 'never';
    const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
    return new Date(iso).toLocaleString();
  };

  return (
    <div className="space-y-5">
      {/* Machines */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900">Machines</h3>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-lg cursor-pointer">
          <Plus className="w-4 h-4" /> Add device
        </button>
      </div>

      {isLoading && !devices.length ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading…</div>
      ) : devices.length === 0 ? (
        <div className="p-6 bg-white border border-dashed border-slate-300 rounded-2xl text-center text-xs text-slate-500">
          <Fingerprint className="w-8 h-8 text-brand-300 mx-auto mb-2" />
          No fingerprint machine yet. Click <b>Add device</b> and enter the serial number shown on the machine.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {devices.map(d => (
            <div key={d.deviceId} className={`p-4 bg-white rounded-2xl border ${d.status === 'active' ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{d.name}</span>
                    <span className="text-[11px] text-slate-400">{d.deviceId}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">SN: {d.serialNumber}</span>
                  {d.location && <span className="text-[11px] text-slate-500"> • {d.location}</span>}
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border ${
                  d.status !== 'active' ? 'bg-slate-50 text-slate-500 border-slate-200'
                    : d.online ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {d.online && d.status === 'active' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {d.status !== 'active' ? 'Disabled' : d.online ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-400 block">Last seen</span><b className="text-slate-700">{ago(d.lastSeenAt)}</b></div>
                <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-400 block">Last scan</span><b className="text-slate-700">{ago(d.lastLogAt)}</b></div>
                <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-400 block">Scans received</span><b className="text-slate-700">{d.totalLogs}</b></div>
              </div>
              {d.info?.firmware && (
                <p className="mt-2 text-[11px] text-slate-500">{d.info.firmware} • {d.info.userCount} users • {d.info.fingerprintCount} fingerprints • from {d.lastIp}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <button onClick={() => run(api.devices.sync(d.deviceId))} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 rounded-lg text-[11px] font-bold cursor-pointer">
                  <RefreshCw className="w-3 h-3" /> Sync all scans
                </button>
                <button onClick={() => run(api.devices.update(d.deviceId, { status: d.status === 'active' ? 'inactive' : 'active' }))} className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-[11px] font-bold cursor-pointer">
                  {d.status === 'active' ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => window.confirm(`Remove ${d.name}? Attendance already received is kept.`) && run(api.devices.remove(d.deviceId))}
                  className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How to connect */}
      <div className="p-4 bg-brand-50/60 border border-brand-100 rounded-2xl text-xs text-slate-700 space-y-2">
        <h4 className="font-bold text-brand-900 flex items-center gap-1.5"><Info className="w-4 h-4" /> Settings to type into the machine</h4>
        <p>On the machine open <b>Menu → Comm. (Communication) → Cloud Server Setting</b> (on some models: <b>ADMS</b>) and enter:</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="p-2 bg-white rounded-lg border border-brand-100"><span className="text-slate-400 block text-[11px]">Server address</span><b className="font-mono break-all">{server.host}</b></div>
          <div className="p-2 bg-white rounded-lg border border-brand-100"><span className="text-slate-400 block text-[11px]">Server port</span><b className="font-mono">{server.port}</b></div>
          <div className="p-2 bg-white rounded-lg border border-brand-100"><span className="text-slate-400 block text-[11px]">HTTPS</span><b>{server.https ? 'ON' : 'OFF'}</b></div>
        </div>
        <p>Also turn <b>Enable Domain Name</b> ON (if shown) and <b>Proxy</b> OFF. Restart the machine. It shows <b>Online</b> here within a minute.</p>
      </div>

      {/* Unlinked users */}
      {unlinked.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-1.5">
            <Link2 className="w-4 h-4" /> These machine users scanned but are not linked to a staff member
          </div>
          <div className="divide-y divide-slate-100">
            {unlinked.map(u => {
              const key = `${u.deviceId}|${u.deviceUserId}`;
              return (
                <div key={key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                  <div className="flex-1">
                    <b className="text-slate-900">Device User ID {u.deviceUserId}</b>
                    <span className="text-slate-500"> • {u.scans} scan{u.scans === 1 ? '' : 's'} • last {u.lastScan} • {u.deviceId}</span>
                  </div>
                  <select value={linkChoice[key] || ''} onChange={e => setLinkChoice({ ...linkChoice, [key]: e.target.value })} className="px-2 py-1.5 border border-slate-200 rounded-lg cursor-pointer">
                    <option value="">Choose staff…</option>
                    {unlinkedStaff.map((s: any) => <option key={s.staffId} value={s.staffId}>{s.fullName}</option>)}
                  </select>
                  <button onClick={() => linkUser(u)} className="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg cursor-pointer">Link</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent scans */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-slate-900">Latest scans received</div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Device user</th>
                <th className="py-2.5 px-4">Staff</th>
                <th className="py-2.5 px-4">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">No scans yet.</td></tr>
              ) : logs.slice(0, 100).map(l => (
                <tr key={l.id}>
                  <td className="py-2 px-4 font-mono">{l.punchTime}</td>
                  <td className="py-2 px-4">{l.source === 'manual' ? '—' : l.deviceUserId}</td>
                  <td className="py-2 px-4">{l.staffName || <span className="text-amber-700 font-semibold">not linked</span>}</td>
                  <td className="py-2 px-4 text-slate-500">{l.source === 'manual' ? `Manual (${l.addedBy})` : l.deviceId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

           <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add fingerprint device" subtitle="Register the machine so its scans are saved for this school" maxWidth="md">
        <form onSubmit={register} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Device name *</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main gate" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Serial number (SN) *</label>
            <input required value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value.toUpperCase() })} placeholder="e.g. CKJJ201560001" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono" />
            <p className="mt-1 text-[11px] text-slate-500">Find it on the machine: <b>Menu → System Info → Device Info → Serial Number</b>, or on the sticker at the back.</p>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Location</label>
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Ground floor" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 cursor-pointer">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg cursor-pointer">Add device</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ======================================================================
// Settings
// ======================================================================
const SettingsTab: React.FC<{ schoolKey?: string; notify: Notify }> = ({ schoolKey, notify }) => {
  const [form, setForm] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.attendance.getSettings()
      .then(res => res.success && setForm(res.settings))
      .catch((err: any) => notify(err.message, 'error'));
  }, [schoolKey]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.attendance.saveSettings({ ...form, graceMinutes: Number(form.graceMinutes) });
      if (res.success) notify(res.message, 'success');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!form) return <div className="py-8 text-center text-xs text-slate-400">Loading…</div>;

  const toggleDay = (d: number) =>
    setForm({ ...form, weeklyOffDays: form.weeklyOffDays.includes(d) ? form.weeklyOffDays.filter((x: number) => x !== d) : [...form.weeklyOffDays, d] });

  return (
    <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-5 text-xs max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block font-bold text-slate-700 mb-1">School starts</label>
          <input type="time" required value={form.workStart} onChange={e => setForm({ ...form, workStart: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">School ends</label>
          <input type="time" required value={form.workEnd} onChange={e => setForm({ ...form, workEnd: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">Grace time (minutes)</label>
          <input type="number" min={0} max={240} required value={form.graceMinutes} onChange={e => setForm({ ...form, graceMinutes: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Late = arriving after start time + grace time. Overtime = leaving after the end time.
      </p>
      <div>
        <span className="block font-bold text-slate-700 mb-2">Weekly day off</span>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((name, i) => (
            <button
              type="button"
              key={name}
              onClick={() => toggleDay(i)}
              className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${form.weeklyOffDays.includes(i) ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {name.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <div className="sm:w-1/2">
        <label className="block font-bold text-slate-700 mb-1">Time zone</label>
        <input value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono" />
        <p className="mt-1 text-[11px] text-slate-500">Nepal: Asia/Kathmandu</p>
      </div>
      <div className="pt-3 border-t border-slate-100 flex justify-end">
        <button type="submit" disabled={isSaving} className="px-5 py-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-bold rounded-lg cursor-pointer">
          {isSaving ? 'Saving…' : 'Save working hours'}
        </button>
      </div>
    </form>
  );
};