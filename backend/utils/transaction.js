const mongoose = require("mongoose");
const { supportsTransactions } = require("../connectDb");

// Runs several writes as one unit: either all are saved or none are.
// (A payment = receipt + fee account + ledger entry.)
async function inTransaction(work) {
  if (!supportsTransactions()) return work(undefined);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { inTransaction };
