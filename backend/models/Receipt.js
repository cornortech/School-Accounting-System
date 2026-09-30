const mongoose = require("mongoose");

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Online/UPI", "Cheque"];

const receiptSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true },
    receiptNumber: { type: String, required: true }, // RCP-2026-0001
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    admissionNo: { type: String, default: "" },
    class: { type: String, default: "" },
    feeItems: [{ _id: false, category: String, amount: Number }],
    totalAmount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    paidAmount: { type: Number, required: true },
    balanceRemaining: { type: Number, default: 0 },
    // Part of the payment that was for charges not billed before (added to the student's total fee)
    extraCharged: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    transactionRef: { type: String, default: "" },
    paymentDate: { type: String, required: true },
    receivedBy: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: { type: String, enum: ["valid", "cancelled"], default: "valid" },
    cancelledBy: { type: String },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

receiptSchema.index({ schoolId: 1, receiptNumber: 1 }, { unique: true });
receiptSchema.index({ schoolId: 1, paymentDate: -1 });
receiptSchema.index({ schoolId: 1, studentId: 1 });

module.exports = mongoose.model("Receipt", receiptSchema);
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
