// Small shared helpers for routes.

const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const email = (v) => str(v, 120).toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const dateOr = (v, fallback = today()) => (isDate(v) ? v : fallback);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

// Mongo documents -> plain JSON with "id" instead of "_id"
function plain(doc) {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(plain);
  const o = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  if (o._id !== undefined) {
    o.id = String(o._id);
    delete o._id;
  }
  delete o.__v;
  delete o.passwordHash;
  return o;
}

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

module.exports = { str, email, today, isDate, dateOr, escapeRegex, pick, plain, fail };
