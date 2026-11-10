import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { db } from "./db";
import { requireSuperuser } from "./auth";

export const logsRouter = Router();

// Query system logs with stack traces
logsRouter.get("/", requireSuperuser, (req: Request, res: Response) => {
  try {
    const isExportAll =
      req.query.all === "true" ||
      req.query.all === "1" ||
      req.query.limit === "all" ||
      req.query.limit === "-1";
    let page = Math.max(1, parseInt(req.query.page as string) || 1);
    let limit = 50;
    let offset = 0;

    if (isExportAll) {
      limit = Math.min(100000, Math.max(1, parseInt(req.query.limit as string) || 50000));
      page = 1;
      offset = 0;
    } else {
      limit = Math.min(
        200,
        Math.max(1, parseInt(req.query.limit as string) || 50),
      );
      offset = (page - 1) * limit;
    }

    const whereClauses: string[] = [];
    const params: any[] = [];

    const level = req.query.level as string;
    if (level && level !== "ALL") {
      whereClauses.push("level = ?");
      params.push(level.toUpperCase());
    }

    const search = req.query.search as string;
    if (search && search.trim()) {
      whereClauses.push(
        "(path LIKE ? OR error_message LIKE ? OR stack_trace LIKE ? OR metadata_json LIKE ?)",
      );
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const excludeSuperusers = req.query.includeSuperusers === "false";
    if (excludeSuperusers) {
      whereClauses.push(
        `((metadata_json IS NULL OR (metadata_json NOT LIKE '%"isSuperuser":true%' AND metadata_json NOT LIKE '%"role":"admin"%'))
          AND path NOT LIKE '/api/hooks%'
          AND path NOT LIKE '/api/settings%'
          AND path NOT LIKE '/api/backups%'
          AND path NOT LIKE '/api/auth/superusers%')`,
      );
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM _logs ${whereSql}`)
      .get(...params) as { total: number };
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const rows = db
      .prepare(
        `
      SELECT * FROM _logs
      ${whereSql}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `,
      )
      .all(...params, limit, offset) as any[];

    // Ensure any oversized metadata string is trimmed for safety
    const safeRows = rows.map((r) => {
      if (r.metadata_json && r.metadata_json.length > 3000) {
        return {
          ...r,
          metadata_json: r.metadata_json.substring(0, 3000) + "... [truncated]",
        };
      }
      return r;
    });

    res.json({
      page,
      limit,
      total,
      totalPages,
      items: safeRows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logs timeline distribution (hourly buckets)
logsRouter.get(
  "/timeline",
  requireSuperuser,
  (_req: Request, res: Response) => {
    try {
      const rows = db
        .prepare(
          `
      SELECT 
        strftime('%Y-%m-%d %H:00:00', timestamp) as time_bucket,
        COUNT(*) as total,
        SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) as errors
      FROM _logs
      WHERE timestamp >= datetime('now', '-7 days')
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `,
        )
        .all() as { time_bucket: string; total: number; errors: number }[];

      res.json({ timeline: rows });
    } catch (err: any) {
      res.json({ timeline: [] });
    }
  },
);

// Logs summary stats
logsRouter.get("/stats", requireSuperuser, (_req: Request, res: Response) => {
  const totalLogs =
    (db.prepare("SELECT COUNT(*) as count FROM _logs").get() as any)?.count ||
    0;
  const errorLogs =
    (
      db
        .prepare("SELECT COUNT(*) as count FROM _logs WHERE level = 'ERROR'")
        .get() as any
    )?.count || 0;
  const warnLogs =
    (
      db
        .prepare("SELECT COUNT(*) as count FROM _logs WHERE level = 'WARN'")
        .get() as any
    )?.count || 0;
  const infoLogs =
    (
      db
        .prepare("SELECT COUNT(*) as count FROM _logs WHERE level = 'INFO'")
        .get() as any
    )?.count || 0;
  const avgDuration =
    (
      db
        .prepare(
          "SELECT AVG(duration_ms) as avg FROM _logs WHERE duration_ms IS NOT NULL",
        )
        .get() as any
    )?.avg || 0;

  res.json({
    total: totalLogs,
    error: errorLogs,
    warn: warnLogs,
    info: infoLogs,
    avgDurationMs: Number(avgDuration.toFixed(2)),
  });
});

// Delete logs batch (by IDs or all matching)
logsRouter.post(
  "/delete-batch",
  requireSuperuser,
  (req: Request, res: Response) => {
    const { ids, all, level, search, includeSuperusers } = req.body;
    if (all) {
      const whereClauses: string[] = [];
      const params: any[] = [];
      if (level && level !== "ALL") {
        whereClauses.push("level = ?");
        params.push(level.toUpperCase());
      }
      if (search && search.trim()) {
        whereClauses.push(
          "(path LIKE ? OR error_message LIKE ? OR stack_trace LIKE ? OR metadata_json LIKE ?)",
        );
        const term = `%${search.trim()}%`;
        params.push(term, term, term, term);
      }
      if (includeSuperusers === false) {
        whereClauses.push(
          `((metadata_json IS NULL OR (metadata_json NOT LIKE '%"isSuperuser":true%' AND metadata_json NOT LIKE '%"role":"admin"%'))
            AND path NOT LIKE '/api/hooks%'
            AND path NOT LIKE '/api/settings%'
            AND path NOT LIKE '/api/backups%'
            AND path NOT LIKE '/api/auth/superusers%')`,
        );
      }
      const whereSql =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      db.prepare(`DELETE FROM _logs ${whereSql}`).run(...params);
      return res.json({ success: true, message: "Matching logs deleted" });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      db.prepare(`DELETE FROM _logs WHERE id IN (${placeholders})`).run(...ids);
      return res.json({ success: true, count: ids.length });
    }

    return res.status(400).json({ error: "No logs specified for deletion" });
  },
);

// Upload / Import logs batch (JSON array or raw text)
logsRouter.post("/upload", requireSuperuser, (req: Request, res: Response) => {
  try {
    const { logs, rawContent } = req.body;
    let itemsToInsert: any[] = [];

    if (Array.isArray(logs)) {
      itemsToInsert = logs;
    } else if (typeof rawContent === "string") {
      try {
        const parsed = JSON.parse(rawContent);
        if (Array.isArray(parsed)) itemsToInsert = parsed;
        else if (parsed && typeof parsed === "object") itemsToInsert = [parsed];
      } catch {
        const lines = rawContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
        itemsToInsert = lines.map((line) => ({
          level: "INFO",
          error_message: line,
          path: "/upload",
        }));
      }
    } else if (req.body && (req.body.level || req.body.error_message || req.body.message)) {
      itemsToInsert = [req.body];
    }

    if (itemsToInsert.length === 0) {
      return res.status(400).json({ error: "No valid logs provided to import" });
    }

    const insertStmt = db.prepare(`
      INSERT INTO _logs (id, timestamp, level, method, path, status, duration_ms, error_message, stack_trace, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN");
    let count = 0;
    try {
      for (const r of itemsToInsert) {
        const id = r.id || `log_${crypto.randomBytes(8).toString("hex")}`;
        const timestamp = r.timestamp || new Date().toISOString();
        const level = (r.level || "INFO").toUpperCase();
        const method = r.method || "UPLOAD";
        const path = r.path || "/uploaded-log";
        const status = typeof r.status === "number" ? r.status : null;
        const duration_ms = typeof r.duration_ms === "number" ? r.duration_ms : null;
        const error_message = r.error_message || r.message || null;
        const stack_trace = r.stack_trace || r.stackTrace || null;
        const metadata_json =
          r.metadata_json || (r.metadata ? JSON.stringify(r.metadata) : null);

        insertStmt.run(
          id,
          timestamp,
          level,
          method,
          path,
          status,
          duration_ms,
          error_message,
          stack_trace,
          metadata_json
        );
        count++;
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    res.json({ success: true, count, message: `Successfully imported ${count} log records` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all logs
logsRouter.delete("/", requireSuperuser, (_req: Request, res: Response) => {
  db.exec("DELETE FROM _logs;");
  res.json({ success: true, message: "All logs cleared" });
});
