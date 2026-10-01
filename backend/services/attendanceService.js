// All attendance calculations live here.
// Daily attendance is ALWAYS rebuilt from the stored scans, so receiving the same scan twice,
// receiving scans late, or adding a manual scan can never create wrong or duplicate records.
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const AttendanceLog = require("../models/AttendanceLog");
const AttendanceSetting = require("../models/AttendanceSetting");
const Staff = require("../models/Staff");

const DUPLICATE_GAP_MINUTES = 2; // scans closer than this to the previous one are ignored

// ---------- time helpers ("HH:MM", "YYYY-MM-DD") ----------
const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
};
const toHHMM = (minutes) =>
  minutes == null ? "" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const isValidTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// Today's date in the school's own time zone (the server itself runs in UTC)
function localToday(timezone = "Asia/Kathmandu") {
  const tz = isValidTimezone(timezone) ? timezone : "Asia/Kathmandu";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

function daysBetween(from, to) {
  const out = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end && out.length < 400) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// "2026-10-01 09:05:12" -> { date, minutes, punchTime }  (null if the text is not a real time)
function parsePunchTime(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(text || "").trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s = "00"] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || Number(h) > 23 || Number(mi) > 59) return null;
  const date = `${y}-${mo}-${d}`;
  if (isNaN(Date.parse(`${date}T00:00:00Z`))) return null;
  return { date, minutes: Number(h) * 60 + Number(mi), punchTime: `${date} ${h.padStart(2, "0")}:${mi}:${s.padStart(2, "0")}` };
}

// ---------- settings ----------
async function getSettings(schoolId) {
  const found = await AttendanceSetting.findOne({ schoolId }).lean();
  if (found) return found;
  try {
    return (await AttendanceSetting.create({ schoolId })).toObject();
  } catch (err) {
    if (err.code === 11000) return AttendanceSetting.findOne({ schoolId }).lean(); // created at the same moment
    throw err;
  }
}

// ---------- the core rule: scans of one person on one day -> attendance ----------
// First scan = check-in. Last scan (if there are 2 or more) = check-out.
function computeDay(minutesList, settings) {
  const sorted = [...minutesList].sort((a, b) => a - b);
  const kept = [];
  for (const m of sorted) {
    if (!kept.length || m - kept[kept.length - 1] >= DUPLICATE_GAP_MINUTES) kept.push(m);
  }
  if (!kept.length) return null;

  const checkIn = kept[0];
  const checkOut = kept.length >= 2 ? kept[kept.length - 1] : null;
  const start = toMinutes(settings.workStart) ?? 600;
  const end = toMinutes(settings.workEnd) ?? 960;
  const grace = Number(settings.graceMinutes) || 0;

  const lateMinutes = checkIn > start + grace ? checkIn - start : 0;
  const workingMinutes = checkOut != null ? checkOut - checkIn : 0;
  const overtimeMinutes = checkOut != null && checkOut > end ? checkOut - Math.max(end, checkIn) : 0;

  return {
    checkIn: toHHMM(checkIn),
    checkOut: toHHMM(checkOut),
    checkInMinutes: checkIn,
    checkOutMinutes: checkOut,
    workingMinutes,
    workingHours: Math.round((workingMinutes / 60) * 100) / 100,
    lateMinutes,
    overtimeMinutes,
    status: lateMinutes > 0 ? "late" : "present",
    punchCount: kept.length,
  };
}

// Rebuild one person's attendance for one day from the stored scans
async function recomputeDay(schoolId, staffId, date, settings) {
  const logs = await AttendanceLog.find({ schoolId, staffId, date }).select("minutes deviceId source").lean();
  const result = computeDay(logs.map((l) => l.minutes), settings || (await getSettings(schoolId)));

  if (!result) {
    await Attendance.deleteOne({ schoolId, staffId, date });
    return null;
  }
  const firstDevice = logs.find((l) => l.source === "device");
  const update = { ...result, deviceId: firstDevice ? firstDevice.deviceId : "MANUAL", hasManual: logs.some((l) => l.source === "manual") };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await Attendance.findOneAndUpdate({ schoolId, staffId, date }, { $set: update }, { upsert: true, new: true, lean: true });
    } catch (err) {
      if (err.code !== 11000 || attempt === 1) throw err; // two scans saved at the same moment - try once more
    }
  }
}

// Rebuild many (staffId, date) pairs at once. Uses a few big database calls instead of
// one call per person per day, so thousands of old scans are processed in seconds.
async function recomputePairs(schoolId, pairs) {
  if (!pairs.length) return 0;
  const settings = await getSettings(schoolId);
  const unique = [...new Set(pairs.map((p) => `${p.staffId}|${p.date}`))];

  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500).map((k) => k.split("|"));
    const staffIds = [...new Set(chunk.map(([sid]) => sid))];
    const dates = [...new Set(chunk.map(([, d]) => d))];

    const logs = await AttendanceLog.find({
      schoolId,
      staffId: mongoose.trusted({ $in: staffIds }),
      date: mongoose.trusted({ $in: dates }),
    })
      .select("staffId date minutes deviceId source")
      .lean();
    const byKey = new Map();
    for (const l of logs) {
      const k = `${l.staffId}|${l.date}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(l);
    }

    const ops = chunk.map(([staffId, date]) => {
      const dayLogs = byKey.get(`${staffId}|${date}`) || [];
      const result = computeDay(dayLogs.map((l) => l.minutes), settings);
      if (!result) return { deleteOne: { filter: { schoolId, staffId, date } } };
      const firstDevice = dayLogs.find((l) => l.source === "device");
      const update = { ...result, deviceId: firstDevice ? firstDevice.deviceId : "MANUAL", hasManual: dayLogs.some((l) => l.source === "manual") };
      return { updateOne: { filter: { schoolId, staffId, date }, update: { $set: update }, upsert: true } };
    });

    try {
      await Attendance.bulkWrite(ops, { ordered: false });
    } catch (err) {
      // Another request created some of the same rows at the same moment - writing again now updates them
      if (err.code !== 11000 && !(err.writeErrors || []).every((e) => e.code === 11000)) throw err;
      await Attendance.bulkWrite(ops, { ordered: false });
    }
  }
  return unique.length;
}

// Which staff member is "device user 101" on this machine?
async function staffMapForDevice(schoolId, deviceId) {
  const staff = await Staff.find({ schoolId, deviceUserId: mongoose.trusted({ $nin: ["", null] }) })
    .select("staffId deviceUserId fingerprintDeviceId")
    .lean();
  const map = new Map();
  for (const s of staff) {
    if (s.fingerprintDeviceId && s.fingerprintDeviceId !== deviceId) continue; // linked to another machine only
    map.set(String(s.deviceUserId), s.staffId);
  }
  return map;
}

// Save scans that came from a machine, then update attendance. Safe to call with repeated scans.
// records: [{ deviceUserId, punchTime, punchState, verifyMode }]
async function ingestDeviceLogs(device, records) {
  const schoolId = device.schoolId;
  const map = await staffMapForDevice(schoolId, device.deviceId);

  const docs = [];
  for (const r of records) {
    const t = parsePunchTime(r.punchTime);
    const deviceUserId = String(r.deviceUserId || "").trim().slice(0, 20);
    if (!t || !deviceUserId) continue;
    docs.push({
      schoolId,
      deviceId: device.deviceId,
      serialNumber: device.serialNumber,
      deviceUserId,
      staffId: map.get(deviceUserId) || null,
      punchTime: t.punchTime,
      date: t.date,
      minutes: t.minutes,
      punchState: String(r.punchState ?? "").slice(0, 10),
      verifyMode: String(r.verifyMode ?? "").slice(0, 10),
      source: "device",
    });
  }
  if (!docs.length) return { received: records.length, saved: 0, matched: 0 };

  // Insert only scans we don't have yet (no error for duplicates)
  const ops = docs.map((d) => ({
    updateOne: {
      filter: { schoolId, deviceId: d.deviceId, deviceUserId: d.deviceUserId, punchTime: d.punchTime },
      update: { $setOnInsert: d },
      upsert: true,
    },
  }));
  let newIndexes = [];
  for (let i = 0; i < ops.length; i += 500) {
    const res = await AttendanceLog.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    newIndexes = newIndexes.concat(Object.keys(res.upsertedIds || {}).map((k) => Number(k) + i));
  }

  const fresh = newIndexes.map((i) => docs[i]);
  const matched = fresh.filter((d) => d.staffId);
  await recomputePairs(schoolId, matched.map((d) => ({ staffId: d.staffId, date: d.date })));
  return { received: records.length, saved: fresh.length, matched: matched.length };
}

// When a staff member gets (or changes) a device user ID, attach their earlier unlinked scans
async function linkUnmatchedLogs(schoolId, staff) {
  if (!staff.deviceUserId) return 0;
  const filter = { schoolId, source: "device", deviceUserId: String(staff.deviceUserId), staffId: null };
  if (staff.fingerprintDeviceId) filter.deviceId = staff.fingerprintDeviceId;

  const logs = await AttendanceLog.find(filter).select("date").lean();
  if (!logs.length) return 0;
  await AttendanceLog.updateMany(filter, { $set: { staffId: staff.staffId } });
  await recomputePairs(schoolId, logs.map((l) => ({ staffId: staff.staffId, date: l.date })));
  return logs.length;
}

// Rebuild everything from a date onward (used by "Sync" and after settings change)
async function recomputeRecent(schoolId, fromDate) {
  const logs = await AttendanceLog.find({ schoolId, staffId: mongoose.trusted({ $ne: null }), date: mongoose.trusted({ $gte: fromDate }) })
    .select("staffId date")
    .lean();
  return recomputePairs(schoolId, logs.map((l) => ({ staffId: l.staffId, date: l.date })));
}

module.exports = {
  DUPLICATE_GAP_MINUTES,
  toMinutes,
  toHHMM,
  isValidTimezone,
  localToday,
  weekday,
  daysBetween,
  parsePunchTime,
  getSettings,
  computeDay,
  recomputeDay,
  recomputePairs,
  ingestDeviceLogs,
  linkUnmatchedLogs,
  recomputeRecent,
};