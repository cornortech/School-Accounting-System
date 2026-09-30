const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const School = require("../models/School");
const { fail, str } = require("../utils/helpers");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET is missing or shorter than 32 characters. Set it in backend/.env");
}

// The token only carries the user id. Role, school and status are read
// fresh from the database on every request, so changes apply immediately.
const signToken = (userId) => jwt.sign({ uid: String(userId) }, JWT_SECRET, { expiresIn: "12h" });

function schoolBlocked(school) {
  if (!school || school.status === "deleted") {
    return { code: "SCHOOL_DELETED", message: "This school account has been removed." };
  }
  if (school.status === "inactive") {
    return {
      code: "SCHOOL_INACTIVE",
      message: `${school.name} is currently deactivated. Please contact the system administrator.`,
    };
  }
  return null;
}

async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) return fail(res, 401, "Please log in first.");

  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET);
  } catch {
    return fail(res, 401, "Your session has expired. Please log in again.");
  }

  const user = await User.findById(claims.uid).lean();
  if (!user || user.status !== "active") return fail(res, 401, "Account not found or disabled.");

  req.user = {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    schoolId: user.schoolId || undefined,
  };

  if (user.role === "super_admin") {
    // The super admin can open any school by sending its code in X-School-Id.
    const requested = str(req.headers["x-school-id"], 40);
    if (requested) {
      const school = await School.findOne({ schoolId: requested, status: mongoose.trusted({ $in: ["active", "inactive"] }) })
        .select("schoolId name")
        .lean();
      // If the remembered school no longer exists (deleted), just ignore it
      // so the super admin can still see the school list and pick another one.
      if (school) {
        req.schoolId = school.schoolId;
        req.user.schoolName = school.name;
      }
    }
    return next();
  }

  const school = await School.findOne({ schoolId: user.schoolId }).select("schoolId name status").lean();
  const blocked = schoolBlocked(school);
  if (blocked) return fail(res, 403, blocked.message, { code: blocked.code });

  // School users are locked to their own school. Nothing from the browser can change this.
  req.schoolId = school.schoolId;
  req.user.schoolName = school.name;
  next();
}

const allowRoles = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : fail(res, 403, "You don't have permission to do this.");

const needSchool = (req, res, next) =>
  req.schoolId ? next() : fail(res, 400, "Please select a school first.");

module.exports = { signToken, requireAuth, allowRoles, needSchool, schoolBlocked };