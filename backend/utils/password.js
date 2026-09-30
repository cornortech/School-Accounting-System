const bcrypt = require("bcryptjs");

const hashPassword = (plain) => bcrypt.hash(String(plain), 12);

const verifyPassword = (plain, hash) =>
  typeof plain === "string" && typeof hash === "string" && plain && hash
    ? bcrypt.compare(plain, hash)
    : Promise.resolve(false);

function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 72) return "Password must be 72 characters or fewer.";
  return null;
}

module.exports = { hashPassword, verifyPassword, passwordProblem };
