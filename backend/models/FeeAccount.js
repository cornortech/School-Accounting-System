const mongoose = require("mongoose");

// One per student: what they owe, what they paid.
const feeAccountSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true },
    studentId: { type: String, required: true },
    totalFee: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    pendingAmount: { type: Number, default: 0, min: 0 },
    dueDate: { type: String, default: "" }, // earliest due date of the assigned fees
    lastPaymentDate: { type: String },
        // Fee items (feeId) already added to this student's total, so a fee is never charged twice
    appliedFees: { type: [String], default: undefined },
        // History of manual changes to the pending fee (who, when, why)
    adjustments: [{ _id: false, date: String, by: String, oldPending: Number, newPending: Number, reason: String }],
  },
  
  // Each save checks nobody else changed the account in between (no lost updates)
  { timestamps: true, optimisticConcurrency: true }
);

feeAccountSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("FeeAccount", feeAccountSchema);
