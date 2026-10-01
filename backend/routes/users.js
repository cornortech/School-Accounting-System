const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const { allowRoles } = require("../middleware/auth");
const { hashPassword, passwordProblem } = require("../utils/password");
const { str, email, fail } = require("../utils/helpers");

// Login accounts of ONE school, managed by that school's admin.
// The school always comes from the logged-in user (req.schoolId), never from the browser.
const router = express.Router();
router.use(allowRoles("school_admin", "super_admin"));

const ROLES = ["school_admin", "accountant", "reception"];
const show = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  createdAt: u.createdAt,
});

async function findUser(req) {
  if (!mongoose.isValidObjectId(req.params.userId)) return null;
  return User.findOne({ _id: req.params.userId, schoolId: req.schoolId });
}

// Would this change leave the school with no active admin?
async function isLastActiveAdmin(user) {
  if (user.role !== "school_admin" || user.status !== "active") return false;
  const others = await User.countDocuments({
    schoolId: user.schoolId,
    role: "school_admin",
    status: "active",
    _id: mongoose.trusted({ $ne: user._id }),
  });
  return others === 0;
}

const isMe = (req, user) => String(user._id) === req.user.id;
const validEmail = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);

// GET /api/users
router.get("/", async (req, res) => {
  const users = await User.find({ schoolId: req.schoolId }).sort({ role: 1, name: 1 }).lean();
  res.json({ success: true, users: users.map(show), myId: req.user.id });
});

// POST /api/users
router.post("/", async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 100);
  const mail = email(b.email);
  if (!name || !mail || !b.password) return fail(res, 400, "Name, email and password are required.");
  if (!validEmail(mail)) return fail(res, 400, "Please enter a valid email.");
  if (!ROLES.includes(b.role)) return fail(res, 400, "Please choose a role.");
  const problem = passwordProblem(b.password);
  if (problem) return fail(res, 400, problem);
  if (await User.exists({ email: mail })) return fail(res, 400, `${mail} is already registered.`);

  const user = await User.create({
    name,
    email: mail,
    role: b.role,
    schoolId: req.schoolId,
    passwordHash: await hashPassword(b.password),
  });
  res.status(201).json({ success: true, message: `${user.name} can now log in.`, user: show(user) });
});

// PUT /api/users/:userId  (name, email, role)
router.put("/:userId", async (req, res) => {
  const user = await findUser(req);
  if (!user) return fail(res, 404, "User not found.");

  const b = req.body || {};
  const name = str(b.name, 100);
  if (name) user.name = name;

  if (b.email !== undefined) {
    const mail = email(b.email);
    if (!validEmail(mail)) return fail(res, 400, "Please enter a valid email.");
    if (mail !== user.email && (await User.exists({ email: mail }))) return fail(res, 400, `${mail} is already registered.`);
    user.email = mail;
  }

  if (b.role !== undefined && b.role !== user.role) {
    if (!ROLES.includes(b.role)) return fail(res, 400, "Please choose a valid role.");
    if (isMe(req, user)) return fail(res, 400, "You can't change your own role.");
    if (await isLastActiveAdmin(user)) return fail(res, 400, "This is the only active School Admin. Make someone else an admin first.");
    user.role = b.role;
  }

  await user.save();
  res.json({ success: true, message: `${user.name} updated.`, user: show(user) });
});

// PATCH /api/users/:userId/status  { status: "active" | "inactive" }
router.patch("/:userId/status", async (req, res) => {
  const status = req.body?.status;
  if (status !== "active" && status !== "inactive") return fail(res, 400, 'Status must be "active" or "inactive".');
  const user = await findUser(req);
  if (!user) return fail(res, 404, "User not found.");
  if (status === "inactive") {
    if (isMe(req, user)) return fail(res, 400, "You can't deactivate your own account.");
    if (await isLastActiveAdmin(user)) return fail(res, 400, "This is the only active School Admin.");
  }

  user.status = status;
  await user.save();
  res.json({
    success: true,
    message: status === "active" ? `${user.name} can log in again.` : `${user.name} can no longer log in.`,
    user: show(user),
  });
});

// PATCH /api/users/:userId/reset-password  { newPassword }
router.patch("/:userId/reset-password", async (req, res) => {
  const problem = passwordProblem(req.body?.newPassword);
  if (problem) return fail(res, 400, problem);
  const user = await findUser(req);
  if (!user) return fail(res, 404, "User not found.");

  user.passwordHash = await hashPassword(req.body.newPassword);
  await user.save();
  res.json({ success: true, message: `New password set for ${user.name}.` });
});

// DELETE /api/users/:userId
router.delete("/:userId", async (req, res) => {
  const user = await findUser(req);
  if (!user) return fail(res, 404, "User not found.");
  if (isMe(req, user)) return fail(res, 400, "You can't delete your own account.");
  if (await isLastActiveAdmin(user)) return fail(res, 400, "You can't delete the only active School Admin.");

  await user.deleteOne();
  res.json({ success: true, message: `${user.name}'s account was deleted.` });
});

module.exports = router;