const LedgerEntry = require("../models/LedgerEntry");

// Every money movement (fee, salary, expense) writes one cash book line.
async function postEntry(fields, session) {
  const [entry] = await LedgerEntry.create([fields], { session });
  return entry;
}

module.exports = { postEntry };
