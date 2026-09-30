export type UserRole = 'super_admin' | 'school_admin' | 'accountant' | 'reception';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId?: string;
  school?: School;
}

export type SchoolStatus = 'active' | 'inactive' | 'deleted';

export interface School {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  currencySymbol: string;
  principalName: string;
  panNo?: string;
  establishedYear: number;
  status: SchoolStatus;
  studentCount?: number;
  staffCount?: number;
  userCount?: number;
  totalCollected?: number;
  adminEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export type StudentStatus = 'active' | 'inactive' | 'graduated';

export interface Student {
  id: string;
  schoolId: string;
  studentId: string;
  admissionNo: string;
  fullName: string;
  class: string;
  section: string;
  rollNo: string;
  academicYear: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  address: string;
  status: StudentStatus;
  feeAccount?: StudentFeeAccount;
  createdAt: string;
}

export interface StudentFeeAccount {
  id?: string;
  schoolId?: string;
  studentId?: string;
  totalFee: number;
  paidAmount: number;
  discountAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  status: 'paid' | 'partial' | 'unpaid' | 'overdue';
  lastPaymentDate?: string;
}

export type FeeCategory = 
  | 'Admission'
  | 'Tuition'
  | 'Exam' 
  | 'Lab' 
  | 'Library' 
  | 'Transport' 
  | 'Sports' 
  | 'Hostel' 
  | 'Miscellaneous';

export interface FeeStructure {
  id: string;
  schoolId: string;
  feeId: string;
  title: string;
  category: FeeCategory;
  amount: number;
  class: string;
  frequency: 'Monthly' | 'Termly' | 'Annually' | 'One-Time';
  dueDate: string;
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Online/UPI' | 'Cheque';

export interface PaymentReceipt {
  id: string;
  schoolId: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  class: string;
  feeItems: { category: string; amount: number }[];
  totalAmount: number;
  discount: number;
  paidAmount: number;
  balanceRemaining: number;
  paymentMethod: PaymentMethod;
  transactionRef?: string;
  paymentDate: string;
  receivedBy: string;
  notes?: string;
  status: 'valid' | 'cancelled';
  createdAt: string;
}

export type StaffRoleType = 'teaching' | 'non_teaching';

export interface Staff {
  id: string;
  schoolId: string;
  staffId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  roleType: StaffRoleType;
  designation: string;
  department: string;
  teachingSubject?: string;
  nonTeachingRole?: string;
   joiningDate: string;
  salaryStartDate?: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: 'active' | 'on_leave' | 'terminated';
  createdAt: string;
}

export interface SalaryPayroll {
  id: string;
  schoolId: string;
  payrollId: string;
  staffId: string;
  staffName: string;
  designation: string;
  month: string;
  year: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
    netSalary: number;
  paidAmount: number;
  dueAmount: number;
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;
  payments?: { voucherNo: string; amount: number; date: string; method: string; remarks?: string; by: string }[];
  status: 'pending' | 'partial' | 'paid';
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  remarks?: string;
  createdAt: string;
}

export type ExpenseCategory = 
  | 'Utilities' 
  | 'Maintenance' 
  | 'Lab Supplies' 
  | 'Office Supplies' 
  | 'Sports Equipment' 
  | 'Events' 
  | 'Transport & Fuel' 
  | 'Software & IT' 
  | 'Miscellaneous';

export interface Expense {
  id: string;
  schoolId: string;
  expenseId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  description: string;
  vendorOrPerson: string;
  receiptRef?: string;
  recordedBy: string;
  createdAt: string;
}

export interface LedgerTransaction {
  id: string;
  schoolId: string;
  transactionId: string;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  runningBalance: number;
  referenceType: 'fee_payment' | 'salary_payout' | 'expense' | 'manual';
  referenceId: string;
  description: string;
  date: string;
  recordedBy: string;
  createdAt: string;
}
