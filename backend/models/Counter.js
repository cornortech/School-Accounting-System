const mongoose = require("mongoose");

// Holds running numbers, e.g. { _id: "SCH-1001:receipt:2026", seq: 42 }
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("Counter", counterSchema);
