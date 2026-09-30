// Creates the first super admin. Run once:  npm run seed:admin
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const { connectDb } = require("./connectDb");
const User = require("./models/User");
const { hashPassword, passwordProblem } = require("./utils/password");

(async () => {
  const name = (process.env.SUPER_ADMIN_NAME || "").trim();
  const email = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || "";

  if (!name || !email || password.length < 12) {
    console.error("Set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (12+ characters) in backend/.env");
    process.exit(1);
  }
  const problem = passwordProblem(password);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }

  await connectDb();
  if (await User.exists({ role: "super_admin" })) {
    console.log("A super admin already exists. Nothing to do.");
  } else {
    await User.create({ name, email, role: "super_admin", passwordHash: await hashPassword(password) });
    console.log(`Super admin created: ${email}`);
    console.log("You can now remove SUPER_ADMIN_PASSWORD from .env");
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
