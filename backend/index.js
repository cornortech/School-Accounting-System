require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { connectDb } = require("./connectDb");
const { requireAuth, needSchool } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());

// Only our own websites may call the API from a browser (ALLOWED_ORIGINS in .env)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, done) {
      if (!origin || allowedOrigins.includes(origin)) return done(null, true);
      return done(Object.assign(new Error("Origin not allowed"), { status: 403 }));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-School-Id"],
  })
);

app.use(express.json({ limit: "200kb" }));

// ---------- Public ----------
const health = (req, res) => res.json({ status: "ok" });
app.get("/health", health);
app.get("/api/health", health);

// 10 wrong passwords per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many failed attempts. Please wait 15 minutes and try again." },
});
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", require("./routes/auth"));

// ---------- Logged in ----------
app.use("/api", requireAuth);
app.use("/api/schools", require("./routes/schools"));

// Everything below works inside one school
const schoolRoutes = {
  students: require("./routes/students"),
  fees: require("./routes/fees"),
  billing: require("./routes/billing"),
  staff: require("./routes/staff"),
  salary: require("./routes/salary"),
  expenses: require("./routes/expenses"),
  ledger: require("./routes/ledger"),
  reports: require("./routes/reports"),
};
for (const [path, router] of Object.entries(schoolRoutes)) {
  app.use(`/api/${path}`, needSchool, router);
}

app.use("/api", (req, res) => res.status(404).json({ success: false, message: "Not found." }));

// Never send internal error details to the browser
app.use((err, req, res, next) => {
  if (err.status >= 400 && err.status < 500) {
    const message = err.type === "entity.too.large" ? "Request is too large." : err.status === 403 ? err.message : "Invalid request.";
    return res.status(err.status).json({ success: false, message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: "This record already exists. Please refresh and try again." });
  }
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ success: false, message: isProduction ? "Some values are not valid." : err.message });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
});

connectDb()
  .then(() => {
    app.listen(Number(PORT), "0.0.0.0", () => console.log(`EduLedger API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Could not start: database connection failed.", err.message);
    process.exit(1);
  });
