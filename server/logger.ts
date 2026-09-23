import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { db } from "./db";
import { broadcastLogEvent } from "./events";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  error_message?: string;
  stack_trace?: string;
  metadata_json?: string;
}

export function logToDb(entry: Omit<LogEntry, "id" | "timestamp">) {
  try {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO _logs (id, timestamp, level, method, path, status, duration_ms, error_message, stack_trace, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Ensure metadata is safely bounded to prevent string length overflows
    let safeMetadata = entry.metadata_json || null;
    if (safeMetadata && safeMetadata.length > 2000) {
      safeMetadata = safeMetadata.substring(0, 2000) + '... [truncated]"}';
    }

    stmt.run(
      id,
      timestamp,
      entry.level,
      entry.method || null,
      entry.path || null,
      entry.status || null,
      entry.duration_ms || null,
      entry.error_message
        ? String(entry.error_message).substring(0, 1000)
        : null,
      entry.stack_trace ? String(entry.stack_trace).substring(0, 3000) : null,
      safeMetadata,
    );

    // Broadcast log in realtime to connected WebSockets
    try {
      broadcastLogEvent({
        id,
        timestamp,
        level: entry.level,
        method: entry.method,
        path: entry.path,
        status: entry.status,
        duration_ms: entry.duration_ms,
        error_message: entry.error_message,
        stack_trace: entry.stack_trace,
        metadata_json: safeMetadata,
      });
    } catch {}
  } catch (err) {
    console.error("[AlsaBase Logger Error]", err);
  }
}

export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const reqPath = req.path || "";
  const fullUrl = req.originalUrl || req.url || "";

  // Skip logging internal endpoints to prevent feedback loops and database bloat
  if (
    reqPath.startsWith("/@") ||
    reqPath.startsWith("/_") ||
    reqPath.startsWith("/api/logs") ||
    reqPath.startsWith("/api/health") ||
    reqPath.startsWith("/api/realtime") ||
    reqPath.startsWith("/api/events") ||
    reqPath.endsWith(".js") ||
    reqPath.endsWith(".css") ||
    reqPath.endsWith(".ico") ||
    reqPath.endsWith(".png") ||
    reqPath.endsWith(".svg") ||
    reqPath.endsWith(".woff2") ||
    reqPath.endsWith(".map")
  ) {
    return next();
  }

  const start = performance.now();

  res.on("finish", () => {
    const duration_ms = Number((performance.now() - start).toFixed(2));
    const level =
      res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";

    // Sanitize body to avoid leaking passwords in logs
    let sanitizedBody: any = null;
    if (req.body && typeof req.body === "object") {
      try {
        const copy: any = {};
        for (const [k, v] of Object.entries(req.body)) {
          if (
            k.toLowerCase().includes("password") ||
            k.toLowerCase().includes("token")
          ) {
            copy[k] = "[REDACTED]";
          } else if (typeof v === "string" && v.length > 200) {
            copy[k] = v.substring(0, 200) + "... [truncated]";
          } else if (Array.isArray(v)) {
            copy[k] = `[Array(${v.length})]`;
          } else {
            copy[k] = v;
          }
        }
        sanitizedBody = copy;
      } catch {
        sanitizedBody = "[Complex Body]";
      }
    }

    const errorMessage =
      (res as any).locals?.errorMessage ||
      (res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null);

    const auth = (req as any).auth;
    const isSuperuser = !!auth?.isSuperuser;

    logToDb({
      level,
      method: req.method,
      path: fullUrl.split("?")[0],
      status: res.statusCode,
      duration_ms,
      error_message: errorMessage,
      stack_trace: (res as any).locals?.stackTrace || null,
      metadata_json: JSON.stringify({
        ip: req.ip || req.socket.remoteAddress || "127.0.0.1",
        query: req.query,
        body: sanitizedBody,
        userAgent: req.headers["user-agent"]
          ? String(req.headers["user-agent"]).substring(0, 150)
          : undefined,
        auth: auth
          ? {
              id: auth.id,
              email: auth.email,
              role: auth.role,
              isSuperuser: isSuperuser,
            }
          : undefined,
        isSuperuser: isSuperuser,
      }),
    });
  });

  next();
}

export function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const stack = err?.stack || "";
  const message = err?.message || "Internal Server Error";
  const status = err?.status || 500;

  (res as any).locals = {
    errorMessage: message,
    stackTrace: stack,
  };

  logToDb({
    level: "ERROR",
    method: req.method,
    path: (req.originalUrl || req.url || "").split("?")[0],
    status,
    duration_ms: 0,
    error_message: message,
    stack_trace: stack,
    metadata_json: JSON.stringify({
      error: message,
      code: status,
      timestamp: new Date().toISOString(),
    }),
  });

  res.status(status).json({
    error: message,
    code: status,
    timestamp: new Date().toISOString(),
  });
}
