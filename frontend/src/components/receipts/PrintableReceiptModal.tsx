import React from 'react';
import { Modal } from '../common/Modal.tsx';
import { PaymentReceipt, School } from '../../types/index.ts';
import { Printer, Download, CheckCircle, ShieldCheck } from 'lucide-react';
import { useMoney } from '../../utils/money.ts';

interface PrintableReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: PaymentReceipt | null;
  school?: School | null;
}

export const PrintableReceiptModal: React.FC<PrintableReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
  school,
}) => {
  const money = useMoney();
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadText = () => {
    const textContent = `
==============================================================
OFFICIAL FEE RECEIPT - ${school?.name || 'SCHOOL'}
==============================================================
Receipt Number: ${receipt.receiptNumber}
Date: ${receipt.paymentDate}
Student Name: ${receipt.studentName}
Admission No: ${receipt.admissionNo}
Class/Grade: ${receipt.class}
Payment Method: ${receipt.paymentMethod}
Transaction Ref: ${receipt.transactionRef || 'N/A'}
Received By: ${receipt.receivedBy}

FEES BREAKDOWN:
--------------------------------------------------------------
${receipt.feeItems.map(item => `${item.category.padEnd(30)} : ${money(item.amount)}`).join('\n')}
--------------------------------------------------------------
Subtotal          : ${money(receipt.totalAmount)}
Discount Concession: -${money(receipt.discount)}
TOTAL PAID        : ${money(receipt.paidAmount)}
REMAINING BALANCE : ${money(receipt.balanceRemaining)}
--------------------------------------------------------------
Status: VALID OFFICIAL PAYMENT RECEIPT
    `;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${receipt.receiptNumber}_Receipt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Fee Receipt"
      subtitle={`Receipt #${receipt.receiptNumber}`}
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Action bar (hidden in print) */}
        <div className="flex items-center justify-between bg-brand-50 p-4 rounded-xl border border-brand-100 no-print">
          <div className="flex items-center gap-2 text-brand-900 text-sm font-medium">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>Fee receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadText}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-brand-700 bg-white border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download Statement
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div
          id="printable-document"
          className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden"
        >
          {/* Subtle Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
            <span className="text-8xl font-bold rotate-[-25deg] text-brand-950">
              OFFICIAL RECEIPT
            </span>
          </div>

          {/* School Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b-2 border-brand-900 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-brand-700 flex items-center justify-center text-white font-bold text-2xl shadow-md">
                {school?.code || 'ED'}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
                  {school?.name}
                </h2>
                {school?.address && <p className="text-xs text-slate-600">{school.address}</p>}
                <p className="text-xs text-slate-500">
                  {[school?.phone && `Phone: ${school.phone}`, school?.email, school?.panNo && `PAN: ${school.panNo}`]
                    .filter(Boolean)
                    .join(' | ')}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-brand-100 text-brand-800 text-xs font-bold rounded-md tracking-wider uppercase mb-1">
                Fee Receipt
              </span>
              <p className="text-base font-semibold text-brand-900 font-mono">
                {receipt.receiptNumber}
              </p>
              <p className="text-xs text-slate-500">Date: {receipt.paymentDate}</p>
            </div>
          </div>

          {/* Student & Payment Meta Information */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 bg-slate-50/80 my-5 p-4 rounded-xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Student Name</span>
              <span className="font-bold text-slate-800 text-sm">{receipt.studentName}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Admission No</span>
              <span className="font-bold text-slate-800">{receipt.admissionNo}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Class / Section</span>
              <span className="font-bold text-slate-800">{receipt.class}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Payment Mode</span>
              <span className="font-bold text-brand-700 uppercase">{receipt.paymentMethod}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Transaction Ref</span>
              <span className="font-mono text-slate-700">{receipt.transactionRef || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Received By</span>
              <span className="font-medium text-slate-800">{receipt.receivedBy}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Receipt Status</span>
              <span className={`font-bold ${receipt.status === 'valid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {receipt.status === 'valid' ? 'PAID & VALID' : 'CANCELLED / VOID'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Time</span>
              <span className="text-slate-600">
                {new Date(receipt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Itemized Fee Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-brand-50/50">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Description / Fee Category</th>
                  <th className="py-2.5 px-3 text-right">Amount ({school?.currencySymbol || 'Rs.'})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipt.feeItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{item.category}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                      {money(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start pt-6 border-t border-slate-200 mt-4 gap-6">
            <div className="text-xs text-slate-500 max-w-xs space-y-1">
              <p className="font-semibold text-slate-700">Remarks / Terms:</p>
              <p>{receipt.notes || 'This receipt confirms that the specified fee has been officially recorded in the school accounting ledger.'}</p>
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium pt-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Authentic Digital Voucher</span>
              </div>
            </div>

            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Fee:</span>
                <span className="font-medium">{money(receipt.totalAmount)}</span>
              </div>
              {receipt.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Concession / Discount:</span>
                  <span>-{money(receipt.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-t-2 border-brand-900 font-bold text-sm text-brand-900">
                <span>Amount Paid:</span>
                <span className="text-lg font-semibold">{money(receipt.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-700 font-semibold pt-1 border-t border-slate-100">
                <span>Remaining Dues:</span>
                <span className={receipt.balanceRemaining > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                  {money(receipt.balanceRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures & Seal */}
          <div className="grid grid-cols-2 gap-8 pt-12 mt-6 border-t border-dashed border-slate-200 text-center text-xs">
            <div>
              <div className="h-10"></div>
              <div className="border-t border-slate-400 w-44 mx-auto pt-1 font-semibold text-slate-700">
                Cashier / Front Desk
              </div>
              <p className="text-[10px] text-slate-400">{receipt.receivedBy}</p>
            </div>
            <div>
              <div className="h-10 flex items-center justify-center">
                <span className="border-2 border-brand-300 text-brand-700 rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest rotate-[-5deg]">
                  ACCOUNTS SEAL
                </span>
              </div>
              <div className="border-t border-slate-400 w-44 mx-auto pt-1 font-semibold text-slate-700">
                Received by / Accountant
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
