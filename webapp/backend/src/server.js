require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { backendPool, backendQuery } = require("./services/backendDatabase");

const authRoutes = require("./routes/auth");
const farmRoutes = require("./routes/farm");
const notificationRoutes = require("./routes/notifications");
const aiRoutes = require("./routes/ai");
const approvalRoutes = require("./routes/approvals");
const safetyRoutes = require("./routes/safety");
const logRoutes = require("./routes/logs");
const growCycleRoutes = require("./routes/growCycles");
const harvestRoutes = require("./routes/harvest");
const taskExecutionRoutes = require("./routes/taskExecutions");
const settingsRoutes = require("./routes/settings");
const adminRoutes = require("./routes/admin");
const accessRoutes = require("./routes/access");

const app = express();

const allowedOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// api routes
app.use("/api/auth", authRoutes);
app.use("/api/farm", farmRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/safety", safetyRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/grow-cycles", growCycleRoutes);
app.use("/api/harvest", harvestRoutes);
app.use("/api/task-executions", taskExecutionRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/access", accessRoutes);

// server health
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await backendQuery("SELECT 1");
    console.log("Backend database connected");

    const server = app.listen(PORT, () => {
      console.log(`Leafy AI backend running on port ${PORT}`);
    });

    async function shutdown() {
      console.log("Shutting down backend...");

      server.close(async () => {
        await backendPool.end();

        console.log("Database pools closed");
        process.exit(0);
      });
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start backend:", error.message);
    await backendPool.end();
    process.exit(1);
  }
}

startServer();
