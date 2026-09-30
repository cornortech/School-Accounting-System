const express = require("express");
const mongoose = require("mongoose");
const Expense = require("../models/Expense");
const LedgerEntry = require("../models/LedgerEntry");
const { allowRoles } = require("../middleware/auth");
const { nextNumber, pad } = require("../utils/counter");
const { inTransaction } = require("../utils/transaction");
const { postEntry } = require("../utils/ledger");
const { toAmount, round2 } = require("../utils/money");
const { str, escapeRegex, plain, fail, dateOr, isDate, today } = require("../utils/helpers");
const { EXPENSE_CATEGORIES } = Expense;
const { PAYMENT_METHODS } = require("../models/Receipt");

const router = express.Router();

const findExpense = (schoolId, key, session) => Expense.findOne({ schoolId, expenseId: str(key, 40) }).session(session);

// GET /api/expenses
router.get("/", async (req, res) => {
  const filter = { schoolId: req.schoolId };
  if (EXPENSE_CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  const search = str(req.query.search, 80);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ description: rx }, { vendorOrPerson: rx }, { expenseId: rx }, { receiptRef: rx }];
  }
  const range = {};
  if (isDate(req.query.startDate)) range.$gte = req.query.startDate;
  if (isDate(req.query.endDate)) range.$lte = req.query.endDate;
  if (Number(req.query.year) > 2000) {
    range.$gte = range.$gte || `${req.query.year}-01-01`;
    range.$lte = range.$lte || `${req.query.year}-12-31`;
  }
  if (Object.keys(range).length) filter.date = mongoose.trusted(range);

  const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 }).lean();
  const monthlySummary = {};
  const categorySummary = {};
  let total = 0;
  for (const e of expenses) {
    total += e.amount;
    const month = e.date.slice(0, 7);
    monthlySummary[month] = round2((monthlySummary[month] || 0) + e.amount);
    categorySummary[e.category] = round2((categorySummary[e.category] || 0) + e.amount);
  }

  res.json({
    success: true,
    expenses: plain(expenses),
    meta: { totalCount: expenses.length, totalAmount: round2(total), monthlySummary, categorySummary },
  });
});

function readExpense(b) {
  return {
    category: b.category,
    amount: toAmount(b.amount),
    description: str(b.description, 300),
    vendorOrPerson: str(b.vendorOrPerson, 120),
  };
}

// POST /api/expenses
router.post("/", allowRoles("super_admin", "school_admin", "accountant"), async (req, res) => {
  const schoolId = req.schoolId;
  const b = req.body || {};
  const e = readExpense(b);
  if (!EXPENSE_CATEGORIES.includes(e.category) || e.amount === null || !e.description || !e.vendorOrPerson) {
    return fail(res, 400, "Category, amount, description and paid-to are required.");
  }
  if (b.date && (!isDate(b.date) || b.date > today())) return fail(res, 400, "Expense date is not valid.");

  const date = dateOr(b.date);
  const year = date.slice(0, 4);

  const expense = await inTransaction(async (session) => {
    const n = await nextNumber(`${schoolId}:expense:${year}`, session);
    const [created] = await Expense.create(
      [{
        schoolId,
        expenseId: `EXP-${year}-${pad(n, 4)}`,
        ...e,
        date,
        paymentMethod: PAYMENT_METHODS.includes(b.paymentMethod) ? b.paymentMethod : "Cash",
        receiptRef: str(b.receiptRef, 60),
        recordedBy: req.user.name,
      }],
      { session }
    );
    await postEntry(
      {
        schoolId,
        transactionId: `TXN-${created.expenseId}`,
        type: "debit",
        category: `Expense: ${created.category}`,
        amount: created.amount,
        referenceType: "expense",
        referenceId: created.expenseId,
        description: `${created.description} (paid to ${created.vendorOrPerson})`,
        date,
        recordedBy: req.user.name,
      },
      session
    );
    return created;
  });

  res.status(201).json({ success: true, message: `Expense ${expense.expenseId} saved.`, expense: plain(expense) });
});

// PUT /api/expenses/:expenseId  (the matching ledger line is kept in sync)
router.put("/:expenseId", allowRoles("super_admin", "school_admin", "accountant"), async (req, res) => {
  const schoolId = req.schoolId;
  const b = req.body || {};
  if (b.amount !== undefined && toAmount(b.amount) === null) return fail(res, 400, "Amount must be greater than 0.");
  if (b.date && (!isDate(b.date) || b.date > today())) return fail(res, 400, "Expense date is not valid.");

  const expense = await inTransaction(async (session) => {
    const exp = await findExpense(schoolId, req.params.expenseId, session);
    if (!exp) return null;

    if (EXPENSE_CATEGORIES.includes(b.category)) exp.category = b.category;
    if (b.amount !== undefined) exp.amount = toAmount(b.amount);
    if (b.date) exp.date = b.date;
    if (PAYMENT_METHODS.includes(b.paymentMethod)) exp.paymentMethod = b.paymentMethod;
    if (str(b.description)) exp.description = str(b.description, 300);
    if (str(b.vendorOrPerson)) exp.vendorOrPerson = str(b.vendorOrPerson, 120);
    if (typeof b.receiptRef === "string") exp.receiptRef = str(b.receiptRef, 60);
    await exp.save({ session });

    await LedgerEntry.updateOne(
      { schoolId, referenceType: "expense", referenceId: exp.expenseId, type: "debit" },
      {
        $set: {
          amount: exp.amount,
          date: exp.date,
          category: `Expense: ${exp.category}`,
          description: `${exp.description} (paid to ${exp.vendorOrPerson})`,
        },
      },
      { session }
    );
    return exp;
  });

  if (!expense) return fail(res, 404, "Expense not found.");
  res.json({ success: true, message: `Expense ${expense.expenseId} updated.`, expense: plain(expense) });
});

// DELETE /api/expenses/:expenseId  (a reversal line is added so the cash book keeps its history)
router.delete("/:expenseId", allowRoles("super_admin", "school_admin"), async (req, res) => {
  const schoolId = req.schoolId;
  const removed = await inTransaction(async (session) => {
    const exp = await findExpense(schoolId, req.params.expenseId, session);
    if (!exp) return null;
    await exp.deleteOne({ session });
    await postEntry(
      {
        schoolId,
        transactionId: `TXN-DEL-${exp.expenseId}`,
        type: "credit",
        category: "Reversal: Deleted Expense",
        amount: exp.amount,
        referenceType: "expense",
        referenceId: exp.expenseId,
        description: `Expense ${exp.expenseId} deleted (${exp.description})`,
        date: today(),
        recordedBy: req.user.name,
      },
      session
    );
    return exp;
  });

  if (!removed) return fail(res, 404, "Expense not found.");
  res.json({ success: true, message: `Expense ${removed.expenseId} deleted and reversed in the ledger.` });
});

module.exports = router;
