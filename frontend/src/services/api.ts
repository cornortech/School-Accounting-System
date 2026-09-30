import { API_ROOT } from '../config.ts';

const API_BASE = `${API_ROOT}/api`;

function getStoredToken(): string | null {
  return localStorage.getItem('eduledger_token');
}

function getStoredSchoolContext(): string | null {
  return localStorage.getItem('eduledger_active_school_id');
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const activeSchoolId = getStoredSchoolContext();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (activeSchoolId) {
    headers['x-school-id'] = activeSchoolId;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    getMe: () => request('/auth/me'),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      request('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Schools (Super Admin)
  schools: {
    getAll: (params?: { search?: string; status?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request(`/schools${q ? `?${q}` : ''}`);
    },
    getById: (schoolId: string) => request(`/schools/${schoolId}`),
    create: (data: any) => request('/schools', { method: 'POST', body: JSON.stringify(data) }),
    update: (schoolId: string, data: any) =>
      request(`/schools/${schoolId}`, { method: 'PUT', body: JSON.stringify(data) }),
    toggleStatus: (schoolId: string, status: 'active' | 'inactive') =>
      request(`/schools/${schoolId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    delete: (schoolId: string) => request(`/schools/${schoolId}`, { method: 'DELETE' }),
    addUser: (schoolId: string, data: any) =>
      request(`/schools/${schoolId}/users`, { method: 'POST', body: JSON.stringify(data) }),
    resetUserPassword: (schoolId: string, userId: string, newPassword: string) =>
      request(`/schools/${schoolId}/users/${userId}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      }),
          toggleUserStatus: (schoolId: string, userId: string, status: 'active' | 'inactive') =>
      request(`/schools/${schoolId}/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    deleteUser: (schoolId: string, userId: string) =>
      request(`/schools/${schoolId}/users/${userId}`, { method: 'DELETE' }),
  },

  // Students
  students: {
    getAll: (params?: { search?: string; className?: string; status?: string; sortBy?: string; sortOrder?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request(`/students${q ? `?${q}` : ''}`);
    },
    getById: (studentId: string) => request(`/students/${studentId}`),
    create: (data: any) => request('/students', { method: 'POST', body: JSON.stringify(data) }),
    update: (studentId: string, data: any) =>
      request(`/students/${studentId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (studentId: string) => request(`/students/${studentId}`, { method: 'DELETE' }),
  },

  // Fees
  fees: {
    getOverview: () => request('/fees'),
    createStructure: (data: any) => request('/fees/structures', { method: 'POST', body: JSON.stringify(data) }),
    updateStructure: (id: string, data: any) =>
      request(`/fees/structures/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteStructure: (id: string) => request(`/fees/structures/${id}`, { method: 'DELETE' }),
        applyStructure: (id: string) => request(`/fees/structures/${id}/apply`, { method: 'POST' }),
            adjustPending: (studentId: string, data: { pendingAmount: number; reason: string }) =>
      request(`/fees/accounts/${studentId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    getStudentBalances: (params?: { search?: string; className?: string; status?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request(`/fees/student-balances${q ? `?${q}` : ''}`);
    },
  },

  // Billing & Receipts
  billing: {
    getReceipts: (params?: { search?: string; paymentMethod?: string; startDate?: string; endDate?: string; status?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request(`/billing/receipts${q ? `?${q}` : ''}`);
    },
    getReceipt: (receiptNumber: string) => request(`/billing/receipts/${receiptNumber}`),
    recordPayment: (data: any) => request('/billing/payments', { method: 'POST', body: JSON.stringify(data) }),
    cancelReceipt: (receiptNumber: string, reason?: string) =>
      request(`/billing/receipts/${receiptNumber}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  },

  // Staff
  staff: {
    getAll: (params?: { search?: string; roleType?: string; status?: string; department?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request(`/staff${q ? `?${q}` : ''}`);
    },
    create: (data: any) => request('/staff', { method: 'POST', body: JSON.stringify(data) }),
    update: (staffId: string, data: any) =>
      request(`/staff/${staffId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (staffId: string) => request(`/staff/${staffId}`, { method: 'DELETE' }),
  },

  
    // Salary & Payroll
  salary: {
    getAll: (params?: { month?: string; year?: number | string; status?: string; search?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request(`/salary${q ? `?${q}` : ''}`);
    },
    pay: (data: { staffId: string; payrollIds: string[]; amount: number; paymentMethod: string; paymentDate: string; remarks?: string }) =>
      request('/salary/pay', { method: 'POST', body: JSON.stringify(data) }),
    getPayslip: (payrollId: string) => request(`/salary/${payrollId}/payslip`),
  },

  // Expenses
  expenses: {
    getAll: (params?: { category?: string; search?: string; startDate?: string; endDate?: string; year?: number }) => {
      const q = new URLSearchParams(params as any).toString();
      return request(`/expenses${q ? `?${q}` : ''}`);
    },
    create: (data: any) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    update: (expenseId: string, data: any) =>
      request(`/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (expenseId: string) => request(`/expenses/${expenseId}`, { method: 'DELETE' }),
  },

  // Accounting Ledger
  ledger: {
    getAll: (params?: { type?: string; referenceType?: string; startDate?: string; endDate?: string; search?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request(`/ledger${q ? `?${q}` : ''}`);
    },
    addJournalEntry: (data: any) => request('/ledger/journal-entry', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Financial Reports
  reports: {
    getSummary: () => request('/reports/summary'),
    getFeeCollections: (params?: { startDate?: string; endDate?: string; method?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request(`/reports/fee-collections${q ? `?${q}` : ''}`);
    },
    getPendingFees: (params?: { className?: string; status?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request(`/reports/pending-fees${q ? `?${q}` : ''}`);
    },
    getIncomeVsExpense: (year?: number) =>
      request(`/reports/income-vs-expense${year ? `?year=${year}` : ''}`),
  },
};
