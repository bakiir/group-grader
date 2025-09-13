const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const methodOverride = require("method-override");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/group-grader");

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || "your-secret-key",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/group-grader"
  }),
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// EJS configuration
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/auth/login");
  }
};

const requireAdmin = (req, res, next) => {
  if (req.session.userId && req.session.role === "admin") {
    next();
  } else {
    res.status(403).send("Access denied");
  }
};

// Middleware to pass user data to templates
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    name: req.session.userName,
    role: req.session.role
  } : null;
  res.locals.req = req; // Pass req to templates
  next();
});

// Test route
app.get("/test", (req, res) => {
  res.send("Server is working!");
});

// Routes
app.get("/", (req, res) => {
  if (req.session.userId && req.session.role) {
    if (req.session.role === "admin") {
      res.redirect("/admin/dashboard");
    } else {
      res.redirect("/student/dashboard");
    }
  } else {
    res.redirect("/auth/login");
  }
});

// Route connections
app.use("/auth", require("./routes/auth"));
app.use("/admin", requireAuth, requireAdmin, require("./routes/admin"));
app.use("/student", requireAuth, require("./routes/student"));

// 404 handling
app.use((req, res) => {
  res.status(404).render("404", { title: "Page not found" });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("500", { 
    title: "Server error",
    error: process.env.NODE_ENV === "development" ? err : {}
  });
});

// Server startup
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});
