import express from "express";
import cors from "cors";
import boardRoutes from "./routes/board.routes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/boards", boardRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "my-task-board-api" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;