const express = require("express");
const mongoose = require("mongoose");
const School = require("../models/School");
const User = require("../models/User");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const Receipt = require("../models/Receipt");
const Expense = require("../models/Expense");
const { allowRoles } = require("../middleware/auth");
const { hashPassword, passwordProblem } = require("../utils/password");
const { nextNumber } = require("../utils/counter");
const { str, email, escapeRegex, plain, fail } = require("../utils/helpers");
const { sum } = require("../utils/money");

const router = express.Router();
router.use(allowRoles("super_admin"));

const SCHOOL_ROLES = ["school_admin", "accountant", "reception"];
// Schools that are not deleted
const LIVE = () => mongoose.trusted({ $in: ["active", "inactive"] });

async function findLiveSchool(schoolId) {
  return School.findOne({ schoolId: str(schoolId, 40), status: LIVE() });
}

// Total collected per school, in one query
async function collectedBySchool(match = {}) {
  const rows = await Receipt.aggregate([
    { $match: { status: "valid", ...match } },
    { $group: { _id: "$schoolId", total: { $sum: "$paidAmount" } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.total]));
}

// GET /api/schools
router.get("/", async (req, res) => {
  const filter = { status: LIVE() };
  const status = str(req.query.status);
  if (status === "active" || status === "inactive") filter.status = status;

  const search = str(req.query.search, 80);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: rx }, { code: rx }, { schoolId: rx }, { principalName: rx }];
  }

  const [schools, collected, allLive] = await Promise.all([
    School.find(filter).sort({ createdAt: -1 }).lean(),
    collectedBySchool(),
    School.find({ status: LIVE() }).select("status").lean(),
  ]);

  const codes = schools.map((s) => s.schoolId);
  const [students, staff, users] = await Promise.all([
    Student.aggregate([{ $match: { schoolId: { $in: codes }, status: "active" } }, { $group: { _id: "$schoolId", n: { $sum: 1 } } }]),
    Staff.aggregate([{ $match: { schoolId: { $in: codes }, status: "active" } }, { $group: { _id: "$schoolId", n: { $sum: 1 } } }]),
    User.find({ schoolId: mongoose.trusted({ $in: codes }) }).select("schoolId role email").lean(),
  ]);
  const count = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const studentCount = count(students);
  const staffCount = count(staff);

  res.json({
    success: true,
    schools: schools.map((s) => {
      const schoolUsers = users.filter((u) => u.schoolId === s.schoolId);
      return {
        ...plain(s),
        studentCount: studentCount[s.schoolId] || 0,
        staffCount: staffCount[s.schoolId] || 0,
        userCount: schoolUsers.length,
        totalCollected: collected[s.schoolId] || 0,
        adminEmail: schoolUsers.find((u) => u.role === "school_admin")?.email || "",
      };
    }),
    meta: {
      totalSchools: allLive.length,
      activeSchools: allLive.filter((s) => s.status === "active").length,
      inactiveSchools: allLive.filter((s) => s.status === "inactive").length,
      totalStudentsPlatform: await Student.countDocuments({ status: "active" }),
      totalRevenuePlatform: sum(Object.values(collected), (v) => v),
    },
  });
});

// GET /api/schools/:schoolId
router.get("/:schoolId", async (req, res) => {
  const school = await findLiveSchool(req.params.schoolId);
  if (!school) return fail(res, 404, "School not found.");
  const code = school.schoolId;

  const [users, totalStudents, activeStudents, totalStaff, receipts, expenses] = await Promise.all([
    User.find({ schoolId: code }).sort({ createdAt: 1 }).lean(),
    Student.countDocuments({ schoolId: code }),
    Student.countDocuments({ schoolId: code, status: "active" }),
    Staff.countDocuments({ schoolId: code }),
    Receipt.find({ schoolId: code, status: "valid" }).select("paidAmount").lean(),
    Expense.find({ schoolId: code }).select("amount").lean(),
  ]);

  const totalCollected = sum(receipts, (r) => r.paidAmount);
  const totalExpenses = sum(expenses, (e) => e.amount);

  res.json({
    success: true,
    school: plain(school),
    users: users.map((u) => ({
      id: String(u._id), name: u.name, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt,
    })),
    stats: {
      totalStudents, activeStudents, totalStaff, totalCollected, totalExpenses,
      netReserve: totalCollected - totalExpenses,
    },
  });
});

// POST /api/schools  (creates the school + its first admin login)
router.post("/", async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 120);
  const code = str(b.code, 20).toUpperCase();
  const adminEmail = email(b.adminEmail);

  if (!name || !code || !adminEmail || !b.adminPassword) {
    return fail(res, 400, "School name, code, admin email and admin password are required.");
  }
  const problem = passwordProblem(b.adminPassword);
  if (problem) return fail(res, 400, problem);

  if (await School.exists({ code, status: LIVE() })) return fail(res, 400, `School code "${code}" is already in use.`);
  if (await User.exists({ email: adminEmail })) return fail(res, 400, `${adminEmail} is already registered.`);

  const schoolId = `SCH-${1000 + (await nextNumber("school"))}`;
  const school = await School.create({
    schoolId,
    name,
    code,
    email: email(b.email),
    phone: str(b.phone, 40),
    address: str(b.address),
    currency: str(b.currency, 10) || "NPR",
    currencySymbol: str(b.currencySymbol, 5) || "Rs.",
    principalName: str(b.principalName, 100),
    panNo: str(b.panNo, 20),
    establishedYear: Number(b.establishedYear) || undefined,
  });

  let admin;
  try {
    admin = await User.create({
      email: adminEmail,
      passwordHash: await hashPassword(b.adminPassword),
      name: str(b.adminName, 100) || `${name} Admin`,
      role: "school_admin",
      schoolId,
    });
  } catch (err) {
    await School.deleteOne({ _id: school._id }); // don't leave a school without a login
    throw err;
  }

  res.status(201).json({
    success: true,
    message: `${school.name} created (${schoolId}).`,
    school: plain(school),
    adminUser: { id: String(admin._id), email: admin.email, name: admin.name, role: admin.role },
  });
});

// PUT /api/schools/:schoolId
router.put("/:schoolId", async (req, res) => {
  const school = await findLiveSchool(req.params.schoolId);
  if (!school) return fail(res, 404, "School not found.");

  const b = req.body || {};
  if (str(b.code)) {
    const code = str(b.code, 20).toUpperCase();
    if (code !== school.code && (await School.exists({ code, status: LIVE(), _id: mongoose.trusted({ $ne: school._id }) }))) {
      return fail(res, 400, `School code "${code}" is already in use.`);
    }
    school.code = code;
  }
  for (const [key, max] of [["name", 120], ["phone", 40], ["address", 200], ["currency", 10], ["currencySymbol", 5], ["principalName", 100], ["panNo", 20]]) {
    if (typeof b[key] === "string" && b[key].trim()) school[key] = str(b[key], max);
  }
  if (typeof b.email === "string") school.email = email(b.email);
  if (b.establishedYear) school.establishedYear = Number(b.establishedYear) || school.establishedYear;

  await school.save();
  res.json({ success: true, message: "School details saved.", school: plain(school) });
});

// PATCH /api/schools/:schoolId/status
router.patch("/:schoolId/status", async (req, res) => {
  const status = req.body?.status;
  if (status !== "active" && status !== "inactive") return fail(res, 400, 'Status must be "active" or "inactive".');

  const school = await findLiveSchool(req.params.schoolId);
  if (!school) return fail(res, 404, "School not found.");

  school.status = status;
  await school.save();
  res.json({
    success: true,
    message: status === "active" ? `${school.name} activated.` : `${school.name} deactivated. Its users can no longer log in.`,
    school: plain(school),
  });
});

// DELETE /api/schools/:schoolId  (soft delete: records are kept for audit)
router.delete("/:schoolId", async (req, res) => {
  const school = await findLiveSchool(req.params.schoolId);
  if (!school) return fail(res, 404, "School not found.");

  school.status = "deleted";
  await school.save();
  await User.updateMany({ schoolId: school.schoolId }, { $set: { status: "inactive" } });
  res.json({ success: true, message: `${school.name} removed. Its records are kept but nobody can log in.` });
});

// POST /api/schools/:schoolId/users
router.post("/:schoolId/users", async (req, res) => {
  const school = await findLiveSchool(req.params.schoolId);
  if (!school) return fail(res, 404, "School not found.");

  const b = req.body || {};
  const name = str(b.name, 100);
  const mail = email(b.email);
  if (!name || !mail || !b.password || !b.role) return fail(res, 400, "Name, email, password and role are required.");
  if (!SCHOOL_ROLES.includes(b.role)) return fail(res, 400, "Role must be school_admin, accountant or reception.");
  const problem = passwordProblem(b.password);
  if (problem) return fail(res, 400, problem);
  if (await User.exists({ email: mail })) return fail(res, 400, `${mail} is already registered.`);

  const user = await User.create({
    name, email: mail, role: b.role, schoolId: school.schoolId, passwordHash: await hashPassword(b.password),
  });
  res.status(201).json({
    success: true,
    message: `${user.name} can now log in to ${school.name}.`,
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role, status: user.status },
  });
});

// PATCH /api/schools/:schoolId/users/:userId/reset-password
router.patch("/:schoolId/users/:userId/reset-password", async (req, res) => {
  const problem = passwordProblem(req.body?.newPassword);
  if (problem) return fail(res, 400, problem);
  if (!mongoose.isValidObjectId(req.params.userId)) return fail(res, 404, "User not found.");

  const user = await User.findOne({ _id: req.params.userId, schoolId: str(req.params.schoolId, 40) });
  if (!user) return fail(res, 404, "User not found for this school.");

  user.passwordHash = await hashPassword(req.body.newPassword);
  await user.save();
  res.json({ success: true, message: `Password reset for ${user.name}.` });
});

// PATCH /api/schools/:schoolId/users/:userId/status  (activate / deactivate a login)
router.patch("/:schoolId/users/:userId/status", async (req, res) => {
  const status = req.body?.status;
  if (status !== "active" && status !== "inactive") return fail(res, 400, 'Status must be "active" or "inactive".');
  if (!mongoose.isValidObjectId(req.params.userId)) return fail(res, 404, "User not found.");

  const user = await User.findOne({ _id: req.params.userId, schoolId: str(req.params.schoolId, 40) });
  if (!user) return fail(res, 404, "User not found for this school.");

  // Never lock a school out completely: keep at least one active school admin.
  if (status === "inactive" && user.role === "school_admin" && user.status === "active") {
    const otherAdmins = await User.countDocuments({
      schoolId: user.schoolId, role: "school_admin", status: "active", _id: mongoose.trusted({ $ne: user._id }),
    });
    if (otherAdmins === 0) return fail(res, 400, "This is the only active School Admin. Add or activate another admin first.");
  }

  user.status = status;
  await user.save();
  res.json({
    success: true,
    message: status === "active" ? `${user.name} can log in again.` : `${user.name} is deactivated and can no longer log in.`,
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role, status: user.status },
  });
});

// DELETE /api/schools/:schoolId/users/:userId  (removes the login only; school records stay)
router.delete("/:schoolId/users/:userId", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return fail(res, 404, "User not found.");

  const user = await User.findOne({ _id: req.params.userId, schoolId: str(req.params.schoolId, 40) });
  if (!user) return fail(res, 404, "User not found for this school.");

  if (user.role === "school_admin" && user.status === "active") {
    const otherAdmins = await User.countDocuments({
      schoolId: user.schoolId, role: "school_admin", status: "active", _id: mongoose.trusted({ $ne: user._id }),
    });
    if (otherAdmins === 0) return fail(res, 400, "You can't delete the only active School Admin. Add another admin first.");
  }

  await user.deleteOne();
  res.json({ success: true, message: `${user.name}'s login was deleted.` });
});

module.exports = router;
