const mongoose = require("mongoose");

// Every single finger scan (or manual entry) exactly as it was received.
// Daily attendance is always calculated from these, so it can be rebuilt at any time.
const logSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true },
    deviceId: { type: String, required: true }, // DEV-001, or "MANUAL"
    serialNumber: { type: String, default: "" },
    deviceUserId: { type: String, required: true }, // the ID typed into the machine (e.g. "101")
    staffId: { type: String, default: null }, // null until a staff member is linked to this device user ID
    punchTime: { type: String, required: true }, // "2026-10-01 09:05:12" (school's local time)
    date: { type: String, required: true }, // "2026-10-01"
    minutes: { type: Number, required: true }, // minutes after midnight (9:05 -> 545)
    punchState: { type: String, default: "" },
    verifyMode: { type: String, default: "" },
    source: { type: String, enum: ["device", "manual"], default: "device" },
    note: { type: String, default: "" },
    addedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

// The same scan sent twice is stored only once
logSchema.index({ schoolId: 1, deviceId: 1, deviceUserId: 1, punchTime: 1 }, { unique: true });
logSchema.index({ schoolId: 1, staffId: 1, date: 1 });
logSchema.index({ schoolId: 1, deviceUserId: 1, staffId: 1 });
logSchema.index({ schoolId: 1, createdAt: -1 });

module.exports = mongoose.model("AttendanceLog", logSchema);