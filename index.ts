import express from "express";
import dotenv from "dotenv"

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
