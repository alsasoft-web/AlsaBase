import { Router, Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { requireSuperuser } from "./auth";
import { getCollection, syncDatabaseCollections, initDefaultCollections, listCollections } from "./schema";
import { db, DB_PATH, reopenDatabase } from "./db";
import {
  getAllSettings,
  updateAllSettings,
  updateSettingsSection,
  getClientIp,
  sendEmail,
  AppSettings,
} from "./settings";
import {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  BACKUPS_DIR,
  setupAutoBackupScheduler,
} from "./backups";

export const settingsRouter = Router();

// Helper to compute directory size in bytes recursively
function getDirSizeBytes(dirPath: string): number {
  let total = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += getDirSizeBytes(fullPath);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(fullPath).size;
        } catch {}
      }
    }
  } catch {}
  return total;
}

// Gather comprehensive VPS and Node.js process telemetry
export function getSystemTelemetry() {
  const mem = process.memoryUsage();
  const totalHostMem = os.totalmem();
  const freeHostMem = os.freemem();
  const usedHostMem = totalHostMem - freeHostMem;
  const hostMemPercent = Math.min(
    100,
    Math.max(0, Number(((usedHostMem / totalHostMem) * 100).toFixed(1))),
  );
  const processMemPercentOfHost = Math.min(
    100,
    Math.max(0, Number(((mem.rss / totalHostMem) * 100).toFixed(2))),
  );

  const cpus = os.cpus() || [];
  const loadAvg = os.loadavg() || [0, 0, 0];

  // Database and directory metrics
  const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
  const uploadsDir = path.join(dataDir, "uploads");
  const backupsDir = path.join(dataDir, "backups");
  const publicDir =
    process.env.PUBLIC_DIR || path.resolve(process.cwd(), "_public");
  const hooksDir =
    process.env.HOOKS_DIR || path.resolve(process.cwd(), "_hooks");

  let dbSizeBytes = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      dbSizeBytes = fs.statSync(DB_PATH).size;
      if (fs.existsSync(DB_PATH + "-wal")) {
        dbSizeBytes += fs.statSync(DB_PATH + "-wal").size;
      }
    }
  } catch {}

  const uploadsSizeBytes = getDirSizeBytes(uploadsDir);
  const backupsSizeBytes = getDirSizeBytes(backupsDir);
  const publicSizeBytes = getDirSizeBytes(publicDir);
  const hooksSizeBytes = getDirSizeBytes(hooksDir);
  const totalDataSizeBytes = getDirSizeBytes(dataDir);

  // Filesystem disk stats (available in modern Node.js)
  let disk = {
    totalBytes: 0,
    freeBytes: 0,
    usedBytes: 0,
    usedPercent: 0,
    available: false,
  };

  try {
    if (typeof (fs as any).statfsSync === "function") {
      const stat = (fs as any).statfsSync(process.cwd());
      const total = Number(stat.bsize) * Number(stat.blocks);
      const free = Number(stat.bsize) * Number(stat.bfree);
      const used = total - free;
      const usedPercent =
        total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0;
      disk = {
        totalBytes: total,
        freeBytes: free,
        usedBytes: used,
        usedPercent,
        available: total > 0,
      };
    }
  } catch {}

  // Collections & Records overview
  let totalCollections = 0;
  let totalRecords = 0;
  try {
    const cols = listCollections();
    totalCollections = cols.length;
    for (const col of cols) {
      try {
        const countRow = db
          .prepare(`SELECT COUNT(*) as c FROM "${col.name}"`)
          .get() as any;
        totalRecords += countRow?.c || 0;
      } catch {}
    }
  } catch {}

  return {
    timestamp: new Date().toISOString(),
    process: {
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
      nodeVersion: process.version,
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        arrayBuffers: mem.arrayBuffers,
        percentOfHost: processMemPercentOfHost,
      },
    },
    host: {
      platform: os.platform(),
      type: os.type(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptimeSeconds: Math.floor(os.uptime()),
      memory: {
        totalBytes: totalHostMem,
        freeBytes: freeHostMem,
        usedBytes: usedHostMem,
        usedPercent: hostMemPercent,
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown CPU",
        speedMHz: cpus[0]?.speed || 0,
        loadAvg: {
          oneMin: Number(loadAvg[0]?.toFixed(2) || 0),
          fiveMin: Number(loadAvg[1]?.toFixed(2) || 0),
          fifteenMin: Number(loadAvg[2]?.toFixed(2) || 0),
        },
      },
      disk,
    },
    storage: {
      databaseBytes: dbSizeBytes,
      uploadsBytes: uploadsSizeBytes,
      backupsBytes: backupsSizeBytes,
      publicBytes: publicSizeBytes,
      hooksBytes: hooksSizeBytes,
      totalDataBytes: totalDataSizeBytes,
    },
    database: {
      totalCollections,
      totalRecords,
      walMode: true,
    },
  };
}

// 0. Live VPS & System Resource Telemetry
settingsRouter.get("/system-stats", requireSuperuser, (_req: Request, res: Response) => {
  res.json(getSystemTelemetry());
});

// 1. Get all system settings
settingsRouter.get("/", requireSuperuser, (_req: Request, res: Response) => {
  res.json(getAllSettings());
});

// 2. Update settings
settingsRouter.patch("/", requireSuperuser, (req: Request, res: Response) => {
  try {
    const updated = updateAllSettings(req.body);
    // Refresh auto-backup scheduler if backup settings changed
    if (req.body.backups) {
      setupAutoBackupScheduler();
    }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Inspect resolved user IP & detected proxy headers
settingsRouter.get("/client-ip", requireSuperuser, (req: Request, res: Response) => {
  const resolvedIp = getClientIp(req);
  const commonHeaders = [
    "x-forwarded-for",
    "fly-client-ip",
    "cf-connecting-ip",
    "x-real-ip",
    "true-client-ip",
    "fastly-client-ip",
    "x-cluster-client-ip",
  ];

  const detectedHeaders: Record<string, string> = {};
  for (const h of commonHeaders) {
    const val = req.headers[h];
    if (val && typeof val === "string") {
      detectedHeaders[h] = val;
    }
  }

  res.json({
    resolvedIp,
    rawIp: req.ip || req.socket.remoteAddress || "127.0.0.1",
    detectedHeaders,
    detectedProxyHeader: Object.keys(detectedHeaders).length > 0
      ? Object.keys(detectedHeaders).join(", ")
      : "N/A",
  });
});

// 4. Send Test Email
settingsRouter.post("/test-email", requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { toEmail } = req.body;
    if (!toEmail) {
      return res.status(400).json({ error: "Recipient email is required" });
    }

    const result = await sendEmail({
      to: toEmail,
      subject: "AlsaBase SMTP Test Email",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0284c7;">AlsaBase Email Test</h2>
          <p>Congratulations! Your AlsaBase SMTP email configuration is working successfully.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p style="font-size: 12px; color: #64748b;">Sent from your AlsaBase instance at ${new Date().toISOString()}</p>
        </div>
      `,
    });

    res.json({ success: true, message: `Test email sent to ${toEmail}.`, messageId: result.messageId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Batch Web API (POST /api/batch)
settingsRouter.post("/batch", async (req: Request, res: Response) => {
  const settings = getAllSettings();
  const batchCfg = settings.batch;

  if (!batchCfg.enabled) {
    return res.status(403).json({
      error: "Batch Web API is currently disabled in system settings.",
      code: 403,
    });
  }

  // 1. Enforce Max Body Size (MB)
  const bodySizeBytes = Buffer.byteLength(JSON.stringify(req.body || {}));
  const maxBytes = (batchCfg.maxBodySize || 15) * 1024 * 1024;
  if (bodySizeBytes > maxBytes) {
    return res.status(413).json({
      error: `Payload Too Large. Batch request size (${(bodySizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds configured limit of ${batchCfg.maxBodySize} MB.`,
      code: 413,
    });
  }

  const { requests } = req.body;
  if (!Array.isArray(requests) || requests.length === 0) {
    return res.status(400).json({ error: "Array of requests is required for batch processing." });
  }

  // 2. Enforce Max Requests per Batch
  if (requests.length > batchCfg.maxRequests) {
    return res.status(400).json({
      error: `Batch request limit exceeded. Maximum ${batchCfg.maxRequests} sub-requests allowed in a single batch (received ${requests.length}).`,
      code: 400,
    });
  }

  // 3. Enforce Max Processing Timeout
  const timeoutMs = (batchCfg.timeout || 30) * 1000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Batch processing exceeded timeout limit of ${batchCfg.timeout} seconds.`));
    }, timeoutMs);
  });

  const batchExecutionPromise = (async () => {
    const results: any[] = [];
    const auth = (req as any).auth;

    for (let i = 0; i < requests.length; i++) {
      const item = requests[i];
      const method = (item.method || "GET").toUpperCase();
      const rawUrl: string = item.url || "";
      const body = item.body || {};

      try {
        // Parse collection record endpoints (e.g. /api/collections/:name/records/:id)
        const match = rawUrl.match(/^\/api\/collections\/([^/]+)\/records(?:\/([^/?]+))?/);
        if (match) {
          const colName = match[1];
          const recordId = match[2];
          const col = getCollection(colName);

          if (!col) {
            results.push({
              status: 404,
              index: i,
              method,
              url: rawUrl,
              body: { error: `Collection "${colName}" not found` },
            });
            continue;
          }

          if (method === "POST") {
            // Create record
            const id = body.id || crypto.randomUUID();
            const now = new Date().toISOString();
            const recordData: Record<string, any> = { id, created_at: now, updated_at: now };
            const fields = col.fields || [];

            for (const f of fields) {
              if (body[f.name] !== undefined) {
                recordData[f.name] = body[f.name];
              }
            }

            const keys = Object.keys(recordData);
            const placeholders = keys.map(() => "?").join(", ");
            const values = Object.values(recordData);
            db.prepare(`INSERT INTO "${colName}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders})`).run(...values);

            results.push({
              status: 201,
              index: i,
              method,
              url: rawUrl,
              body: recordData,
            });
          } else if (method === "PATCH" && recordId) {
            // Update record
            const now = new Date().toISOString();
            const updateKeys = Object.keys(body).filter((k) => k !== "id" && k !== "created_at");
            if (updateKeys.length > 0) {
              const setClauses = updateKeys.map((k) => `"${k}" = ?`).join(", ") + ', "updated_at" = ?';
              const values = updateKeys.map((k) => body[k]);
              values.push(now, recordId);
              db.prepare(`UPDATE "${colName}" SET ${setClauses} WHERE id = ?`).run(...values);
            }
            const updatedRow = db.prepare(`SELECT * FROM "${colName}" WHERE id = ?`).get(recordId);
            results.push({
              status: 200,
              index: i,
              method,
              url: rawUrl,
              body: updatedRow,
            });
          } else if (method === "DELETE" && recordId) {
            // Delete record
            db.prepare(`DELETE FROM "${colName}" WHERE id = ?`).run(recordId);
            results.push({
              status: 204,
              index: i,
              method,
              url: rawUrl,
              body: { success: true },
            });
          } else if (method === "GET" && recordId) {
            // View single record
            const row = db.prepare(`SELECT * FROM "${colName}" WHERE id = ?`).get(recordId);
            results.push({
              status: row ? 200 : 404,
              index: i,
              method,
              url: rawUrl,
              body: row || { error: "Record not found" },
            });
          } else {
            // List records
            const rows = db.prepare(`SELECT * FROM "${colName}" LIMIT 100`).all();
            results.push({
              status: 200,
              index: i,
              method,
              url: rawUrl,
              body: { items: rows, total: rows.length },
            });
          }
        } else {
          // General sub-request response
          results.push({
            status: 200,
            index: i,
            method,
            url: rawUrl,
            body: { success: true, processed: true },
          });
        }
      } catch (subErr: any) {
        results.push({
          status: 400,
          index: i,
          method,
          url: rawUrl,
          body: { error: subErr.message },
        });
      }
    }

    return results;
  })();

  try {
    const results = await Promise.race([batchExecutionPromise, timeoutPromise]);
    res.json({
      total: results.length,
      responses: results,
    });
  } catch (err: any) {
    res.status(504).json({ error: err.message, code: 504 });
  }
});

// --- BACKUPS API ---
export const backupsRouter = Router();

// 6. List backups
backupsRouter.get("/", requireSuperuser, (_req: Request, res: Response) => {
  try {
    const list = listBackups();
    res.json({ items: list, total: list.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Create backup
backupsRouter.post("/", requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { name, includePublic, includeHooks } = req.body;
    const meta = await createBackup({ name, includePublic, includeHooks });
    res.status(201).json(meta);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Download backup
backupsRouter.get("/:filename/download", requireSuperuser, (req: Request, res: Response) => {
  const rawFilename = req.params.filename;
  const filename = path.basename(Array.isArray(rawFilename) ? rawFilename[0] : rawFilename);
  const zipPath = path.join(BACKUPS_DIR, filename);

  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: `Backup "${filename}" not found.` });
  }

  res.download(zipPath, filename);
});

// 9. Restore backup
backupsRouter.post("/:filename/restore", requireSuperuser, async (req: Request, res: Response) => {
  try {
    const rawFilename = req.params.filename;
    const filename = path.basename(Array.isArray(rawFilename) ? rawFilename[0] : rawFilename);
    const result = await restoreBackup(filename);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Delete backup
backupsRouter.delete("/:filename", requireSuperuser, (req: Request, res: Response) => {
  try {
    const rawFilename = req.params.filename;
    const filename = path.basename(Array.isArray(rawFilename) ? rawFilename[0] : rawFilename);
    const result = deleteBackup(filename);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Upload external backup .zip file
backupsRouter.post("/upload", requireSuperuser, (req: Request, res: Response) => {
  try {
    const { name, content, isBase64 } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: "Filename and content required" });
    }

    const cleanName = path.basename(name);
    const zipPath = path.join(BACKUPS_DIR, cleanName);

    if (isBase64) {
      fs.writeFileSync(zipPath, Buffer.from(content, "base64"));
    } else {
      fs.writeFileSync(zipPath, content);
    }

    res.status(201).json({ success: true, filename: cleanName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Import raw SQLite file
backupsRouter.post("/import-sqlite", requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Base64 SQLite content required" });
    }

    const buf = Buffer.from(content, "base64");
    if (buf.length < 16) {
      return res.status(400).json({ error: "Invalid SQLite file size" });
    }

    const header = buf.subarray(0, 16).toString("utf8");
    if (!header.startsWith("SQLite format 3")) {
      return res.status(400).json({ error: "Uploaded file is not a valid SQLite database (header mismatch)" });
    }

    // Safe backup of current database to .trash
    const trashDir = path.resolve(process.cwd(), ".trash");
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }
    if (fs.existsSync(DB_PATH)) {
      const backupPath = path.join(trashDir, `${Date.now()}_pre_import_alsabase.sqlite`);
      fs.copyFileSync(DB_PATH, backupPath);
    }

    // Close and remove WAL & SHM files before writing new database file
    db.close();
    if (fs.existsSync(DB_PATH + "-wal")) {
      try { fs.unlinkSync(DB_PATH + "-wal"); } catch {}
    }
    if (fs.existsSync(DB_PATH + "-shm")) {
      try { fs.unlinkSync(DB_PATH + "-shm"); } catch {}
    }

    // Overwrite the database file
    fs.writeFileSync(DB_PATH, buf);

    // Reopen database connection cleanly in-process
    reopenDatabase();

    // Migrate/sync collections from SQLite tables
    syncDatabaseCollections();
    initDefaultCollections();

    const collections = listCollections();

    // Respond with success and loaded collections count
    res.json({
      success: true,
      message: `SQLite database imported successfully. Loaded ${collections.length} collection(s).`,
      totalCollections: collections.length,
    });
  } catch (err: any) {
    console.error("[Backups:ImportSQLite] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Mount backups under settingsRouter as well for full backward compatibility
settingsRouter.use("/backups", backupsRouter);
