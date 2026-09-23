import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pkg from "../package.json";
import { hasSuperusers } from "./db";
import { initDefaultCollections } from "./schema";
import { requestLoggerMiddleware, errorHandlerMiddleware } from "./logger";
import { authMiddleware, authRouter } from "./auth";
import { collectionsRouter } from "./crud";
import { hooksRouter } from "./hooksRouter";
import { initHooks, executeHooksRoute } from "./hooks";
import { logsRouter } from "./logsRouter";
import { staticHostingMiddleware, initPublicDir, staticRouter } from "./static";
import { realtimeRouter, initWebSocketServer, initSocketIOServer } from "./events";
import { settingsRouter, backupsRouter } from "./settingsRouter";
import { rateLimitMiddleware } from "./settings";
import { setupAutoBackupScheduler } from "./backups";
import { filesRouter } from "./files";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8090;

// Initialize Socket.IO and WebSocket Realtime Servers
initSocketIOServer(server);
initWebSocketServer(server);

// Initialize default collections, initial superuser check, hooks engine, public directory & auto backup scheduler
initDefaultCollections();
initHooks();
initPublicDir();
setupAutoBackupScheduler();

// Standard Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(authMiddleware);
app.use(requestLoggerMiddleware);
app.use(rateLimitMiddleware);

// Dynamic Hooks Endpoints (AlsaBase _hooks)
app.use(executeHooksRoute);

// Health check & Server info
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    version: pkg.version || "1.0.0",
    timestamp: new Date().toISOString(),
    hasSuperuser: hasSuperusers(),
  });
});

// Mount Main API Routes
app.use("/api/auth", authRouter);
app.use("/api/collections", collectionsRouter);
app.use("/api/files", filesRouter);
app.use("/api/hooks", hooksRouter);
app.use("/api/logs", logsRouter);
app.use("/api/static-files", staticRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/backups", backupsRouter);
app.use("/api", realtimeRouter);

// Favicon handler
app.get(["/favicon.svg", "/favicon.ico"], (_req, res) => {
  const publicFavicon = path.resolve(process.cwd(), "public", "favicon.svg");
  const distFavicon = path.resolve(process.cwd(), "dist", "favicon.svg");
  if (fs.existsSync(publicFavicon)) {
    res.setHeader("Content-Type", "image/svg+xml");
    res.sendFile(publicFavicon);
  } else if (fs.existsSync(distFavicon)) {
    res.setHeader("Content-Type", "image/svg+xml");
    res.sendFile(distFavicon);
  } else {
    res.status(404).end();
  }
});

// 1. Serve Admin Dashboard (React Mantine UI) strictly at /_ and /_/*
const distPath = path.resolve(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  app.use("/_", express.static(distPath));
  app.get(["/_", /^\/_(\/.*)?$/], (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.get(["/_", /^\/_(\/.*)?$/], (_req, res) => {
    res.redirect("http://localhost:5173/_/");
  });
}

// 2. Serve Static website files from ./_public directory at root /, /public, and /api/public
app.use("/public", staticHostingMiddleware());
app.use("/api/public", staticHostingMiddleware());
app.use("/", staticHostingMiddleware());

// Global Error Handler
app.use(errorHandlerMiddleware);

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`[AlsaBase] Server running on http://localhost:${PORT}`);
  console.log(`[AlsaBase] Admin Dashboard UI: http://localhost:${PORT}/_/`);
  console.log(
    `[AlsaBase] Static Site Hosting: http://localhost:${PORT}/ (from ./_public)`,
  );
  console.log(`[AlsaBase] API Base URL:        http://localhost:${PORT}/api/`);
  console.log(
    `[AlsaBase] Realtime Socket.IO:  http://localhost:${PORT}/api/socket.io`,
  );
  console.log(
    `[AlsaBase] Realtime WebSocket:  ws://localhost:${PORT}/api/realtime/ws`,
  );
  console.log(`=======================================================`);
});

export default app;
