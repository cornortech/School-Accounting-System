const mongoose = require("mongoose");

const CATEGORIES = ["Admission", "Tuition", "Exam", "Lab", "Library", "Transport", "Sports", "Hostel", "Miscellaneous"];

const feeStructureSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true, index: true },
    feeId: { type: String, required: true }, // FEE-TUI-01
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0 },
    class: { type: String, default: "All" },
    frequency: { type: String, enum: ["Monthly", "Termly", "Annually", "One-Time"], default: "Monthly" },
    dueDate: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeeStructure", feeStructureSchema);
module.exports.CATEGORIES = CATEGORIES;
