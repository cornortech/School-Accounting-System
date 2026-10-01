const express = require("express");
const mongoose = require("mongoose");
const Staff = require("../models/Staff");
const Payroll = require("../models/Payroll");
const { allowRoles } = require("../middleware/auth");
const { nextNumber, pad } = require("../utils/counter");
const { toAmount, round2, sum } = require("../utils/money");
const { str, email, escapeRegex, plain, fail, dateOr, isDate } = require("../utils/helpers");
const AttendanceDevice = require("../models/AttendanceDevice");
const { linkUnmatchedLogs } = require("../services/attendanceService");

const router = express.Router();
const ROLE_TYPES = ["teaching", "non_teaching"];
const STATUSES = ["active", "on_leave", "terminated"];

const netOf = (s) => round2(Math.max(0, s.baseSalary + s.allowances - s.deductions));

// Checks the fingerprint fields. Returns an error message, or null when everything is fine.
async function checkFingerprintFields(schoolId, b, currentStaffId) {
  if (b.deviceUserId !== undefined && b.deviceUserId !== "") {
    const id = String(b.deviceUserId).trim();
    if (!/^[A-Za-z0-9]{1,20}$/.test(id)) return "Device User ID can only have letters and numbers (for example 101).";
    const filter = { schoolId, deviceUserId: id };
    if (currentStaffId) filter.staffId = mongoose.trusted({ $ne: currentStaffId });
    const other = await Staff.findOne(filter).select("fullName").lean();
    if (other) return `Device User ID ${id} is already used by ${other.fullName}.`;
  }
  if (b.fingerprintDeviceId && !(await AttendanceDevice.exists({ schoolId, deviceId: String(b.fingerprintDeviceId) }))) {
    return "The selected fingerprint device was not found.";
  }
  return null;
}

// Attach scans that arrived before this person was linked. Never stops the staff save.
async function linkScansSafely(schoolId, staff) {
  try {
    return await linkUnmatchedLogs(schoolId, staff);
  } catch (err) {
    console.error("[attendance] linking earlier scans failed:", err.message);
    return 0;
  }
}

// GET /api/staff
router.get("/", async (req, res) => {
  const schoolId = req.schoolId;
  const filter = { schoolId };
  const search = str(req.query.search, 80);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ fullName: rx }, { staffId: rx }, { email: rx }, { designation: rx }, { teachingSubject: rx }, { nonTeachingRole: rx }];
  }
  if (ROLE_TYPES.includes(req.query.roleType)) filter.roleType = req.query.roleType;
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const department = str(req.query.department, 60);
  if (department && department !== "all") filter.department = department;

  const [staff, everyone] = await Promise.all([
    Staff.find(filter).sort({ fullName: 1 }).lean(),
    Staff.find({ schoolId }).select("roleType status netSalary").lean(),
  ]);

  res.json({
    success: true,
    staff: plain(staff),
    meta: {
      total: everyone.length,
      teachingCount: everyone.filter((s) => s.roleType === "teaching").length,
      nonTeachingCount: everyone.filter((s) => s.roleType === "non_teaching").length,
      monthlyPayrollCommitment: sum(everyone.filter((s) => s.status === "active"), (s) => s.netSalary),
    },
  });
});

function readSalary(b, current = {}) {
  const baseSalary = b.baseSalary !== undefined ? toAmount(b.baseSalary, { allowZero: true }) : current.baseSalary;
  const allowances = b.allowances !== undefined ? toAmount(b.allowances || 0, { allowZero: true }) : current.allowances ?? 0;
  const deductions = b.deductions !== undefined ? toAmount(b.deductions || 0, { allowZero: true }) : current.deductions ?? 0;
  if (baseSalary === null || baseSalary === undefined || allowances === null || deductions === null) return null;
  return { baseSalary, allowances, deductions };
}

// POST /api/staff
router.post("/", allowRoles("super_admin", "school_admin"), async (req, res) => {
  const schoolId = req.schoolId;
  const b = req.body || {};
  const fullName = str(b.fullName, 100);
  const designation = str(b.designation, 80);
  const salary = readSalary(b);
  if (!fullName || !ROLE_TYPES.includes(b.roleType) || !designation || !salary) {
    return fail(res, 400, "Full name, role type, designation and base salary are required.");
  }

  const fpProblem = await checkFingerprintFields(schoolId, b);
  if (fpProblem) return fail(res, 400, fpProblem);

  const teaching = b.roleType === "teaching";
  const n = await nextNumber(`${schoolId}:staff`);
  const staff = await Staff.create({
    schoolId,
    staffId: `STF-${pad(n, 3)}`,
    fullName,
    email: email(b.email),
    phone: str(b.phone, 30),
    address: str(b.address),
    roleType: b.roleType,
    designation,
    department: str(b.department, 60) || (teaching ? "Academics" : "Administration"),
    teachingSubject: teaching ? str(b.teachingSubject, 60) : undefined,
    nonTeachingRole: teaching ? undefined : str(b.nonTeachingRole, 60),
    joiningDate: dateOr(b.joiningDate),
    salaryStartDate: isDate(b.salaryStartDate) ? b.salaryStartDate : dateOr(b.joiningDate),
    ...salary,
    netSalary: netOf(salary),
    deviceUserId: str(b.deviceUserId, 20),
    fingerprintDeviceId: str(b.fingerprintDeviceId, 40),
  });

  const linked = await linkScansSafely(schoolId, staff);
  res.status(201).json({
    success: true,
    message: `${fullName} added (${staff.staffId}).${linked ? ` ${linked} earlier fingerprint scan(s) linked.` : ""}`,
    staff: plain(staff),
  });
});

// PUT /api/staff/:staffId
router.put("/:staffId", allowRoles("super_admin", "school_admin"), async (req, res) => {
  const staff = await Staff.findOne({ schoolId: req.schoolId, staffId: str(req.params.staffId, 40) });
  if (!staff) return fail(res, 404, "Staff member not found.");

  const b = req.body || {};
  for (const [key, max] of [["fullName", 100], ["phone", 30], ["address", 200], ["designation", 80], ["department", 60], ["teachingSubject", 60], ["nonTeachingRole", 60]]) {
    if (typeof b[key] === "string" && b[key].trim()) staff[key] = str(b[key], max);
  }
  if (typeof b.email === "string") staff.email = email(b.email);
  if (ROLE_TYPES.includes(b.roleType)) staff.roleType = b.roleType;
  if (STATUSES.includes(b.status)) staff.status = b.status;
  if (isDate(b.joiningDate)) staff.joiningDate = b.joiningDate;
  if (isDate(b.salaryStartDate)) staff.salaryStartDate = b.salaryStartDate;

  const salary = readSalary(b, staff);
  if (!salary) return fail(res, 400, "Salary amounts must be valid numbers.");
  Object.assign(staff, salary, { netSalary: netOf(salary) });

  const fpProblem = await checkFingerprintFields(req.schoolId, b, staff.staffId);
  if (fpProblem) return fail(res, 400, fpProblem);
  if (typeof b.deviceUserId === "string") staff.deviceUserId = str(b.deviceUserId, 20);
  if (typeof b.fingerprintDeviceId === "string") staff.fingerprintDeviceId = str(b.fingerprintDeviceId, 40);

  await staff.save();
  const linked = await linkScansSafely(req.schoolId, staff);
  res.json({
    success: true,
    message: `${staff.fullName} updated.${linked ? ` ${linked} earlier fingerprint scan(s) linked.` : ""}`,
    staff: plain(staff),
  });
});

// DELETE /api/staff/:staffId
router.delete("/:staffId", allowRoles("super_admin", "school_admin"), async (req, res) => {
  const schoolId = req.schoolId;
  const staff = await Staff.findOne({ schoolId, staffId: str(req.params.staffId, 40) });
  if (!staff) return fail(res, 404, "Staff member not found.");

  if (await Payroll.exists({ schoolId, staffId: staff.staffId, status: mongoose.trusted({ $in: ["paid", "partial"] }) })) {
    return fail(res, 400, `${staff.fullName} has paid salary records and can't be deleted. Set the status to Terminated instead.`);
  }
  await Payroll.deleteMany({ schoolId, staffId: staff.staffId, status: "pending" });
  await staff.deleteOne();
  res.json({ success: true, message: `${staff.fullName} removed.` });
});

module.exports = router;