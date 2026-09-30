const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true },
    staffId: { type: String, required: true }, // STF-001
    fullName: { type: String, required: true, trim: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    roleType: { type: String, enum: ["teaching", "non_teaching"], required: true },
    designation: { type: String, required: true, trim: true },
    department: { type: String, default: "" },
    teachingSubject: { type: String },
    nonTeachingRole: { type: String },
    joiningDate: { type: String, default: "" },
        salaryStartDate: { type: String, default: "" }, // salary is counted in full months from this date
    baseSalary: { type: Number, required: true, min: 0 },
    allowances: { type: Number, default: 0, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    netSalary: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["active", "on_leave", "terminated"], default: "active" },
  },
  { timestamps: true }
);

staffSchema.index({ schoolId: 1, staffId: 1 }, { unique: true });

module.exports = mongoose.model("Staff", staffSchema);
