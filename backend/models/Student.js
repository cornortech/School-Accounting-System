const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true },
    studentId: { type: String, required: true }, // STU-2026-0001
    admissionNo: { type: String, required: true }, // ADM-0001
    fullName: { type: String, required: true, trim: true },
    class: { type: String, required: true, trim: true },
    section: { type: String, default: "A" },
    rollNo: { type: String, default: "" },
    academicYear: { type: String, default: "" },
    dob: { type: String, default: "" },
    gender: { type: String, enum: ["Male", "Female", "Other"], default: "Male" },
    parentName: { type: String, required: true, trim: true },
    parentPhone: { type: String, required: true, trim: true },
    parentEmail: { type: String, default: "" },
    address: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive", "graduated"], default: "active" },
  },
  { timestamps: true }
);

studentSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });
studentSchema.index({ schoolId: 1, class: 1, fullName: 1 });

module.exports = mongoose.model("Student", studentSchema);
