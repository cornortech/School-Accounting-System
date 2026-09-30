const express = require("express");
const mongoose = require("mongoose");
const Payroll = require("../models/Payroll");
const Staff = require("../models/Staff");
const School = require("../models/School");
const { allowRoles } = require("../middleware/auth");
const { nextNumber, pad } = require("../utils/counter");
const { inTransaction } = require("../utils/transaction");
const { postEntry } = require("../utils/ledger");
const { toAmount, round2, sum } = require("../utils/money");
const { str, escapeRegex, plain, fail, dateOr, isDate, today } = require("../utils/helpers");
const { MONTHS, syncPayroll, paidOf, dueOf, sortKey } = require("../utils/payroll");
const { PAYMENT_METHODS } = require("../models/Receipt");

const router = express.Router();
const STATUSES = ["pending", "partial", "paid"];

// Adds paidAmount / dueAmount so the page never has to calculate them
const withAmounts = (p) => ({ ...plain(p), paidAmount: paidOf(p), dueAmount: dueOf(p) });

// GET /api/salary
// Creates payslips for newly completed months, then returns:
//  - dues: every staff member who is owed salary, with the months owed (not affected by filters)
//  - payrolls: payslip history (filtered by month / year / status / search)
router.get("/", async (req, res) => {
  const schoolId = req.schoolId;
  await syncPayroll(schoolId);

  const filter = { schoolId };
  const month = MONTHS.find((m) => m.toLowerCase() === String(req.query.month || "").toLowerCase());
  if (month) filter.month = month;
  if (Number(req.query.year) > 2000) filter.year = Number(req.query.year);
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.status === "unpaid") filter.status = mongoose.trusted({ $in: ["pending", "partial"] });
  const search = str(req.query.search, 80);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ staffName: rx }, { staffId: rx }, { payrollId: rx }];
  }

  const [records, unpaid] = await Promise.all([
    Payroll.find(filter).sort({ year: -1, createdAt: -1 }).lean(),
    Payroll.find({ schoolId, status: mongoose.trusted({ $in: ["pending", "partial"] }) }).lean(),
  ]);

  // Group what is owed by staff member, oldest month first
  const byStaff = new Map();
  for (const p of unpaid.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))) {
    if (!byStaff.has(p.staffId)) {
      byStaff.set(p.staffId, { staffId: p.staffId, staffName: p.staffName, designation: p.designation, totalDue: 0, months: [] });
    }
    const row = byStaff.get(p.staffId);
    row.months.push(withAmounts(p));
    row.totalDue = round2(row.totalDue + dueOf(p));
  }
  const dues = [...byStaff.values()].sort((a, b) => a.staffName.localeCompare(b.staffName));

  res.json({
    success: true,
    payrolls: records.map(withAmounts),
    dues,
    analytics: {
      totalRecords: records.length,
      paidCount: records.filter((r) => r.status === "paid").length,
      pendingCount: records.filter((r) => r.status !== "paid").length,
      totalPaid: sum(records, paidOf),
      totalPending: sum(records, dueOf),
      totalDueNow: sum(dues, (d) => d.totalDue),
      staffWithDues: dues.length,
    },
  });
});

// POST /api/salary/pay
// { staffId, payrollIds: [...], amount, paymentMethod, paymentDate, remarks }
// Pays the chosen months, oldest first. The amount can be less than the total (part payment).
router.post("/pay", allowRoles("super_admin", "school_admin", "accountant"), async (req, res) => {
  const schoolId = req.schoolId;
  const b = req.body || {};
  const staffId = str(b.staffId, 40);
  const ids = (Array.isArray(b.payrollIds) ? b.payrollIds : []).map((x) => str(x, 40)).filter(Boolean).slice(0, 60);
  const amount = toAmount(b.amount);
  const method = PAYMENT_METHODS.includes(b.paymentMethod) ? b.paymentMethod : "Cash";

  if (!staffId || ids.length === 0) return fail(res, 400, "Select at least one month to pay.");
  if (amount === null) return fail(res, 400, "Enter an amount greater than 0.");
  if (b.paymentDate && !isDate(b.paymentDate)) return fail(res, 400, "Payment date is not valid.");
  if (b.paymentDate > today()) return fail(res, 400, "Payment date can't be in the future.");
  const paymentDate = dateOr(b.paymentDate);
  const remarks = str(b.remarks, 200);

  try {
    const result = await inTransaction(async (session) => {
      const items = await Payroll.find({
        schoolId,
        staffId,
        payrollId: mongoose.trusted({ $in: ids }),
        status: mongoose.trusted({ $in: ["pending", "partial"] }),
      })
        .session(session)
        .lean();
      if (items.length !== ids.length) {
        throw Object.assign(new Error("Some of these months are already paid. Please refresh the page."), { userMessage: true });
      }
      items.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

      const totalDue = sum(items, dueOf);
      if (amount > totalDue) {
        throw Object.assign(new Error(`You can pay at most ${totalDue} for the selected months.`), { userMessage: true });
      }

      const year = Number(paymentDate.slice(0, 4));
      const voucherNo = `SAL-${year}-${pad(await nextNumber(`${schoolId}:salarypay:${year}`, session), 4)}`;

      // Share the amount out, oldest month first
      let left = amount;
      const lines = [];
      for (const p of items) {
        if (left <= 0) break;
        const before = paidOf(p);
        const part = round2(Math.min(left, dueOf(p)));
        const after = round2(before + part);
        const status = after >= p.netSalary ? "paid" : "partial";
        left = round2(left - part);

        // Only save if nobody else paid this month in the meantime
        const saved = await Payroll.findOneAndUpdate(
          {
            _id: p._id,
            status: p.status,
            paidAmount: p.paidAmount ? p.paidAmount : mongoose.trusted({ $in: [0, null] }),
          },
          {
            $set: { paidAmount: after, status, paymentDate, paymentMethod: method, remarks },
            $push: { payments: { voucherNo, amount: part, date: paymentDate, method, remarks, by: req.user.name } },
          },
          { new: true, session }
        );
        if (!saved) {
          throw Object.assign(new Error("This salary was just updated by someone else. Please refresh and try again."), { userMessage: true });
        }
        lines.push(`${p.month} ${p.year}${status === "partial" ? " (part)" : ""}`);
      }

      const first = items[0];
      await postEntry(
        {
          schoolId,
          transactionId: `TXN-${voucherNo}`,
          type: "debit",
          category: "Staff Salary",
          amount,
          referenceType: "salary_payout",
          referenceId: voucherNo,
          description: `Salary - ${first.staffName} (${first.designation}): ${lines.join(", ")}`,
          date: paymentDate,
          recordedBy: req.user.name,
        },
        session
      );

      return { voucherNo, staffName: first.staffName, stillDue: round2(totalDue - amount) };
    });

    res.json({
      success: true,
      message: `Paid ${amount} to ${result.staffName} (voucher ${result.voucherNo}).${result.stillDue > 0 ? ` ${result.stillDue} is still pending.` : ""}`,
      ...result,
    });
  } catch (err) {
    if (err.userMessage) return fail(res, 409, err.message);
    throw err;
  }
});

// GET /api/salary/:payrollId/payslip
router.get("/:payrollId/payslip", async (req, res) => {
  const schoolId = req.schoolId;
  const payroll = await Payroll.findOne({ schoolId, payrollId: str(req.params.payrollId, 40) }).lean();
  if (!payroll) return fail(res, 404, "Payroll record not found.");

  const [staff, school] = await Promise.all([
    Staff.findOne({ schoolId, staffId: payroll.staffId }).lean(),
    School.findOne({ schoolId }).lean(),
  ]);
  res.json({ success: true, payroll: withAmounts(payroll), staff: plain(staff), school: plain(school) });
});

module.exports = router;