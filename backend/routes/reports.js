const express = require("express");
const mongoose = require("mongoose");
const School = require("../models/School");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const FeeAccount = require("../models/FeeAccount");
const Receipt = require("../models/Receipt");
const Expense = require("../models/Expense");
const Payroll = require("../models/Payroll");
const LedgerEntry = require("../models/LedgerEntry");
const { syncPayroll, dueOf } = require("../utils/payroll");
const { describe } = require("../utils/fees");
const { sum, round2 } = require("../utils/money");
const { str, plain, isDate } = require("../utils/helpers");
const { PAYMENT_METHODS } = Receipt;

const router = express.Router();

// Last 6 calendar months, oldest first: [{ key: "2026-04", label: "Apr 26" }, ...]
function lastSixMonths() {
  const out = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short" }) + " " + String(d.getFullYear()).slice(2);
    out.push({ key, label });
  }
  return out;
}

// GET /api/reports/summary - dashboard numbers
router.get("/summary", async (req, res) => {
  const schoolId = req.schoolId;
  await syncPayroll(schoolId); // make sure newly completed months show as pending salary
  const [school, students, activeStaff, rawAccounts, receipts, expenses, payrolls, salaryPayments] = await Promise.all([
    School.findOne({ schoolId }).lean(),
    Student.find({ schoolId }).select("studentId admissionNo fullName class parentPhone").lean(),
    Staff.countDocuments({ schoolId, status: "active" }),
    FeeAccount.find({ schoolId }).lean(),
    Receipt.find({ schoolId, status: "valid" }).lean(),
    Expense.find({ schoolId }).select("amount date").lean(),
    Payroll.find({ schoolId }).select("status netSalary paidAmount").lean(),
    // Every salary payment (full or part) is one cash book line
    LedgerEntry.find({ schoolId, referenceType: "salary_payout", type: "debit" }).select("amount date").lean(),
  ]);

  const accounts = rawAccounts.map(describe);
  const totalFeeExpected = sum(accounts, (a) => a.totalFee);
  const totalFeeCollected = sum(receipts, (r) => r.paidAmount);
  const totalOperationalExpenses = sum(expenses, (e) => e.amount);
  const totalSalaryPaid = sum(salaryPayments, (p) => p.amount);
  const totalExpenditure = round2(totalOperationalExpenses + totalSalaryPaid);

  // Real month-by-month figures (money in = fees, money out = expenses + salaries paid)
  const monthlyTrends = lastSixMonths().map(({ key, label }) => {
    const income = sum(receipts.filter((r) => r.paymentDate.startsWith(key)), (r) => r.paidAmount);
    const expense = round2(
      sum(expenses.filter((e) => e.date.startsWith(key)), (e) => e.amount) +
        sum(salaryPayments.filter((p) => (p.date || "").startsWith(key)), (p) => p.amount)
    );
    return { month: label, income, expense, net: round2(income - expense) };
  });

  const accountOf = new Map(accounts.map((a) => [a.studentId, a]));
  const pendingStudents = students
    .map((s) => {
      const a = accountOf.get(s.studentId);
      return {
        studentId: s.studentId,
        admissionNo: s.admissionNo,
        fullName: s.fullName,
        class: s.class,
        parentPhone: s.parentPhone,
        pendingAmount: a ? a.pendingAmount : 0,
        status: a ? a.status : "unpaid",
      };
    })
    .filter((s) => s.pendingAmount > 0)
    .sort((a, b) => b.pendingAmount - a.pendingAmount)
    .slice(0, 5);

  res.json({
    success: true,
    school: plain(school),
    kpis: {
      totalStudents: students.length,
      activeStaff,
      totalFeeExpected,
      totalFeeCollected,
      totalPendingFee: sum(accounts, (a) => a.pendingAmount),
      totalOverdueFee: sum(accounts, (a) => a.overdueAmount),
      collectionEfficiency: totalFeeExpected > 0 ? Math.round((totalFeeCollected / totalFeeExpected) * 100) : 0,
      totalOperationalExpenses,
      totalSalaryPaid,
      totalSalaryPending: sum(payrolls, dueOf),
      totalExpenditure,
      netSurplus: round2(totalFeeCollected - totalExpenditure),
    },
    monthlyTrends,
    recentReceipts: plain([...receipts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)),
    pendingStudents,
  });
});

// GET /api/reports/fee-collections
router.get("/fee-collections", async (req, res) => {
  const filter = { schoolId: req.schoolId, status: "valid" };
  const range = {};
  if (isDate(req.query.startDate)) range.$gte = req.query.startDate;
  if (isDate(req.query.endDate)) range.$lte = req.query.endDate;
  if (Object.keys(range).length) filter.paymentDate = mongoose.trusted(range);
  if (PAYMENT_METHODS.includes(req.query.method)) filter.paymentMethod = req.query.method;

  const receipts = await Receipt.find(filter).sort({ paymentDate: -1 }).lean();
  const byMethod = {};
  for (const r of receipts) byMethod[r.paymentMethod] = round2((byMethod[r.paymentMethod] || 0) + r.paidAmount);

  res.json({
    success: true,
    receipts: plain(receipts),
    summary: {
      count: receipts.length,
      totalCollected: sum(receipts, (r) => r.paidAmount),
      totalDiscounts: sum(receipts, (r) => r.discount),
      byMethod,
    },
  });
});

// GET /api/reports/pending-fees
router.get("/pending-fees", async (req, res) => {
  const schoolId = req.schoolId;
  const [students, rawAccounts] = await Promise.all([
    Student.find({ schoolId }).lean(),
    FeeAccount.find({ schoolId, pendingAmount: mongoose.trusted({ $gt: 0 }) }).lean(),
  ]);
  const studentOf = new Map(students.map((s) => [s.studentId, s]));

  let records = rawAccounts.map((raw) => {
    const a = describe(raw);
    const s = studentOf.get(a.studentId) || {};
    return {
      studentId: a.studentId,
      fullName: s.fullName || "Unknown",
      admissionNo: s.admissionNo || "",
      class: s.class || "",
      parentName: s.parentName || "",
      parentPhone: s.parentPhone || "",
      parentEmail: s.parentEmail || "",
      totalFee: a.totalFee,
      paidAmount: a.paidAmount,
      pendingAmount: a.pendingAmount,
      overdueAmount: a.overdueAmount,
      status: a.status,
      lastPaymentDate: a.lastPaymentDate || "Never",
    };
  });

  const className = str(req.query.className, 40);
  if (className && className !== "all") records = records.filter((r) => r.class === className);
  if (["partial", "unpaid", "overdue"].includes(req.query.status)) records = records.filter((r) => r.status === req.query.status);
  records.sort((a, b) => b.pendingAmount - a.pendingAmount);

  res.json({
    success: true,
    records,
    summary: {
      count: records.length,
      totalPending: sum(records, (r) => r.pendingAmount),
      totalOverdue: sum(records, (r) => r.overdueAmount),
    },
  });
});

// GET /api/reports/income-vs-expense?year=2026 - income statement for one calendar year
router.get("/income-vs-expense", async (req, res) => {
  const schoolId = req.schoolId;
  const year = Number(req.query.year) > 2000 ? Number(req.query.year) : new Date().getFullYear();
  const inYear = () => mongoose.trusted({ $gte: `${year}-01-01`, $lte: `${year}-12-31` });

  const [receipts, expenses, salaries] = await Promise.all([
    Receipt.find({ schoolId, status: "valid", paymentDate: inYear() }).select("paidAmount").lean(),
    Expense.find({ schoolId, date: inYear() }).select("amount category").lean(),
    LedgerEntry.find({ schoolId, referenceType: "salary_payout", type: "debit", date: inYear() }).select("amount").lean(),
  ]);

  const feeIncome = sum(receipts, (r) => r.paidAmount);
  const generalExpenses = sum(expenses, (e) => e.amount);
  const salaryExpenses = sum(salaries, (p) => p.amount);
  const totalExpenses = round2(generalExpenses + salaryExpenses);
  const net = round2(feeIncome - totalExpenses);

  const breakdown = { "Staff Salaries": salaryExpenses };
  for (const e of expenses) breakdown[e.category] = round2((breakdown[e.category] || 0) + e.amount);

  res.json({
    success: true,
    statement: {
      fiscalYear: year,
      income: { feeCollections: feeIncome, totalIncome: feeIncome },
      expenses: { salaryExpenses, generalExpenses, totalExpenses, breakdown },
      netOperatingIncome: net,
      profitMargin: feeIncome > 0 ? Math.round((net / feeIncome) * 100) : 0,
    },
  });
});

module.exports = router;
