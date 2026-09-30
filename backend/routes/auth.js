const express = require("express");
const User = require("../models/User");
const School = require("../models/School");
const { signToken, requireAuth, schoolBlocked } = require("../middleware/auth");
const { hashPassword, verifyPassword, passwordProblem } = require("../utils/password");
const { email, fail, plain } = require("../utils/helpers");

const router = express.Router();

const schoolSummary = (s) =>
  s && {
    schoolId: s.schoolId,
    name: s.name,
    code: s.code,
    currency: s.currency,
    currencySymbol: s.currencySymbol,
    status: s.status,
  };

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const mail = email(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!mail || !password) return fail(res, 400, "Email and password are required.");

  // Same message for every failure, so nobody can find out which emails exist.
  const wrong = () => fail(res, 401, "Incorrect email or password.");

  const user = await User.findOne({ email: mail }).select("+passwordHash");
  if (!user || !(await verifyPassword(password, user.passwordHash))) return wrong();
  if (user.status !== "active") return fail(res, 403, "Your account is disabled. Please contact your administrator.");

  let school = null;
  if (user.role !== "super_admin") {
    school = await School.findOne({ schoolId: user.schoolId }).lean();
    const blocked = schoolBlocked(school);
    if (blocked) return fail(res, 403, blocked.message, { code: blocked.code });
  }

  res.json({
    success: true,
    token: signToken(user._id),
    user: {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
      school: schoolSummary(school),
    },
    message: `Welcome back, ${user.name.split(" ")[0]}.`,
  });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  const school = req.user.role === "super_admin" ? null : await School.findOne({ schoolId: req.user.schoolId }).lean();
  res.json({ success: true, user: { ...req.user, school: school ? plain(school) : null } });
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = await User.findById(req.user.id).select("+passwordHash");
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return fail(res, 400, "Current password is not correct.");
  }
  const problem = passwordProblem(newPassword);
  if (problem) return fail(res, 400, problem);

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  res.json({ success: true, message: "Password changed." });
});

module.exports = router;
