// Race test: 10 payments for the same student at the same instant.
// Real MongoDB (Atlas) must show: 10 receipts, all numbers unique, balance = sum of receipts.
// ⚠️ Run ONLY against a TEST database.
//
//   API_URL=https://school-accounting-system-52b1.onrender.com SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... node tests/race-test.mjs
const API = (process.env.API_URL || 'https://school-accounting-system-52b1.onrender.com').replace(/\/+$/, '');
const R = Date.now().toString(36);
const call = async (m, p, t, b) => {
  const r = await fetch(API + '/api' + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { s: r.status, j: await r.json() };
};
const SA = (await call('POST', '/auth/login', null, { email: process.env.SUPER_ADMIN_EMAIL, password: process.env.SUPER_ADMIN_PASSWORD })).j.token;
await call('POST', '/schools', SA, { name: 'Race Test ' + R, code: 'RT' + R, adminEmail: `race.${R}@test.test`, adminPassword: 'race-test-pass-1' });
const T = (await call('POST', '/auth/login', null, { email: `race.${R}@test.test`, password: 'race-test-pass-1' })).j.token;
const st = (await call('POST', '/students', T, { fullName: 'Race Student', class: '1', parentName: 'P', parentPhone: '9800000000', initialFeeAmount: 1000 })).j.student.studentId;

const rs = await Promise.all(Array.from({ length: 10 }, () => call('POST', '/billing/payments', T, { studentId: st, paidAmount: 7, paymentMethod: 'Cash' })));
const d = (await call('GET', `/students/${st}`, T)).j;
const numbers = d.paymentHistory.map((r) => r.receiptNumber);
const total = d.paymentHistory.reduce((s, r) => s + r.paidAmount, 0);

console.log('Responses        :', rs.map((r) => r.s).join(', '));
console.log('Receipts saved   :', numbers.length, '(expected 10)');
console.log('Unique numbers   :', new Set(numbers).size, '(expected 10)');
console.log('Receipts total   :', total, '(expected 70)');
console.log('Student balance  :', d.feeAccount.paidAmount, '(must equal receipts total)');
const ok = numbers.length === 10 && new Set(numbers).size === 10 && total === 70 && d.feeAccount.paidAmount === 70;
console.log(ok ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
