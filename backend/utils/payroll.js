const mongoose = require("mongoose");
const Payroll = require("../models/Payroll");
const Staff = require("../models/Staff");
const { nextNumber, pad } = require("./counter");
const { round2 } = require("./money");
const { isDate, today } = require("./helpers");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MAX_BACKLOG = 24; // never create more than 2 years of old payslips at once

// ---- small date helpers ("YYYY-MM-DD" strings, no time zones) ----
const parts = (d) => d.split("-").map(Number);
const fmt = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// Same day k months later (31 Jan + 1 month = 28/29 Feb)
function addMonths(date, k) {
  const [y, m, d] = parts(date);
  const total = m - 1 + k;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  return fmt(ny, nm, Math.min(d, daysIn(ny, nm)));
}

function dayBefore(date) {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

// Salary counting starts from "salaryStartDate". For staff added before that field existed,
// use the later of their joining date and the day they were added to the system.
function salaryStart(staff) {
  if (isDate(staff.salaryStartDate)) return staff.salaryStartDate;
  const added = staff.createdAt ? new Date(staff.createdAt).toISOString().slice(0, 10) : today();
  const joined = isDate(staff.joiningDate) ? staff.joiningDate : added;
  return joined > added ? joined : added;
}

// Old payslips (made before part-payments existed) have no paidAmount.
const paidOf = (p) => (p.status === "paid" && !p.paidAmount ? p.netSalary : p.paidAmount || 0);
const dueOf = (p) => round2(Math.max(0, p.netSalary - paidOf(p)));

// Oldest first. Old payslips have no periodStart, so use their month and year.
const sortKey = (p) => p.periodStart || `${p.year}-${String(MONTHS.indexOf(p.month) + 1).padStart(2, "0")}-01`;

// Creates a payslip for every month of work that is COMPLETED and has no payslip yet.
// Runs automatically whenever the salary page or dashboard is opened.
async function syncPayroll(schoolId) {
  const now = today();
  const staffList = await Staff.find({ schoolId, status: "active" }).lean();
  if (!staffList.length) return 0;

  const existing = await Payroll.find({ schoolId, staffId: mongoose.trusted({ $in: staffList.map((s) => s.staffId) }) })
    .select("staffId month year")
    .lean();
  const has = new Set(existing.map((p) => `${p.staffId}|${p.month}|${p.year}`));

  let created = 0;
  for (const s of staffList) {
    const start = salaryStart(s);
    let made = 0;
    for (let k = 0; made < MAX_BACKLOG; k++) {
      const periodStart = addMonths(start, k);
      const dueDate = addMonths(start, k + 1);
      if (dueDate > now) break; // this month of work is not finished yet

      const [y, m] = parts(periodStart);
      const month = MONTHS[m - 1];
      if (has.has(`${s.staffId}|${month}|${y}`)) continue;

      const n = await nextNumber(`${schoolId}:payroll:${y}`);
      try {
        await Payroll.create({
          schoolId,
          payrollId: `PAY-${y}-${month.slice(0, 3).toUpperCase()}-${pad(n, 3)}`,
          staffId: s.staffId,
          staffName: s.fullName,
          designation: s.designation,
          month,
          year: y,
          periodStart,
          periodEnd: dayBefore(dueDate),
          dueDate,
          baseSalary: s.baseSalary,
          allowances: s.allowances,
          deductions: s.deductions,
          netSalary: s.netSalary,
        });
        created++;
        made++;
      } catch (err) {
        if (err.code !== 11000) throw err; // created at the same moment by another request - fine
      }
      has.add(`${s.staffId}|${month}|${y}`);
    }
  }
  return created;
}

module.exports = { MONTHS, syncPayroll, paidOf, dueOf, sortKey, addMonths, dayBefore, salaryStart };