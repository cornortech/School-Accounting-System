const express = require("express");
const mongoose = require("mongoose");
const Student = require("../models/Student");
const FeeAccount = require("../models/FeeAccount");
const FeeStructure = require("../models/FeeStructure");
const Receipt = require("../models/Receipt");
const { allowRoles } = require("../middleware/auth");
const { nextNumber, pad } = require("../utils/counter");
const { inTransaction } = require("../utils/transaction");
const { describe } = require("../utils/fees");
const { toAmount, sum } = require("../utils/money");
const { str, email, escapeRegex, pick, plain, fail } = require("../utils/helpers");

const router = express.Router();

const STATUSES = ["active", "inactive", "graduated"];
const GENDERS = ["Male", "Female", "Other"];
const SORTABLE = ["fullName", "class", "admissionNo", "studentId", "createdAt", "rollNo"];

const currentAcademicYear = () => {
  const y = new Date().getFullYear();
  return `${y}-${y + 1}`;
};

// GET /api/students
router.get("/", async (req, res) => {
  const schoolId = req.schoolId;
  const filter = { schoolId };

  const search = str(req.query.search, 80);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ fullName: rx }, { admissionNo: rx }, { studentId: rx }, { parentName: rx }, { parentPhone: rx }];
  }
  const className = str(req.query.className, 40);
  if (className && className !== "all") filter.class = className;
  const status = str(req.query.status);
  if (STATUSES.includes(status)) filter.status = status;

  const sortBy = pick(str(req.query.sortBy), SORTABLE, "fullName");
  const direction = req.query.sortOrder === "desc" ? -1 : 1;

  const [students, accounts, classes] = await Promise.all([
    Student.find(filter).sort({ [sortBy]: direction }).lean(),
    FeeAccount.find({ schoolId }).lean(),
    Student.distinct("class", { schoolId }),
  ]);
  const byStudent = new Map(accounts.map((a) => [a.studentId, a]));

  res.json({
    success: true,
    students: students.map((s) => ({ ...plain(s), feeAccount: describe(byStudent.get(s.studentId)) })),
    meta: {
      total: students.length,
      classes: classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      activeCount: students.filter((s) => s.status === "active").length,
    },
  });
});

// GET /api/students/:studentId
router.get("/:studentId", async (req, res) => {
  const schoolId = req.schoolId;
  const studentId = str(req.params.studentId, 40);
  const student = await Student.findOne({ schoolId, studentId }).lean();
  if (!student) return fail(res, 404, "Student not found.");

  const [account, receipts] = await Promise.all([
    FeeAccount.findOne({ schoolId, studentId }).lean(),
    Receipt.find({ schoolId, studentId }).sort({ paymentDate: -1, createdAt: -1 }).lean(),
  ]);

  res.json({ success: true, student: plain(student), feeAccount: describe(account), paymentHistory: plain(receipts) });
});

// POST /api/students
router.post("/", allowRoles("super_admin", "school_admin", "accountant", "reception"), async (req, res) => {
  const schoolId = req.schoolId;
  const b = req.body || {};
  const fullName = str(b.fullName, 100);
  const studentClass = str(b.class, 40);
  const parentName = str(b.parentName, 100);
  const parentPhone = str(b.parentPhone, 30);

  if (!fullName || !studentClass || !parentName || !parentPhone) {
    return fail(res, 400, "Full name, class, parent name and parent phone are required.");
  }

  let customFee = null;
  if (b.initialFeeAmount !== undefined && b.initialFeeAmount !== "") {
    customFee = toAmount(b.initialFeeAmount, { allowZero: true });
    if (customFee === null) return fail(res, 400, "Fee amount must be a valid number.");
  }

  // Fees that apply to this class decide the starting balance (unless a custom amount was typed).
  const structures = await FeeStructure.find({ schoolId, class: mongoose.trusted({ $in: ["All", studentClass] }) }).lean();
  const totalFee = customFee ?? sum(structures, (f) => f.amount);
  const dueDates = structures.map((f) => f.dueDate).filter(Boolean).sort();

  const year = new Date().getFullYear();
  const result = await inTransaction(async (session) => {
    const studentNo = await nextNumber(`${schoolId}:student:${year}`, session);
    const admissionNo = await nextNumber(`${schoolId}:admission`, session);

    const [student] = await Student.create(
      [{
        schoolId,
        studentId: `STU-${year}-${pad(studentNo, 4)}`,
        admissionNo: `ADM-${pad(admissionNo, 4)}`,
        fullName,
        class: studentClass,
        section: str(b.section, 5).toUpperCase() || "A",
        rollNo: str(b.rollNo, 10),
        academicYear: str(b.academicYear, 20) || currentAcademicYear(),
        dob: str(b.dob, 10),
        gender: pick(b.gender, GENDERS, "Male"),
        parentName,
        parentPhone,
        parentEmail: email(b.parentEmail),
        address: str(b.address),
      }],
      { session }
    );

    const [account] = await FeeAccount.create(
            [{
        schoolId,
        studentId: student.studentId,
        totalFee,
        pendingAmount: totalFee,
        dueDate: customFee === null ? dueDates[0] || "" : "",
        appliedFees: customFee === null ? structures.map((f) => f.feeId) : [],
      }],
      { session }
    );
    return { student, account };
  });

  res.status(201).json({
    success: true,
    message: `${fullName} admitted (${result.student.studentId}).`,
    student: { ...plain(result.student), feeAccount: describe(result.account) },
  });
});

// PUT /api/students/:studentId
router.put("/:studentId", allowRoles("super_admin", "school_admin", "accountant", "reception"), async (req, res) => {
  const student = await Student.findOne({ schoolId: req.schoolId, studentId: str(req.params.studentId, 40) });
  if (!student) return fail(res, 404, "Student not found.");

  const b = req.body || {};
  const text = { fullName: 100, class: 40, rollNo: 10, academicYear: 20, dob: 10, parentName: 100, parentPhone: 30, address: 200 };
  for (const [key, max] of Object.entries(text)) {
    if (typeof b[key] === "string" && b[key].trim()) student[key] = str(b[key], max);
  }
  if (typeof b.section === "string" && b.section.trim()) student.section = str(b.section, 5).toUpperCase();
  if (typeof b.parentEmail === "string") student.parentEmail = email(b.parentEmail);
  if (GENDERS.includes(b.gender)) student.gender = b.gender;
  if (STATUSES.includes(b.status)) student.status = b.status;

  await student.save();
  res.json({ success: true, message: `${student.fullName} updated.`, student: plain(student) });
});

// DELETE /api/students/:studentId
router.delete("/:studentId", allowRoles("super_admin", "school_admin"), async (req, res) => {
  const schoolId = req.schoolId;
  const studentId = str(req.params.studentId, 40);
  const student = await Student.findOne({ schoolId, studentId });
  if (!student) return fail(res, 404, "Student not found.");

  // A student with payments is part of the accounts - keep the record, just mark it inactive.
  if (await Receipt.exists({ schoolId, studentId })) {
    return fail(res, 400, `${student.fullName} has payment records and can't be deleted. Set the status to Inactive or Graduated instead.`);
  }

  await inTransaction(async (session) => {
    await Student.deleteOne({ _id: student._id }, { session });
    await FeeAccount.deleteOne({ schoolId, studentId }, { session });
  });
  res.json({ success: true, message: `${student.fullName} (${studentId}) deleted.` });
});

module.exports = router;
