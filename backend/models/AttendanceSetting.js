const mongoose = require("mongoose");

// Working hours of one school. Used to calculate late arrival and overtime.
const settingSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true, unique: true },
    workStart: { type: String, default: "10:00" },
    workEnd: { type: String, default: "16:00" },
    graceMinutes: { type: Number, default: 10, min: 0, max: 240 },
    weeklyOffDays: { type: [Number], default: [6] }, // 0 = Sunday ... 6 = Saturday
    timezone: { type: String, default: "Asia/Kathmandu" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AttendanceSetting", settingSchema);