const mongoose = require("mongoose");

// Filters like { email: { $ne: null } } sent from the browser are neutralised.
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

let transactionsSupported = false;

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing in backend/.env");

  await mongoose.connect(uri);

  // Atlas runs as a replica set, which supports multi-document transactions.
  // A plain local mongod does not, so we fall back to normal writes there.
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName || hello.msg === "isdbgrid");
  } catch {
    transactionsSupported = false;
  }

  console.log(`Database connected (transactions: ${transactionsSupported ? "on" : "off"})`);
}

const supportsTransactions = () => transactionsSupported;

module.exports = { connectDb, supportsTransactions };
