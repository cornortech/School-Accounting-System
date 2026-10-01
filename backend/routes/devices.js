// Fingerprint machines of ONE school (School Admin only).
const express = require("express");
const mongoose = require("mongoose");
const AttendanceDevice = require("../models/AttendanceDevice");
const AttendanceLog = require("../models/AttendanceLog");
const Staff = require("../models/Staff");
const { allowRoles } = require("../middleware/auth");
const { nextNumber, pad } = require("../utils/counter");
const { str, fail, isDate, plain } = require("../utils/helpers");
const { isOnline, cleanSerial, queueCommand } = require("../services/deviceSyncService");
const svc = require("../services/attendanceService");

const router = express.Router();
router.use(allowRoles("super_admin", "school_admin"));

const show = (d) => {
  const o = plain(d);
  delete o.pendingCommands;
  delete o.nextCommandId;
  return { ...o, online: isOnline(d), waitingCommands: (d.pendingCommands || []).length };
};

// [{deviceUserId, deviceId, punchTime}] -> one row per device user ID, newest first
function groupUnlinked(logs) {
  const groups = new Map();
  for (const l of logs) {
    const key = `${l.deviceId}|${l.deviceUserId}`;
    const g = groups.get(key) || { deviceUserId: l.deviceUserId, deviceId: l.deviceId, scans: 0, lastScan: "" };
    g.scans++;
    if (l.punchTime > g.lastScan) g.lastScan = l.punchTime;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.lastScan.localeCompare(a.lastScan)).slice(0, 50);
}

const findDevice = (req, id) => AttendanceDevice.findOne({ schoolId: req.schoolId, deviceId: str(id, 40) });

// GET /api/device
router.get("/", async (req, res) => {
  const devices = await AttendanceDevice.find({ schoolId: req.schoolId }).sort({ deviceId: 1 }).lean();
  res.json({ success: true, devices: devices.map(show) });
});

// POST /api/device/connect  { name, serialNumber, location }  - register a machine
router.post("/connect", async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 80);
  const serialNumber = cleanSerial(b.serialNumber);
  if (!name || !serialNumber) return fail(res, 400, "Device name and serial number are required.");
  if (!/^[A-Z0-9-]{4,40}$/.test(serialNumber)) return fail(res, 400, "Serial number can only have letters and numbers.");
  if (await AttendanceDevice.exists({ serialNumber })) {
    return fail(res, 400, "This serial number is already registered. Check the number on the machine.");
  }

  const n = await nextNumber(`${req.schoolId}:device`);
  try {
    const device = await AttendanceDevice.create({
      schoolId: req.schoolId,
      deviceId: `DEV-${pad(n, 3)}`,
      name,
      serialNumber,
      location: str(b.location, 100),
    });
    res.status(201).json({ success: true, message: `${name} registered. Now set up the machine to send data to this server.`, device: show(device.toObject()) });
  } catch (err) {
    if (err.code === 11000) return fail(res, 400, "This serial number is already registered.");
    throw err;
  }
});

// PUT /api/device/:deviceId  { name, location, status }
router.put("/:deviceId", async (req, res) => {
  const device = await findDevice(req, req.params.deviceId);
  if (!device) return fail(res, 404, "Device not found.");
  const b = req.body || {};
  if (str(b.name, 80)) device.name = str(b.name, 80);
  if (typeof b.location === "string") device.location = str(b.location, 100);
  if (b.status === "active" || b.status === "inactive") device.status = b.status;
  await device.save();
  res.json({ success: true, message: `${device.name} updated.`, device: show(device.toObject()) });
});

// DELETE /api/device/:deviceId  (scans already received are kept)
router.delete("/:deviceId", async (req, res) => {
  const device = await findDevice(req, req.params.deviceId);
  if (!device) return fail(res, 404, "Device not found.");
  await device.deleteOne();
  res.json({ success: true, message: `${device.name} removed. Attendance already received is kept.` });
});

// GET /api/device/logs?deviceId&date&unlinked=1   - raw scans as received
router.get("/logs", async (req, res) => {
  const schoolId = req.schoolId;
  const filter = { schoolId };
  const deviceId = str(req.query.deviceId, 40);
  if (deviceId && deviceId !== "all") filter.deviceId = deviceId;
  if (isDate(req.query.date)) filter.date = req.query.date;
  if (req.query.unlinked === "1") filter.staffId = null;

  const [logs, unlinkedGroups, staff] = await Promise.all([
    AttendanceLog.find(filter).sort({ punchTime: -1 }).limit(300).lean(),
    // Scans from device user IDs that are not linked to any staff member yet
    AttendanceLog.find({ schoolId, source: "device", staffId: null })
      .sort({ punchTime: -1 })
      .limit(3000)
      .select("deviceUserId deviceId punchTime")
      .lean(),
    Staff.find({ schoolId }).select("staffId fullName").lean(),
  ]);
  const names = new Map(staff.map((s) => [s.staffId, s.fullName]));

  res.json({
    success: true,
    logs: logs.map((l) => ({
      id: String(l._id),
      deviceId: l.deviceId,
      deviceUserId: l.deviceUserId,
      staffId: l.staffId,
      staffName: l.staffId ? names.get(l.staffId) || l.staffId : "",
      punchTime: l.punchTime,
      source: l.source,
      note: l.note,
      addedBy: l.addedBy,
    })),
    unlinked: groupUnlinked(unlinkedGroups),
  });
});

// DELETE /api/device/logs/:id  - only manual scans can be removed
router.delete("/logs/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Scan not found.");
  const log = await AttendanceLog.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!log) return fail(res, 404, "Scan not found.");
  if (log.source !== "manual") return fail(res, 400, "Scans from the machine can't be deleted. Only manual entries can.");
  await log.deleteOne();
  if (log.staffId) await svc.recomputeDay(req.schoolId, log.staffId, log.date);
  res.json({ success: true, message: "Manual scan removed." });
});

// POST /api/device/sync  { deviceId }
// Asks the machine to send ALL its scans again (duplicates are ignored), then rebuilds
// the last 31 days of attendance from what we already have.
router.post("/sync", async (req, res) => {
  const schoolId = req.schoolId;
  const deviceId = str(req.body?.deviceId, 40);
  let message = "";
  if (deviceId) {
    const device = await findDevice(req, deviceId);
    if (!device) return fail(res, 404, "Device not found.");
    await AttendanceDevice.updateOne({ _id: device._id }, { $set: { attlogStamp: "None" } });
    await queueCommand(device, "CHECK");
    message = isOnline(device)
      ? `${device.name} will send its scans again within a minute. `
      : `${device.name} is offline. It will send its scans when it connects. `;
  }

  const settings = await svc.getSettings(schoolId);
  const d = new Date(`${svc.localToday(settings.timezone)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 31);
  const rebuilt = await svc.recomputeRecent(schoolId, d.toISOString().slice(0, 10));
  res.json({ success: true, message: `${message}${rebuilt} attendance record(s) recalculated.` });
});

module.exports = router;