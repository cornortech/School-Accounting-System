const mongoose = require("mongoose");

// Cash book entry. Credit = money in, debit = money out.
// The running balance is worked out when the ledger is read, never stored,
// so two entries saved at the same time can't corrupt it.
const ledgerEntrySchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true },
    transactionId: { type: String, required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    referenceType: { type: String, enum: ["fee_payment", "salary_payout", "expense", "manual"], required: true },
    referenceId: { type: String, default: "" },
    description: { type: String, default: "" },
    date: { type: String, required: true },
    recordedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ schoolId: 1, date: 1, createdAt: 1 });
ledgerEntrySchema.index({ schoolId: 1, referenceType: 1, referenceId: 1 });

module.exports = mongoose.model("LedgerEntry", ledgerEntrySchema);
