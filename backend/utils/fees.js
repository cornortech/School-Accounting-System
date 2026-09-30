const { round2 } = require("./money");
const { today } = require("./helpers");

const EMPTY_ACCOUNT = {
  totalFee: 0, paidAmount: 0, discountAmount: 0, pendingAmount: 0, overdueAmount: 0, status: "unpaid",
};

// Recalculate what is still pending after a payment / cancellation.
function recalculate(account) {
  account.totalFee = round2(account.totalFee || 0);
  account.paidAmount = round2(Math.max(0, account.paidAmount || 0));
  account.discountAmount = round2(Math.max(0, account.discountAmount || 0));
  account.pendingAmount = round2(Math.max(0, account.totalFee - account.paidAmount - account.discountAmount));
  return account;
}

// Status is always worked out from the numbers, so it can never be out of date.
// Overdue = something is still pending and the earliest due date has passed.
function describe(account) {
  if (!account) return { ...EMPTY_ACCOUNT };
  const a = typeof account.toObject === "function" ? account.toObject() : { ...account };
  const pending = round2(a.pendingAmount || 0);
  const overdue = pending > 0 && a.dueDate && a.dueDate < today();

  let status = "unpaid";
  if (pending <= 0) status = "paid";
  else if (overdue) status = "overdue";
  else if ((a.paidAmount || 0) > 0 || (a.discountAmount || 0) > 0) status = "partial";

  return {
    id: a._id ? String(a._id) : undefined,
    schoolId: a.schoolId,
    studentId: a.studentId,
    totalFee: round2(a.totalFee || 0),
    paidAmount: round2(a.paidAmount || 0),
    discountAmount: round2(a.discountAmount || 0),
    pendingAmount: pending,
    overdueAmount: overdue ? pending : 0,
    dueDate: a.dueDate || "",
    lastPaymentDate: a.lastPaymentDate,
    status,
  };
}

// Load a student's fee account, change it, save it. If another payment saved the
// same account in the meantime, start again with the fresh numbers.
async function updateAccount(schoolId, studentId, change, session) {
  const FeeAccount = require("../models/FeeAccount");
  for (let attempt = 0; ; attempt++) {
    let account = await FeeAccount.findOne({ schoolId, studentId }).session(session);
    if (!account) account = new FeeAccount({ schoolId, studentId });
    const result = change(account);
    recalculate(account);
    try {
      await account.save({ session });
      return { account, result };
    } catch (err) {
      const conflict = err.name === "VersionError" || (err.code === 11000 && account.isNew);
      if (!conflict || attempt >= 5) throw err;
    }
  }
}

module.exports = { recalculate, describe, updateAccount, EMPTY_ACCOUNT };
