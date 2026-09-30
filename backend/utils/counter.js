const Counter = require("../models/Counter");

// Atomic, gap-free numbering (receipt numbers, student IDs, ...).
// Two cashiers saving at the same second can never get the same number.
async function nextNumber(key, session) {
  for (let attempt = 0; ; attempt++) {
    try {
      const doc = await Counter.findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session }
      );
      return doc.seq;
    } catch (err) {
      // Two requests creating the same new counter at once: the loser simply tries again.
      if (err.code !== 11000 || attempt >= 3) throw err;
    }
  }
}

const pad = (n, width) => String(n).padStart(width, "0");

module.exports = { nextNumber, pad };
