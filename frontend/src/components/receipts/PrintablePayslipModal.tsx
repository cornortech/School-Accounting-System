import React from 'react';
import { Modal } from '../common/Modal.tsx';
import { SalaryPayroll, Staff, School } from '../../types/index.ts';
import { Printer, CheckCircle } from 'lucide-react';
import { useMoney } from '../../utils/money.ts';

interface PrintablePayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  payroll: SalaryPayroll | null;
  staff?: Staff | null;
  school?: School | null;
}

export const PrintablePayslipModal: React.FC<PrintablePayslipModalProps> = ({
  isOpen,
  onClose,
  payroll,
  staff,
  school,
}) => {
  const money = useMoney();
  if (!payroll) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Salary Payslip"
      subtitle={`${payroll.month} ${payroll.year} - ${payroll.staffName}`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        <div className="flex justify-end no-print">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Payslip
          </button>
        </div>

        <div id="printable-document" className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center pb-4 border-b-2 border-brand-900">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{school?.name}</h2>
              <p className="text-xs text-slate-500">Salary slip</p>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-0.5 bg-brand-100 text-brand-800 text-[11px] font-bold rounded uppercase">
               {payroll.status === 'paid' ? 'PAID' : payroll.status === 'partial' ? 'PARTLY PAID' : 'PENDING'}
              </span>
              <p className="text-xs font-mono font-bold text-slate-700 mt-1">{payroll.payrollId}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 text-xs bg-slate-50 p-3 rounded-lg my-4">
            <div>
              <span className="text-slate-400 block">Employee Name:</span>
              <span className="font-bold text-slate-800">{payroll.staffName}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Staff ID:</span>
              <span className="font-bold text-slate-800">{payroll.staffId}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Designation:</span>
              <span className="font-medium text-slate-800">{payroll.designation}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Payroll Period:</span>
              <span className="font-medium text-brand-700 font-bold">{payroll.month} {payroll.year}</span>
            </div>

            
          {/* Payments made for this month (full or part) */}
          <div className="mt-4 text-xs border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex justify-between px-3 py-2 bg-slate-50 font-bold text-slate-700">
              <span>Paid so far: {money(payroll.paidAmount || 0)}</span>
              <span className={(payroll.dueAmount || 0) > 0 ? 'text-amber-600' : 'text-slate-700'}>
                Balance: {money(payroll.dueAmount || 0)}
              </span>
            </div>
            {(payroll.payments || []).map((pm, i) => (
              <div key={i} className="flex justify-between px-3 py-1.5 border-t border-slate-100 text-slate-600">
                <span>{pm.date} • {pm.method} • {pm.voucherNo}</span>
                <span className="font-semibold text-slate-800">{money(pm.amount)}</span>
              </div>
            ))}
          </div>
          
            {payroll.paymentDate && (
              <div>
                <span className="text-slate-400 block">Disbursed Date:</span>
                <span className="font-medium text-slate-800">{payroll.paymentDate}</span>
              </div>
            )}
            {payroll.paymentMethod && (
              <div>
                <span className="text-slate-400 block">Payment Method:</span>
                <span className="font-medium text-slate-800">{payroll.paymentMethod}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs">
            <div className="border border-slate-200 rounded-lg p-3">
              <h4 className="font-bold text-slate-700 border-b pb-2 mb-2 text-emerald-700">Earnings</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Base Salary</span>
                  <span className="font-semibold">{money(payroll.baseSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Allowances (Travel/House)</span>
                  <span className="font-semibold text-emerald-600">+{money(payroll.allowances)}</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3">
              <h4 className="font-bold text-slate-700 border-b pb-2 mb-2 text-rose-700">Deductions</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Tax / Provident Fund</span>
                  <span className="font-semibold text-rose-600">-{money(payroll.deductions)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center bg-brand-900 text-white p-4 rounded-xl mt-6">
            <span className="font-bold text-sm">Net Payable Salary:</span>
            <span className="text-xl font-semibold">{money(payroll.netSalary)}</span>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-10 mt-6 border-t border-slate-200 text-center text-xs">
            <div>
              <div className="border-t border-slate-400 w-36 mx-auto pt-1 font-semibold text-slate-600">
                Employee Signature
              </div>
            </div>
            <div>
              <div className="border-t border-slate-400 w-36 mx-auto pt-1 font-semibold text-slate-600">
                School Bursar Stamp
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
