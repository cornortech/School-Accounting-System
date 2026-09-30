const mongoose = require("mongoose");

const EXPENSE_CATEGORIES = [
  "Utilities", "Maintenance", "Lab Supplies", "Office Supplies", "Sports Equipment",
  "Events", "Transport & Fuel", "Software & IT", "Miscellaneous",
];

const expenseSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true },
    expenseId: { type: String, required: true }, // EXP-2026-0001
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true },
    paymentMethod: { type: String, default: "Cash" },
    description: { type: String, required: true },
    vendorOrPerson: { type: String, required: true },
    receiptRef: { type: String, default: "" },
    recordedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

expenseSchema.index({ schoolId: 1, expenseId: 1 }, { unique: true });
expenseSchema.index({ schoolId: 1, date: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
