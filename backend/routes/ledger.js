const express = require("express");
const LedgerEntry = require("../models/LedgerEntry");
const { allowRoles } = require("../middleware/auth");
const { nextNumber, pad } = require("../utils/counter");
const { postEntry } = require("../utils/ledger");
const { toAmount, round2 } = require("../utils/money");
const { str, escapeRegex, plain, fail, dateOr, isDate, today } = require("../utils/helpers");

const router = express.Router();
const REF_TYPES = ["fee_payment", "salary_payout", "expense", "manual"];

// GET /api/ledger - running balance is calculated here, oldest to newest
router.get("/", async (req, res) => {
  const entries = await LedgerEntry.find({ schoolId: req.schoolId }).sort({ date: 1, createdAt: 1 }).lean();

  let running = 0;
  let credits = 0;
  let debits = 0;
  const withBalance = entries.map((e) => {
    if (e.type === "credit") {
      running += e.amount;
      credits += e.amount;
    } else {
      running -= e.amount;
      debits += e.amount;
    }
    return { ...plain(e), runningBalance: round2(running) };
  });

  let view = withBalance.reverse(); // newest first on screen
  if (req.query.type === "credit" || req.query.type === "debit") view = view.filter((t) => t.type === req.query.type);
  if (REF_TYPES.includes(req.query.referenceType)) view = view.filter((t) => t.referenceType === req.query.referenceType);
  if (isDate(req.query.startDate)) view = view.filter((t) => t.date >= req.query.startDate);
  if (isDate(req.query.endDate)) view = view.filter((t) => t.date <= req.query.endDate);
  const search = str(req.query.search, 80);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    view = view.filter((t) => rx.test(t.description) || rx.test(t.transactionId) || rx.test(t.category) || rx.test(t.referenceId));
  }

  res.json({
    success: true,
    transactions: view,
    summary: {
      totalCredits: round2(credits),
      totalDebits: round2(debits),
      currentBalance: round2(credits - debits),
      transactionCount: entries.length,
    },
  });
});

// POST /api/ledger/journal-entry - manual adjustment (opening balance, bank charges, donations...)
router.post("/journal-entry", allowRoles("super_admin", "school_admin", "accountant"), async (req, res) => {
  const schoolId = req.schoolId;
  const b = req.body || {};
  const amount = toAmount(b.amount);
  const category = str(b.category, 80);
  const description = str(b.description, 300);

  if ((b.type !== "credit" && b.type !== "debit") || !category || amount === null || !description) {
    return fail(res, 400, "Type (credit/debit), category, amount and description are required.");
  }
  if (b.date && (!isDate(b.date) || b.date > today())) return fail(res, 400, "Date is not valid.");

  const n = await nextNumber(`${schoolId}:journal`);
  const transactionId = `TXN-JRN-${pad(n, 4)}`;
  const entry = await postEntry({
    schoolId,
    transactionId,
    type: b.type,
    category,
    amount,
    referenceType: "manual",
    referenceId: transactionId,
    description,
    date: dateOr(b.date),
    recordedBy: req.user.name,
  });

  res.status(201).json({ success: true, message: `Journal entry ${transactionId} saved.`, transaction: plain(entry) });
});

module.exports = router;
