// Attendance for ONE school. req.schoolId always comes from the logged-in user (see middleware/auth.js),
// so a school can only ever read or change its own attendance.
const express = require("express");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const AttendanceLog = require("../models/AttendanceLog");
const AttendanceSetting = require("../models/AttendanceSetting");
const Staff = require("../models/Staff");
const { allowRoles } = require("../middleware/auth");
const { str, fail, isDate } = require("../utils/helpers");
const svc = require("../services/attendanceService");

const router = express.Router();
const adminOnly = allowRoles("super_admin", "school_admin");
const MAX_REPORT_DAYS = 92;

const staffStart = (s) => (isDate(s.joiningDate) ? s.joiningDate : "0000-00-00");

// Status of one staff member on one day when there is NO attendance record
function missingStatus(date, today, settings, staff) {
  if (date > today) return "upcoming";
  if (date < staffStart(staff)) return "not_joined";
  if ((settings.weeklyOffDays || []).includes(svc.weekday(date))) return "weekly_off";
  if (staff.status === "on_leave") return "on_leave";
  return date === today ? "not_in_yet" : "absent";
}

// GET /api/attendance?date=YYYY-MM-DD   -> one day, every staff member
router.get("/", async (req, res) => {
  const schoolId = req.schoolId;
  const settings = await svc.getSettings(schoolId);
  const today = svc.localToday(settings.timezone);
  const date = isDate(req.query.date) ? req.query.date : today;

  const [staff, records] = await Promise.all([
    Staff.find({ schoolId, status: mongoose.trusted({ $in: ["active", "on_leave"] }) })
      .select("staffId fullName designation department roleType deviceUserId joiningDate status")
      .sort({ fullName: 1 })
      .lean(),
    Attendance.find({ schoolId, date }).lean(),
  ]);
  const byStaff = new Map(records.map((r) => [r.staffId, r]));

  const rows = staff
    .filter((s) => date >= staffStart(s) || byStaff.has(s.staffId))
    .map((s) => {
      const r = byStaff.get(s.staffId);
      const working = !!r && !r.checkOut && date === today;
      return {
        staffId: s.staffId,
        fullName: s.fullName,
        designation: s.designation,
        department: s.department,
        deviceUserId: s.deviceUserId || "",
        checkIn: r ? r.checkIn : "",
        checkOut: r ? r.checkOut : "",
        workingMinutes: r ? r.workingMinutes : 0,
        lateMinutes: r ? r.lateMinutes : 0,
        overtimeMinutes: r ? r.overtimeMinutes : 0,
        hasManual: r ? r.hasManual : false,
        status: r ? (working ? "working" : r.status) : missingStatus(date, today, settings, s),
        isLate: !!r && r.status === "late",
      };
    });

  const count = (fn) => rows.filter(fn).length;
  res.json({
    success: true,
    date,
    today,
    isWeeklyOff: (settings.weeklyOffDays || []).includes(svc.weekday(date)),
    summary: {
      totalStaff: rows.length,
      present: count((r) => ["present", "late", "working"].includes(r.status)),
      late: count((r) => r.isLate),
      absent: count((r) => r.status === "absent" || r.status === "not_in_yet"),
      currentlyWorking: count((r) => r.status === "working"),
      onLeave: count((r) => r.status === "on_leave"),
      notLinked: count((r) => !r.deviceUserId),
    },
    rows,
  });
});

// GET /api/attendance/settings
router.get("/settings", async (req, res) => {
  const s = await svc.getSettings(req.schoolId);
  res.json({ success: true, settings: { workStart: s.workStart, workEnd: s.workEnd, graceMinutes: s.graceMinutes, weeklyOffDays: s.weeklyOffDays, timezone: s.timezone } });
});

// PUT /api/attendance/settings
router.put("/settings", adminOnly, async (req, res) => {
  const b = req.body || {};
  const start = svc.toMinutes(b.workStart);
  const end = svc.toMinutes(b.workEnd);
  if (start == null || end == null) return fail(res, 400, "Enter start and end time like 10:00 and 16:00.");
  if (end <= start) return fail(res, 400, "End time must be after start time.");
  const grace = Number(b.graceMinutes);
  if (!Number.isInteger(grace) || grace < 0 || grace > 240) return fail(res, 400, "Grace time must be between 0 and 240 minutes.");
  const offDays = Array.isArray(b.weeklyOffDays) ? [...new Set(b.weeklyOffDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
  const timezone = str(b.timezone, 60) || "Asia/Kathmandu";
  if (!svc.isValidTimezone(timezone)) return fail(res, 400, "Time zone is not valid (example: Asia/Kathmandu).");

  const settings = await AttendanceSetting.findOneAndUpdate(
    { schoolId: req.schoolId },
    { $set: { workStart: svc.toHHMM(start), workEnd: svc.toHHMM(end), graceMinutes: grace, weeklyOffDays: offDays, timezone } },
    { upsert: true, new: true, lean: true }
  );

  // Apply the new times to the current month, so today's late/overtime are correct straight away
  const today = svc.localToday(timezone);
  const rebuilt = await svc.recomputeRecent(req.schoolId, `${today.slice(0, 7)}-01`);
  res.json({ success: true, message: `Working hours saved. ${rebuilt} attendance record(s) of this month recalculated.`, settings });
});

// GET /api/attendance/report?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/report", async (req, res) => {
  const schoolId = req.schoolId;
  const settings = await svc.getSettings(schoolId);
  const today = svc.localToday(settings.timezone);
  const from = isDate(req.query.from) ? req.query.from : `${today.slice(0, 7)}-01`;
  const to = isDate(req.query.to) ? req.query.to : today;
  if (to < from) return fail(res, 400, "The end date must be after the start date.");
  const days = svc.daysBetween(from, to);
  if (days.length > MAX_REPORT_DAYS) return fail(res, 400, `Please choose at most ${MAX_REPORT_DAYS} days.`);

  const [staff, records] = await Promise.all([
    Staff.find({ schoolId, status: mongoose.trusted({ $in: ["active", "on_leave"] }) })
      .select("staffId fullName designation department joiningDate status deviceUserId")
      .sort({ fullName: 1 })
      .lean(),
    Attendance.find({ schoolId, date: mongoose.trusted({ $gte: from, $lte: to }) }).lean(),
  ]);
  const key = (staffId, date) => `${staffId}|${date}`;
  const recMap = new Map(records.map((r) => [key(r.staffId, r.date), r]));
  const offDays = settings.weeklyOffDays || [];
  const countable = days.filter((d) => d <= today);

  const staffRows = staff.map((s) => {
    let present = 0, late = 0, absent = 0, workMin = 0, overtimeMin = 0, checkInSum = 0;
    for (const d of countable) {
      if (d < staffStart(s)) continue;
      const r = recMap.get(key(s.staffId, d));
      if (r) {
        present++;
        if (r.status === "late") late++;
        workMin += r.workingMinutes;
        overtimeMin += r.overtimeMinutes;
        checkInSum += r.checkInMinutes || 0;
      } else if (!offDays.includes(svc.weekday(d)) && d !== today && s.status !== "on_leave") {
        absent++;
      }
    }
    return {
      staffId: s.staffId,
      fullName: s.fullName,
      designation: s.designation,
      department: s.department,
      presentDays: present,
      lateDays: late,
      absentDays: absent,
      totalWorkingHours: Math.round((workMin / 60) * 100) / 100,
      overtimeHours: Math.round((overtimeMin / 60) * 100) / 100,
      averageCheckIn: present ? svc.toHHMM(Math.round(checkInSum / present)) : "",
    };
  });

  // Day-by-day numbers for the chart
  const daily = days.map((d) => {
    const off = offDays.includes(svc.weekday(d));
    const eligible = staff.filter((s) => d >= staffStart(s));
    const dayRecs = eligible.map((s) => recMap.get(key(s.staffId, d))).filter(Boolean);
    return {
      date: d,
      weeklyOff: off,
      future: d > today,
      present: dayRecs.length,
      late: dayRecs.filter((r) => r.status === "late").length,
      absent: d > today || off ? 0 : Math.max(0, eligible.length - dayRecs.length),
    };
  });

  const workingDays = countable.filter((d) => !offDays.includes(svc.weekday(d))).length;
  res.json({ success: true, from, to, today, workingDays, staff: staffRows, daily });
});

// POST /api/attendance/manual  { staffId, date, time, note }  - add a scan by hand (machine broken, forgot to scan...)
router.post("/manual", adminOnly, async (req, res) => {
  const schoolId = req.schoolId;
  const b = req.body || {};
  const staff = await Staff.findOne({ schoolId, staffId: str(b.staffId, 40) }).lean();
  if (!staff) return fail(res, 404, "Staff member not found.");
  const minutes = svc.toMinutes(b.time);
  if (!isDate(b.date) || minutes == null) return fail(res, 400, "Choose a date and a time like 09:05.");
  const settings = await svc.getSettings(schoolId);
  if (b.date > svc.localToday(settings.timezone)) return fail(res, 400, "You can't add attendance for a future date.");

  const punchTime = `${b.date} ${svc.toHHMM(minutes)}:00`;
  try {
    await AttendanceLog.create({
      schoolId,
      deviceId: "MANUAL",
      deviceUserId: staff.staffId,
      staffId: staff.staffId,
      punchTime,
      date: b.date,
      minutes,
      source: "manual",
      note: str(b.note, 200),
      addedBy: req.user.name,
    });
  } catch (err) {
    if (err.code === 11000) return fail(res, 400, "This exact time is already saved for this person.");
    throw err;
  }
  const record = await svc.recomputeDay(schoolId, staff.staffId, b.date, settings);
  res.status(201).json({ success: true, message: `Scan at ${svc.toHHMM(minutes)} added for ${staff.fullName}.`, record });
});

// GET /api/attendance/:staffId?from&to  -> one person's day-by-day history (with every scan)
router.get("/:staffId", async (req, res) => {
  const schoolId = req.schoolId;
  const staff = await Staff.findOne({ schoolId, staffId: str(req.params.staffId, 40) })
    .select("staffId fullName designation department deviceUserId joiningDate status")
    .lean();
  if (!staff) return fail(res, 404, "Staff member not found.");

  const settings = await svc.getSettings(schoolId);
  const today = svc.localToday(settings.timezone);
  const from = isDate(req.query.from) ? req.query.from : `${today.slice(0, 7)}-01`;
  const to = isDate(req.query.to) ? req.query.to : today;
  if (to < from) return fail(res, 400, "The end date must be after the start date.");
  const days = svc.daysBetween(from, to);
  if (days.length > MAX_REPORT_DAYS) return fail(res, 400, `Please choose at most ${MAX_REPORT_DAYS} days.`);

  const range = mongoose.trusted({ $gte: from, $lte: to });
  const [records, logs] = await Promise.all([
    Attendance.find({ schoolId, staffId: staff.staffId, date: range }).lean(),
    AttendanceLog.find({ schoolId, staffId: staff.staffId, date: range }).sort({ punchTime: 1 }).select("date punchTime source note deviceId").lean(),
  ]);
  const recMap = new Map(records.map((r) => [r.date, r]));
  const scans = new Map();
  for (const l of logs) {
    if (!scans.has(l.date)) scans.set(l.date, []);
    scans.get(l.date).push({ id: String(l._id), time: l.punchTime.slice(11, 16), source: l.source, note: l.note, deviceId: l.deviceId });
  }

  const history = days
    .slice()
    .reverse()
    .map((d) => {
      const r = recMap.get(d);
      return {
        date: d,
        checkIn: r ? r.checkIn : "",
        checkOut: r ? r.checkOut : "",
        workingMinutes: r ? r.workingMinutes : 0,
        lateMinutes: r ? r.lateMinutes : 0,
        overtimeMinutes: r ? r.overtimeMinutes : 0,
        status: r ? (!r.checkOut && d === today ? "working" : r.status) : missingStatus(d, today, settings, staff),
        scans: scans.get(d) || [],
      };
    });

  res.json({ success: true, staff, from, to, history });
});

module.exports = router;