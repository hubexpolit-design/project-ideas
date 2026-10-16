
const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Create database folder automatically
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

// Connect to SQLite database
const db = new Database(path.join(dataDir, "portfolio.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Web Development',
    link TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add example projects only when the database is empty
const projectCount = db.prepare(
  "SELECT COUNT(*) AS count FROM projects"
).get().count;

if (projectCount === 0) {
  const insert = db.prepare(`
    INSERT INTO projects (title, description, category, link)
    VALUES (?, ?, ?, ?)
  `);

  const seedProjects = db.transaction(() => {
    insert.run(
      "Digital Universe",
      "An immersive 3D space-inspired web experience.",
      "3D Web",
      ""
    );

    insert.run(
      "Future Interface",
      "A futuristic dashboard interface concept.",
      "UI Design",
      ""
    );

    insert.run(
      "Creative Lab",
      "An experimental playground for creative ideas.",
      "Creative Development",
      ""
    );

    insert.run(
      "Next Dimension",
      "A concept exploring depth, light and motion.",
      "Interactive Design",
      ""
    );
  });

  seedProjects();
}

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

// Serve portfolio frontend
app.use(express.static(path.join(__dirname, "public")));

// Simple in-memory contact rate limit
const requestCounts = new Map();

app.use("/api/contact", (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const limit = 5;

  let record = requestCounts.get(ip);

  if (!record || now - record.start > windowMs) {
    record = { start: now, count: 0 };
  }

  record.count++;
  requestCounts.set(ip, record);

  if (record.count > limit) {
    return res.status(429).json({
      success: false,
      message: "Too many messages. Please try again later."
    });
  }

  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "EXPOLIT portfolio backend is running."
  });
});

// Get all portfolio projects
app.get("/api/projects", (req, res) => {
  const projects = db.prepare(`
    SELECT id, title, description, category, link, created_at
    FROM projects
    ORDER BY id DESC
  `).all();

  res.json({
    success: true,
    projects
  });
});

// Receive a contact form submission
app.post("/api/contact", (req, res) => {
  const name =
    typeof req.body.name === "string" ? req.body.name.trim() : "";

  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  const message =
    typeof req.body.message === "string"
      ? req.body.message.trim()
      : "";

  if (
    name.length < 2 ||
    name.length > 80 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    message.length < 10 ||
    message.length > 2000
  ) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid name, email and message."
    });
  }

  try {
    const result = db.prepare(`
      INSERT INTO messages (name, email, message)
      VALUES (?, ?, ?)
    `).run(name, email, message);

    return res.status(201).json({
      success: true,
      message: "Your message has been saved successfully!",
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error("Contact save error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save your message right now."
    });
  }
});

// JSON response for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found."
  });
});

// General error handler
app.use((error, req, res, next) => {
  console.error(error.message);

  res.status(400).json({
    success: false,
    message: "Invalid request."
  });
});

app.listen(PORT, () => {
  console.log(`EXPOLIT backend: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
