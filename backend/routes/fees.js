const express = require("express");
const mongoose = require("mongoose");
const FeeStructure = require("../models/FeeStructure");
const FeeAccount = require("../models/FeeAccount");
const Student = require("../models/Student");
const { allowRoles } = require("../middleware/auth");
const { nextNumber, pad } = require("../utils/counter");
const { describe, updateAccount } = require("../utils/fees");
const { inTransaction } = require("../utils/transaction");
const { toAmount, sum, round2 } = require("../utils/money");
const { str, escapeRegex, pick, plain, fail, isDate, today } = require("../utils/helpers");
const { CATEGORIES } = FeeStructure;

const router = express.Router();
const FREQUENCIES = ["Monthly", "Termly", "Annually", "One-Time"];
const ACCOUNT_STATUSES = ["paid", "partial", "unpaid", "overdue"];

async function findStructure(schoolId, id) {
  const key = str(id, 40);
  const or = [{ feeId: key }];
  if (mongoose.isValidObjectId(key)) or.push({ _id: key });
  return FeeStructure.findOne({ schoolId, $or: or });
}

// GET /api/fees
router.get("/", async (req, res) => {
  const schoolId = req.schoolId;
  const [structures, rawAccounts] = await Promise.all([
    FeeStructure.find({ schoolId }).sort({ class: 1, category: 1 }).lean(),
    FeeAccount.find({ schoolId }).lean(),
  ]);
  const accounts = rawAccounts.map(describe);

  const totalExpected = sum(accounts, (a) => a.totalFee);
  const totalPaid = sum(accounts, (a) => a.paidAmount);
  const breakdown = Object.fromEntries(ACCOUNT_STATUSES.map((s) => [s, accounts.filter((a) => a.status === s).length]));

  res.json({
    success: true,
    structures: plain(structures),
    analytics: {
      totalExpected,
      totalPaid,
      totalDiscount: sum(accounts, (a) => a.discountAmount),
      totalPending: sum(accounts, (a) => a.pendingAmount),
      totalOverdue: sum(accounts, (a) => a.overdueAmount),
      collectionRate: totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0,
      statusBreakdown: breakdown,
    },
  });
});

// POST /api/fees/structures
router.post("/structures", allowRoles("super_admin", "school_admin", "accountant"), async (req, res) => {
  const schoolId = req.schoolId;
  const b = req.body || {};
  const title = str(b.title, 100);
  const amount = toAmount(b.amount, { allowZero: true });
  if (!title || !CATEGORIES.includes(b.category) || amount === null) {
    return fail(res, 400, "Title, a valid category and amount are required.");
  }

  const prefix = b.category.slice(0, 3).toUpperCase();
  const n = await nextNumber(`${schoolId}:fee:${prefix}`);
  const structure = await FeeStructure.create({
    schoolId,
    feeId: `FEE-${prefix}-${pad(n, 2)}`,
    title,
    category: b.category,
    amount,
    class: str(b.class, 40) || "All",
    frequency: pick(b.frequency, FREQUENCIES, "Monthly"),
    dueDate: isDate(b.dueDate) ? b.dueDate : "",
  });

  // Add the new fee to the pending bill of students who are already enrolled
  const { added } = await applyFeeToStudents(schoolId, structure);

  res.status(201).json({
    success: true,
    message: `"${title}" added and charged to ${added} existing student(s).`,
    structure: plain(structure),
    added,
  });
});

// PUT /api/fees/structures/:id
router.put("/structures/:id", allowRoles("super_admin", "school_admin", "accountant"), async (req, res) => {
  const item = await findStructure(req.schoolId, req.params.id);
  if (!item) return fail(res, 404, "Fee not found.");

  const b = req.body || {};
  if (str(b.title)) item.title = str(b.title, 100);
  if (CATEGORIES.includes(b.category)) item.category = b.category;
  if (b.amount !== undefined) {
    const amount = toAmount(b.amount, { allowZero: true });
    if (amount === null) return fail(res, 400, "Amount must be a valid number.");
    item.amount = amount;
  }
  if (str(b.class)) item.class = str(b.class, 40);
  if (FREQUENCIES.includes(b.frequency)) item.frequency = b.frequency;
  if (b.dueDate !== undefined) item.dueDate = isDate(b.dueDate) ? b.dueDate : "";

  await item.save();
  res.json({ success: true, message: `"${item.title}" updated.`, structure: plain(item) });
});

// DELETE /api/fees/structures/:id
router.delete("/structures/:id", allowRoles("super_admin", "school_admin"), async (req, res) => {
  const item = await findStructure(req.schoolId, req.params.id);
  if (!item) return fail(res, 404, "Fee not found.");
  await item.deleteOne();
  res.json({ success: true, message: `"${item.title}" removed.` });
});

// Adds one fee to every active student of its class who doesn't have it yet.
// Safe to run more than once: a student is never charged the same fee twice.
async function applyFeeToStudents(schoolId, item) {
  const filter = { schoolId, status: "active" };
  // "grade 10" and "Grade 10" count as the same class
  if (item.class !== "All") filter.class = new RegExp(`^${escapeRegex(item.class)}$`, "i");
  const students = await Student.find(filter).select("studentId createdAt").lean();

  let added = 0;
  for (const s of students) {
    const wasAdded = await inTransaction(async (session) => {
      const { result } = await updateAccount(schoolId, s.studentId, (acc) => {
        const list = acc.appliedFees;
        // Older students (before this update) got the fees that existed when they were enrolled
        const alreadyHas = Array.isArray(list) ? list.includes(item.feeId) : s.createdAt >= item.createdAt;
        if (alreadyHas) {
          if (!Array.isArray(list)) acc.appliedFees = [item.feeId];
          return false;
        }
        acc.appliedFees = [...(list || []), item.feeId];
        acc.totalFee = round2((acc.totalFee || 0) + item.amount);
        if (item.dueDate && (!acc.dueDate || item.dueDate < acc.dueDate)) acc.dueDate = item.dueDate;
        return true;
      }, session);
      return result;
    });
    if (wasAdded) added++;
  }
  return { total: students.length, added, skipped: students.length - added };
}

// POST /api/fees/structures/:id/apply  (the "Apply" button - for fees created before this update)
router.post("/structures/:id/apply", allowRoles("super_admin", "school_admin", "accountant"), async (req, res) => {
  const item = await findStructure(req.schoolId, req.params.id);
  if (!item) return fail(res, 404, "Fee not found.");

  const { total, added, skipped } = await applyFeeToStudents(req.schoolId, item);
  res.json({
    success: true,
    added,
    skipped,
    message: total === 0
      ? `No active students found in "${item.class}". Check that the class name matches the students' class.`
      : `"${item.title}" added to ${added} student(s).${skipped ? ` ${skipped} already had it.` : ""}`,
  });
});

// PATCH /api/fees/accounts/:studentId
// Set a student's pending fee by hand (scholarship, correction, mid-year admission...).
// Paid amounts and receipts are never touched; only the total fee changes.
router.patch("/accounts/:studentId", allowRoles("super_admin", "school_admin"), async (req, res) => {
  const schoolId = req.schoolId;
  const studentId = str(req.params.studentId, 40);
  const newPending = toAmount(req.body?.pendingAmount, { allowZero: true });
  const reason = str(req.body?.reason, 200);
  if (newPending === null) return fail(res, 400, "Enter a valid pending amount (0 or more).");
  if (!reason) return fail(res, 400, "Please write a reason for this change.");

  const student = await Student.findOne({ schoolId, studentId }).lean();
  if (!student) return fail(res, 404, "Student not found.");

  const { account, result: oldPending } = await inTransaction((session) =>
    updateAccount(schoolId, studentId, (acc) => {
      const before = round2(acc.pendingAmount || 0);
      acc.totalFee = round2((acc.paidAmount || 0) + (acc.discountAmount || 0) + newPending);
      acc.adjustments.push({ date: today(), by: req.user.name, oldPending: before, newPending, reason });
      return before;
    }, session)
  );

  res.json({
    success: true,
    message: `Pending fee for ${student.fullName} changed from ${oldPending} to ${newPending}.`,
    feeAccount: describe(account),
  });
});

// GET /api/fees/student-balances
router.get("/student-balances", async (req, res) => {
  const schoolId = req.schoolId;
  const filter = { schoolId };
  const search = str(req.query.search, 80);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ fullName: rx }, { admissionNo: rx }, { studentId: rx }];
  }
  const className = str(req.query.className, 40);
  if (className && className !== "all") filter.class = className;

  const [students, accounts] = await Promise.all([
    Student.find(filter).sort({ class: 1, fullName: 1 }).lean(),
    FeeAccount.find({ schoolId }).lean(),
  ]);
  const byStudent = new Map(accounts.map((a) => [a.studentId, a]));

  let records = students.map((s) => ({
    studentId: s.studentId,
    admissionNo: s.admissionNo,
    fullName: s.fullName,
    class: s.class,
    section: s.section,
    parentName: s.parentName,
    parentPhone: s.parentPhone,
    feeAccount: describe(byStudent.get(s.studentId)),
  }));

  const status = str(req.query.status);
  if (ACCOUNT_STATUSES.includes(status)) records = records.filter((r) => r.feeAccount.status === status);

  res.json({ success: true, records, total: records.length });
});

module.exports = router;