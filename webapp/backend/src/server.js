const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api", (req, res) => {
  res.json({
    status: "ok"
  });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Leafy AI backend running on port ${PORT}`);
});