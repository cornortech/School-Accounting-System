import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Student, PaymentReceipt } from '../types/index.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { PrintableReceiptModal } from '../components/receipts/PrintableReceiptModal.tsx';
import { GraduationCap, Plus, Search, Filter, User, Phone, Mail, MapPin, Calendar, CreditCard, Edit2, Trash2, ReceiptText, FileText, Banknote, ArrowUpDown, Eye } from 'lucide-react';
import { useMoney } from '../utils/money.ts';

export const StudentsPage: React.FC = () => {
  const money = useMoney();
  const { activeSchool, showNotification, setActiveTab } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('fullName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Selected student for detail/edit
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentPaymentHistory, setStudentPaymentHistory] = useState<PaymentReceipt[]>([]);
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] = useState<PaymentReceipt | null>(null);

  // Form state
  const [studentForm, setStudentForm] = useState({
    fullName: '',
    class: 'Grade 10',
    section: 'A',
    rollNo: '',
    academicYear: '2026-2027',
    dob: '2010-05-15',
    gender: 'Male',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    address: '',
    initialFeeAmount: '',
    status: 'active',
  });


    // Class names shown as suggestions (you can still type any class)
  const defaultClasses = ['Nursery', 'LKG', 'UKG', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
  const classSuggestions = Array.from(new Set([...defaultClasses, ...classes]));

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const res = await api.students.getAll({
        search,
        className: classFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
      });
      if (res.success) {
        setStudents(res.students);
        if (res.meta?.classes) {
          setClasses(res.meta.classes);
        }
      }
    } catch (err: any) {
      showNotification('Failed to fetch students: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search, classFilter, statusFilter, sortBy, sortOrder, activeSchool]);

  const handleOpenDetail = async (student: Student) => {
    setSelectedStudent(student);
    try {
      const res = await api.students.getById(student.studentId);
      if (res.success) {
        setSelectedStudent(res.student);
        setStudentPaymentHistory(res.paymentHistory || []);
        setIsDetailModalOpen(true);
      }
    } catch (err: any) {
      showNotification('Failed to load profile: ' + err.message, 'error');
    }
  };

  const handleOpenEdit = (student: Student) => {
    setSelectedStudent(student);
    setStudentForm({
      fullName: student.fullName,
      class: student.class,
      section: student.section,
      rollNo: student.rollNo,
      academicYear: student.academicYear,
      dob: student.dob,
      gender: student.gender,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      parentEmail: student.parentEmail,
      address: student.address,
      initialFeeAmount: '',
      status: student.status,
    });
    setIsEditModalOpen(true);
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.students.create(studentForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsEnrollModalOpen(false);
        setStudentForm({
          fullName: '',
          class: 'Grade 10',
          section: 'A',
          rollNo: '',
          academicYear: '2026-2027',
          dob: '2010-05-15',
          gender: 'Male',
          parentName: '',
          parentPhone: '',
          parentEmail: '',
          address: '',
          initialFeeAmount: '',
          status: 'active',
        });
        fetchStudents();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    try {
      const res = await api.students.update(selectedStudent.studentId, studentForm);
      if (res.success) {
        showNotification(res.message, 'success');
        setIsEditModalOpen(false);
        fetchStudents();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!window.confirm(`Are you sure you want to remove "${student.fullName}" from records?`)) {
      return;
    }
    try {
      const res = await api.students.delete(student.studentId);
      if (res.success) {
        showNotification(res.message, 'info');
        fetchStudents();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const getFeeBadge = (status?: string) => {
    switch (status) {
      case 'paid': return <Badge variant="emerald">PAID</Badge>;
      case 'partial': return <Badge variant="amber">PARTIAL</Badge>;
      case 'overdue': return <Badge variant="rose">OVERDUE</Badge>;
      default: return <Badge variant="slate">UNPAID</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Directory & Profiles</h1>
            <Badge variant="purple">{students.length} Enrolled</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete student academic admissions, fee ledgers, guardian details, and payment histories.
          </p>
        </div>

        <button
          onClick={() => setIsEnrollModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Enroll New Student</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by student name, admission #, student ID, parent phone..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Class:</span>
              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
              >
                <option value="all">All Grades</option>
                {classes.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
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
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Student Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Student Profile</th>
                <th className="py-3 px-4">Admission #</th>
                <th className="py-3 px-4">Class & Section</th>
                <th className="py-3 px-4">Roll #</th>
                <th className="py-3 px-4">Parent / Contact</th>
                <th className="py-3 px-4 text-right">Fee Balance</th>
                <th className="py-3 px-4 text-center">Fee Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading students...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                students.map(student => {
                  const fee = student.feeAccount;
                  return (
                    <tr key={student.studentId} className="hover:bg-brand-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-brand-100 border border-brand-200 text-brand-800 font-bold flex items-center justify-center text-xs shadow-xs">
                            {student.fullName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{student.fullName}</span>
                            <span className="text-[11px] text-brand-700 font-mono font-medium">{student.studentId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {student.admissionNo}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{student.class}</span>
                        <span className="text-slate-400 ml-1">({student.section})</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {student.rollNo}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{student.parentName}</div>
                        <div className="text-[11px] text-slate-500">{student.parentPhone}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-semibold text-slate-900">
                          {money((fee?.pendingAmount || 0))}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Paid: {money((fee?.paidAmount || 0))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {getFeeBadge(fee?.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(student)}
                            className="p-1.5 text-brand-700 hover:bg-brand-100 rounded-lg transition-colors cursor-pointer"
                            title="View Student Profile & Payment Ledger"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(student)}
                            className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Student Information"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete / Archive Student"
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

      {/* 1. Modal: Enroll New Student */}
      <Modal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title="Enroll New Student"
        subtitle="Their fee balance is set from the fees for their class"
        maxWidth="2xl"
      >
        <form onSubmit={handleEnrollSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Student Full Name *</label>
              <input
                type="text"
                required
                value={studentForm.fullName}
                onChange={e => setStudentForm({ ...studentForm, fullName: e.target.value })}
                placeholder="e.g. Aarav Thapa"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Grade / Class *</label>
                            <input
                type="text"
                required
                list="class-options"
                value={studentForm.class}
                onChange={e => setStudentForm({ ...studentForm, class: e.target.value })}
                placeholder="Type or pick, e.g. Grade 10"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
              <datalist id="class-options">
                {classSuggestions.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Section</label>
              <input
                type="text"
                value={studentForm.section}
                onChange={e => setStudentForm({ ...studentForm, section: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Roll Number</label>
              <input
                type="text"
                value={studentForm.rollNo}
                onChange={e => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                placeholder="e.g. 15"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={studentForm.dob}
                onChange={e => setStudentForm({ ...studentForm, dob: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Gender</label>
              <select
                value={studentForm.gender}
                onChange={e => setStudentForm({ ...studentForm, gender: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <h4 className="font-semibold text-sm text-brand-900 mb-2">Parent / Guardian Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Name *</label>
                <input
                  type="text"
                  required
                  value={studentForm.parentName}
                  onChange={e => setStudentForm({ ...studentForm, parentName: e.target.value })}
                  placeholder="e.g. Bikash Thapa"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Phone *</label>
                <input
                  type="text"
                  required
                  value={studentForm.parentPhone}
                  onChange={e => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                  placeholder="98XXXXXXXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={studentForm.parentEmail}
                  onChange={e => setStudentForm({ ...studentForm, parentEmail: e.target.value })}
                  placeholder="parent@gmail.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Home Address</label>
            <input
              type="text"
              value={studentForm.address}
              onChange={e => setStudentForm({ ...studentForm, address: e.target.value })}
              placeholder="Residential address..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg shadow-md cursor-pointer"
            >
              Enroll Student
            </button>
          </div>
        </form>
      </Modal>

            {/* 2. Modal: Edit Student Profile */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Student Profile"
        subtitle={`Updating records for ${selectedStudent?.fullName} (${selectedStudent?.studentId})`}
        maxWidth="2xl"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Student Full Name *</label>
              <input
                type="text"
                required
                value={studentForm.fullName}
                onChange={e => setStudentForm({ ...studentForm, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Grade / Class *</label>
              <input
                type="text"
                required
                list="class-options"
                value={studentForm.class}
                onChange={e => setStudentForm({ ...studentForm, class: e.target.value })}
                placeholder="Type or pick, e.g. Grade 10"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Section</label>
              <input
                type="text"
                value={studentForm.section}
                onChange={e => setStudentForm({ ...studentForm, section: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Roll Number</label>
              <input
                type="text"
                value={studentForm.rollNo}
                onChange={e => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Academic Year</label>
              <input
                type="text"
                value={studentForm.academicYear}
                onChange={e => setStudentForm({ ...studentForm, academicYear: e.target.value })}
                placeholder="e.g. 2026-2027"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={studentForm.dob}
                onChange={e => setStudentForm({ ...studentForm, dob: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Gender</label>
              <select
                value={studentForm.gender}
                onChange={e => setStudentForm({ ...studentForm, gender: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer focus:ring-2 focus:ring-brand-600"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Status</label>
              <select
                value={studentForm.status}
                onChange={e => setStudentForm({ ...studentForm, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer focus:ring-2 focus:ring-brand-600"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <h4 className="font-semibold text-sm text-brand-900 mb-2">Parent / Guardian Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Name *</label>
                <input
                  type="text"
                  required
                  value={studentForm.parentName}
                  onChange={e => setStudentForm({ ...studentForm, parentName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Phone *</label>
                <input
                  type="text"
                  required
                  value={studentForm.parentPhone}
                  onChange={e => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={studentForm.parentEmail}
                  onChange={e => setStudentForm({ ...studentForm, parentEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Home Address</label>
            <input
              type="text"
              value={studentForm.address}
              onChange={e => setStudentForm({ ...studentForm, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600"
            />
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
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Modal: Student Full Profile & Payment Ledger Drawer */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Student Profile & Financial Ledger"
        subtitle={`${selectedStudent?.fullName} • ${selectedStudent?.studentId}`}
        maxWidth="3xl"
      >
        {selectedStudent && (
          <div className="space-y-6 text-xs">
            {/* Top Student Particulars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-brand-50/50 p-4 rounded-xl border border-brand-100">
              <div>
                <span className="text-slate-400 block font-medium">Admission #</span>
                <span className="font-semibold text-slate-900">{selectedStudent.admissionNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Class & Section</span>
                <span className="font-semibold text-slate-900">{selectedStudent.class} ({selectedStudent.section})</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Parent Contact</span>
                <span className="font-bold text-slate-800">{selectedStudent.parentPhone}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Fee Balance</span>
                <span className="font-bold text-sm text-amber-600">
                  {money((selectedStudent.feeAccount?.pendingAmount || 0))}
                </span>
              </div>
            </div>

            {/* Financial Ledger Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <ReceiptText className="w-4 h-4 text-brand-700" />
                  <span>Payment History & Issued Receipts</span>
                </h4>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setActiveTab('billing');
                  }}
                  className="px-3 py-1 bg-brand-700 text-white font-bold rounded-lg hover:bg-brand-800 cursor-pointer"
                >
                  + Record Fee Payment
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">Receipt #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right">Paid Amount</th>
                      <th className="py-2.5 px-3 text-right">Print Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentPaymentHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No payments recorded for this student yet.
                        </td>
                      </tr>
                    ) : (
                      studentPaymentHistory.map(rcp => (
                        <tr key={rcp.receiptNumber} className="hover:bg-brand-50/20">
                          <td className="py-2.5 px-3 font-mono font-bold text-brand-900">{rcp.receiptNumber}</td>
                          <td className="py-2.5 px-3 text-slate-600">{rcp.paymentDate}</td>
                          <td className="py-2.5 px-3 font-semibold uppercase text-slate-700">{rcp.paymentMethod}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                            {money(rcp.paidAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => setSelectedReceiptForPrint(rcp)}
                              className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded font-semibold cursor-pointer"
                            >
                              Reprint
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Printable Receipt Modal */}
      <PrintableReceiptModal
        isOpen={!!selectedReceiptForPrint}
        onClose={() => setSelectedReceiptForPrint(null)}
        receipt={selectedReceiptForPrint}
        school={activeSchool}
      />
    </div>
  );
};
