const mongoose = require("mongoose");

const schoolSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true, unique: true }, // SCH-1001
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    currency: { type: String, default: "NPR" },
    currencySymbol: { type: String, default: "Rs." },
    principalName: { type: String, default: "" },
    panNo: { type: String, default: "" },
    establishedYear: { type: Number },
    status: { type: String, enum: ["active", "inactive", "deleted"], default: "active", index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("School", schoolSchema);
