require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { pool, query } = require("./services/database");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.get("/api", (req, res) => {
  res.json({
    status: "ok"
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await query("SELECT 1");
    console.log("Database connected");

    const server = app.listen(PORT, () => {
      console.log(`Leafy AI backend running on port ${PORT}`);
    });

    async function shutdown() {
      console.log("Shutting down backend...");

      server.close(async () => {
        await pool.end();
        console.log("Database pool closed");
        process.exit(0);
      });
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start backend:", error.message);
    await pool.end();
    process.exit(1);
  }
}

startServer();
