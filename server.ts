import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  handleAnalyze,
  handleEvaluate,
  handleGenerateResponses,
  handleOptimize,
  sendJson,
} from "./api/_lib/promptDoctorHandlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

// Mount the exact same handlers used by Vercel Serverless Functions in /api/*.js
app.all("/api/analyze", (req: Request, res: Response) => handleAnalyze(req, res));
app.all("/api/optimize", (req: Request, res: Response) => handleOptimize(req, res));
app.all("/api/generate-responses", (req: Request, res: Response) =>
  handleGenerateResponses(req, res)
);
app.all("/api/evaluate", (req: Request, res: Response) => handleEvaluate(req, res));

// Catch-all for unknown /api routes
app.all("/api/*", (_req: Request, res: Response) => {
  sendJson(res, 404, { error: "API route not found.", code: "NOT_FOUND" });
});

async function startServer() {
  const isProd =
    process.env.NODE_ENV === "production" ||
    (fs.existsSync(path.join(__dirname, "dist")) && process.env.npm_lifecycle_event === "start");

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Prompt Doctor server running on http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Failed to start Prompt Doctor server:", err);
    process.exit(1);
  });
}

export default app;
