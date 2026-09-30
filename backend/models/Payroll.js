const mongoose = require("mongoose");

// One payslip = one completed month of work for one staff member.
const payrollSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true },
    payrollId: { type: String, required: true }, // PAY-2026-SEP-001
    staffId: { type: String, required: true },
    staffName: { type: String, required: true },
    designation: { type: String, default: "" },
    month: { type: String, required: true }, // month the work period started in
    year: { type: Number, required: true },
    periodStart: { type: String, default: "" }, // 2026-01-15
    periodEnd: { type: String, default: "" }, // 2026-02-14
    dueDate: { type: String, default: "" }, // 2026-02-15 (the day after the month is completed)
    baseSalary: { type: Number, required: true },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    paidAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["pending", "partial", "paid"], default: "pending" },
    payments: [
      {
        _id: false,
        voucherNo: String,
        amount: Number,
        date: String,
        method: String,
        remarks: String,
        by: String,
      },
    ],
    paymentDate: { type: String }, // date of the last payment
    paymentMethod: { type: String }, // method of the last payment
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

// A staff member can only have one payslip per month.
payrollSchema.index({ schoolId: 1, staffId: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ schoolId: 1, payrollId: 1 }, { unique: true });

module.exports = mongoose.model("Payroll", payrollSchema);