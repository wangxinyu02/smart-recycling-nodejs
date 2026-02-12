// src/app.js

const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Recycling API is running");
});

// Log API called
app.use((req, res, next) => {
  console.log("API called: ");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers: ", req.headers);
  console.log("Params:", JSON.stringify(req.params));
  console.log("Query:", JSON.stringify(req.query));
  console.log("Body:", JSON.stringify(req.body, null, 2));
  next();
});

app.use("/api/v1", authRoutes);
app.use("/api/v1", userRoutes);

console.log("✅ LOADED src/app.js");

module.exports = app;
