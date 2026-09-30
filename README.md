# EduLedger — School Accounts

Accounting for schools: fee collection with printed receipts, student balances, staff salaries, expenses, a cash book and yearly reports. **Many schools use one system**, and each school only sees its own records.

---

## Features

| Area | What it does |
|---|---|
| **Schools** (super admin) | Create, edit, deactivate or remove schools. Create logins for each school. |
| **Students** | Admission with automatic Student ID and Admission No. Each student's fee balance is set from the fees for their class. |
| **Fees** | Fee heads per class or for all classes (tuition, exam, lab, transport…), with due dates. Overdue balances are flagged automatically. |
| **Billing** | Collect fees (cash, bank, online, cheque) with discount. Sequential receipt numbers (`RCP-2026-0001`). Print receipts with the school's PAN. Cancel receipts (admin only); the money is reversed automatically. |
| **Staff & payroll** | Teaching and non-teaching staff. Generate monthly payslips for everyone in one click, pay salaries, print salary slips. |
| **Expenses** | Record, edit and delete expenses by category. |
| **Cash book** | Every fee, salary and expense is written to the cash book automatically, with a running balance. Manual entries for opening balance, bank charges and donations. |
| **Reports** | Dashboard, fee collection report, pending fees, income vs expense per year. |
| **Currency** | Each school has its own currency. The default is NPR (`Rs. 1,25,000.00`). |

### Roles

| Role | Can do |
|---|---|
| `super_admin` | Manage all schools and their logins; can open any school's records |
| `school_admin` | Everything inside their school |
| `accountant` | Fees, billing, payroll, expenses, cash book, reports |
| `reception` | Students and fee collection |

Only the super admin and the school admin can cancel receipts or delete records. Every permission is checked **on the server**, not just hidden in the menu.

---

## Project structure

```
eduledger/
├── backend/                 Node.js + Express + MongoDB (deploy on Render)
│   ├── index.js             server, security, routes
│   ├── connectDb.js
│   ├── seedSuperAdmin.js    creates the first super admin (run once)
│   ├── middleware/auth.js   login check, roles, school separation
│   ├── models/              database collections
│   ├── routes/              API: auth, schools, students, fees, billing,
│   │                        staff, salary, expenses, ledger, reports
│   ├── utils/               passwords, money rounding, numbering, transactions
│   └── tests/               api-test.mjs, race-test.mjs
│
└── frontend/                React + Vite + Tailwind (deploy on Vercel)
    ├── vercel.json
    └── src/
        ├── config.ts        app name + API address
        ├── utils/money.ts   currency formatting
        ├── context/  services/  components/  pages/
```

---

## Run on your computer

You need **Node.js 20+** and a **MongoDB Atlas** database (the free tier is fine for testing).

### 1. Backend

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill it in:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/eduledger
JWT_SECRET=<long random text>
ALLOWED_ORIGINS=http://localhost:5173
```

Make a `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Start the backend:

```bash
npm run dev
```

You should see `EduLedger API running on port 5000`. Check <https://school-accounting-system-52b1.onrender.com/health>.

### 2. Create the super admin (once)

Add these to `backend/.env`:

```env
SUPER_ADMIN_NAME=Your Name
SUPER_ADMIN_EMAIL=you@example.com
SUPER_ADMIN_PASSWORD=at-least-12-characters
```

Then run:

```bash
npm run seed:admin
```

Afterwards, remove `SUPER_ADMIN_PASSWORD` from `.env`.

### 3. Frontend

```bash
cd frontend
npm install
```

Copy `.env.example` to `.env`:

```env
VITE_API_URL=https://school-accounting-system-52b1.onrender.com
```

Then run:

```bash
npm run dev
```

Open <http://localhost:5173> and log in as the super admin. Create a school: this also creates the school admin's login. The school admin can then add fees, students and staff.

---

## Deploy

Deploy the **backend first**.

### Backend → Render

- **New → Web Service**, then pick the repo
- **Root Directory:** `backend`
- **Build:** `npm install`
- **Start:** `npm start`
- **Environment variables:**
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `NODE_ENV=production`
  - `ALLOWED_ORIGINS=https://your-site.vercel.app` (with `https://`, no `/` at the end)
- Don't set `PORT`; Render sets it.
- In MongoDB Atlas → **Network Access**, allow `0.0.0.0/0`.

### Frontend → Vercel

- **Add New → Project**, then pick the repo
- **Root Directory:** `frontend`
- **Framework:** Vite
- **Build:** `vite build`
- **Output:** `dist`
- **Environment variable:** `VITE_API_URL=https://your-backend.onrender.com`

After changing a variable on Vercel, click **Redeploy**.

> Render's free plan sleeps after 15 minutes (the first request then takes about 50 seconds). Use a paid plan for real schools. Turn on **Atlas backups**: this is financial data.

---

## Tests

Run these **only against a test database**, because they create schools and records.

```bash
cd backend
# terminal 1
npm run dev
# terminal 2
SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD=... npm test
SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD=... npm run test:race
```

- `npm test` runs 68 checks: the full workflow, the accounting totals, roles, and school separation.
- `npm run test:race` sends 10 payments for the same student at the same moment. All 10 receipts must be saved with unique numbers, and the student's balance must equal the receipts total. **Run it once on Atlas before going live.**

On Windows PowerShell, set the variables first:
`$env:SUPER_ADMIN_EMAIL="..."; $env:SUPER_ADMIN_PASSWORD="..."; npm test`

---

## How the money stays correct

- A payment saves the **receipt, the student's balance and the cash book line together** (a MongoDB transaction on Atlas). Either all three are saved, or none are.
- Receipt, student, staff and expense numbers come from atomic counters, so two cashiers can never get the same number.
- A receipt can only be cancelled once, and a salary can only be paid once, even if the button is clicked twice.
- The cash book's running balance is calculated when you view it, never stored, so it can't drift.
- Students with receipts, and staff with paid salaries, can't be deleted; set them to Inactive or Terminated instead.

## Security

- Passwords hashed with bcrypt; logins expire after 12 hours.
- Every request re-checks the user and the school, so deactivating a school locks it out immediately.
- School users can only ever reach their own school's data. The school comes from the login, never from the browser.
- Login rate limit (10 wrong attempts per 15 minutes), Helmet headers, strict CORS, and NoSQL-injection protection.
- No demo accounts and no default passwords.

## Customising

- **App name:** `frontend/src/config.ts` (`APP_NAME`) and the `<title>` in `frontend/index.html`
- **Brand colour:** the `--color-brand-*` values at the top of `frontend/src/index.css`
