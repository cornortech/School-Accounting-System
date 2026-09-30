// All amounts are stored in rupees with at most 2 decimals.
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Returns a clean amount, or null if the value is not a valid amount.
function toAmount(value, { allowZero = false } = {}) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e10) return null;
  if (!allowZero && n === 0) return null;
  return round2(n);
}

const sum = (list, pick) => round2(list.reduce((s, x) => s + (Number(pick(x)) || 0), 0));

module.exports = { round2, toAmount, sum };
