import { Router, Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { requireSuperuser } from "./auth";
import { getCollection } from "./schema";
import { db, DB_PATH } from "./db";
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
backupsRouter.post("/import-sqlite", requireSuperuser, (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Base64 SQLite content required" });
    }

    // Close DB, overwrite the file, then restart so Node re-opens it cleanly
    db.close();
    fs.writeFileSync(DB_PATH, Buffer.from(content, "base64"));

    // Respond before exiting so the client knows it succeeded
    res.json({ success: true, message: "SQLite database imported. Server is restarting." });
    setTimeout(() => process.exit(0), 300);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mount backups under settingsRouter as well for full backward compatibility
settingsRouter.use("/backups", backupsRouter);
