const mongoose = require("mongoose");

// One row per staff member per day.
const attendanceSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true },
    staffId: { type: String, required: true },
    date: { type: String, required: true }, // "2026-10-01"
    checkIn: { type: String, default: "" }, // "09:05"
    checkOut: { type: String, default: "" }, // "17:30" (empty while still working)
    checkInMinutes: { type: Number, default: null },
    checkOutMinutes: { type: Number, default: null },
    workingMinutes: { type: Number, default: 0 },
    workingHours: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
    status: { type: String, enum: ["present", "late"], default: "present" },
    punchCount: { type: Number, default: 0 },
    deviceId: { type: String, default: "" },
    hasManual: { type: Boolean, default: false },
  },
  { timestamps: true }
);

attendanceSchema.index({ schoolId: 1, staffId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ schoolId: 1, date: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);