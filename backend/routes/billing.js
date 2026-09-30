const express = require("express");
const mongoose = require("mongoose");
const Receipt = require("../models/Receipt");
const Student = require("../models/Student");
const FeeAccount = require("../models/FeeAccount");
const School = require("../models/School");
const { allowRoles } = require("../middleware/auth");
const { nextNumber, pad } = require("../utils/counter");
const { inTransaction } = require("../utils/transaction");
const { postEntry } = require("../utils/ledger");
const { describe, updateAccount } = require("../utils/fees");
const { toAmount, round2, sum } = require("../utils/money");
const { str, escapeRegex, plain, fail, dateOr, isDate, today } = require("../utils/helpers");
const { PAYMENT_METHODS } = Receipt;

const router = express.Router();

const receiptQuery = (schoolId, key) => ({ schoolId, receiptNumber: str(key, 40) });

// GET /api/billing/receipts
router.get("/receipts", async (req, res) => {
  const filter = { schoolId: req.schoolId };
  const search = str(req.query.search, 80);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ receiptNumber: rx }, { studentName: rx }, { admissionNo: rx }, { transactionRef: rx }];
  }
  if (PAYMENT_METHODS.includes(req.query.paymentMethod)) filter.paymentMethod = req.query.paymentMethod;
  if (req.query.status === "valid" || req.query.status === "cancelled") filter.status = req.query.status;

  const range = {};
  if (isDate(req.query.startDate)) range.$gte = req.query.startDate;
  if (isDate(req.query.endDate)) range.$lte = req.query.endDate;
  if (Object.keys(range).length) filter.paymentDate = mongoose.trusted(range);

  const receipts = await Receipt.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
  res.json({
    success: true,
    receipts: plain(receipts),
    meta: {
      count: receipts.length,
      totalCollected: sum(receipts.filter((r) => r.status === "valid"), (r) => r.paidAmount),
    },
  });
});

// GET /api/billing/receipts/:receiptNumber
router.get("/receipts/:receiptNumber", async (req, res) => {
  const schoolId = req.schoolId;
  const receipt = await Receipt.findOne(receiptQuery(schoolId, req.params.receiptNumber)).lean();
  if (!receipt) return fail(res, 404, "Receipt not found.");

  const [school, student, account] = await Promise.all([
    School.findOne({ schoolId }).lean(),
    Student.findOne({ schoolId, studentId: receipt.studentId }).lean(),
    FeeAccount.findOne({ schoolId, studentId: receipt.studentId }).lean(),
  ]);
  res.json({ success: true, receipt: plain(receipt), school: plain(school), student: plain(student), feeAccount: describe(account) });
});

// POST /api/billing/payments
router.post("/payments", allowRoles("super_admin", "school_admin", "accountant", "reception"), async (req, res) => {
  const schoolId = req.schoolId;
  const b = req.body || {};

  const paid = toAmount(b.paidAmount);
  const discount = toAmount(b.discount ?? 0, { allowZero: true });
  if (!str(b.studentId) || paid === null) return fail(res, 400, "Student and a paid amount greater than 0 are required.");
  if (discount === null) return fail(res, 400, "Discount must be a valid number.");
  if (!PAYMENT_METHODS.includes(b.paymentMethod)) return fail(res, 400, "Choose a valid payment method.");
  if (b.paymentDate && !isDate(b.paymentDate)) return fail(res, 400, "Payment date is not valid.");
  if (b.paymentDate > today()) return fail(res, 400, "Payment date can't be in the future.");

  const student = await Student.findOne({ schoolId, studentId: str(b.studentId, 40) }).lean();
  if (!student) return fail(res, 404, "Student not found.");

  const feeItems = (Array.isArray(b.feeItems) ? b.feeItems : [])
    .map((i) => ({ category: str(i?.category, 60), amount: toAmount(i?.amount, { allowZero: true }) }))
    .filter((i) => i.category && i.amount !== null)
    .slice(0, 20);
  const items = feeItems.length ? feeItems : [{ category: "Fee payment", amount: round2(paid + discount) }];

  const paymentDate = dateOr(b.paymentDate);
  const year = Number(paymentDate.slice(0, 4));

  const result = await inTransaction(async (session) => {
    // Paying more than what's pending means new charges (e.g. an exam fee) are being billed now.
    const settled = round2(paid + discount);
    const { account, result: extraCharged } = await updateAccount(schoolId, student.studentId, (acc) => {
      const extra = round2(Math.max(0, settled - (acc.pendingAmount || 0)));
      acc.totalFee = round2((acc.totalFee || 0) + extra);
      acc.paidAmount = round2((acc.paidAmount || 0) + paid);
      acc.discountAmount = round2((acc.discountAmount || 0) + discount);
      acc.lastPaymentDate = paymentDate;
      return extra;
    }, session);

    const n = await nextNumber(`${schoolId}:receipt:${year}`, session);
    const receiptNumber = `RCP-${year}-${pad(n, 4)}`;

    const [receipt] = await Receipt.create(
      [{
        schoolId,
        receiptNumber,
        studentId: student.studentId,
        studentName: student.fullName,
        admissionNo: student.admissionNo,
        class: `${student.class} - ${student.section}`,
        feeItems: items,
        totalAmount: round2(Math.max(sum(items, (i) => i.amount), settled)),
        discount,
        paidAmount: paid,
        balanceRemaining: account.pendingAmount,
        extraCharged,
        paymentMethod: b.paymentMethod,
        transactionRef: str(b.transactionRef, 60),
        paymentDate,
        receivedBy: req.user.name,
        notes: str(b.notes, 300),
      }],
      { session }
    );

    await postEntry(
      {
        schoolId,
        transactionId: `TXN-${receiptNumber}`,
        type: "credit",
        category: "Student Fee Income",
        amount: paid,
        referenceType: "fee_payment",
        referenceId: receiptNumber,
        description: `Fee from ${student.fullName} (${student.admissionNo}, ${student.class}) - ${b.paymentMethod}`,
        date: paymentDate,
        recordedBy: req.user.name,
      },
      session
    );

    return { receipt, account };
  });

  const school = await School.findOne({ schoolId }).lean();
  res.status(201).json({
    success: true,
    message: `Payment saved. Receipt ${result.receipt.receiptNumber}.`,
    receipt: plain(result.receipt),
    feeAccount: describe(result.account),
    school: plain(school),
    student: plain(student),
  });
});

// PATCH /api/billing/receipts/:receiptNumber/cancel
router.patch("/receipts/:receiptNumber/cancel", allowRoles("super_admin", "school_admin"), async (req, res) => {
  const schoolId = req.schoolId;
  const reason = str(req.body?.reason, 200) || "Cancelled by admin";

  const outcome = await inTransaction(async (session) => {
    // Flip valid -> cancelled in one step, so two clicks can never both reverse the money.
    const r = await Receipt.findOneAndUpdate(
      { ...receiptQuery(schoolId, req.params.receiptNumber), status: "valid" },
      { $set: { status: "cancelled", cancelledBy: req.user.name, cancelledAt: new Date() } },
      { new: true, session }
    );
    if (!r) {
      const exists = await Receipt.exists(receiptQuery(schoolId, req.params.receiptNumber)).session(session);
      return { error: exists ? [400, "This receipt is already cancelled."] : [404, "Receipt not found."] };
    }
    r.notes = [r.notes, `CANCELLED: ${reason}`].filter(Boolean).join(" | ");
    await r.save({ session });

    await updateAccount(schoolId, r.studentId, (acc) => {
      acc.paidAmount = round2((acc.paidAmount || 0) - r.paidAmount);
      acc.discountAmount = round2((acc.discountAmount || 0) - r.discount);
      acc.totalFee = round2(Math.max(0, (acc.totalFee || 0) - (r.extraCharged || 0)));
    }, session);

    await postEntry(
      {
        schoolId,
        transactionId: `TXN-REV-${r.receiptNumber}`,
        type: "debit",
        category: "Reversal: Cancelled Receipt",
        amount: r.paidAmount,
        referenceType: "fee_payment",
        referenceId: r.receiptNumber,
        description: `Receipt ${r.receiptNumber} cancelled (${reason})`,
        date: today(),
        recordedBy: req.user.name,
      },
      session
    );
    return { receipt: r };
  });

  if (outcome.error) return fail(res, ...outcome.error);
  const { receipt } = outcome;
  res.json({ success: true, message: `Receipt ${receipt.receiptNumber} cancelled and reversed in the ledger.`, receipt: plain(receipt) });
});

module.exports = router;
