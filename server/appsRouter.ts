import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db";
import { requireSuperuser, AuthPayload } from "./auth";
import { FILES_DIR, MIME_TYPES } from "./files";
import { broadcastCustomEvent } from "./events";

export const appsRouter = Router();

const APP_RELEASES_DIR = path.join(FILES_DIR, "_app_releases");
if (!fs.existsSync(APP_RELEASES_DIR)) {
  fs.mkdirSync(APP_RELEASES_DIR, { recursive: true });
}

const APP_ICONS_DIR = path.join(FILES_DIR, "_app_icons");
if (!fs.existsSync(APP_ICONS_DIR)) {
  fs.mkdirSync(APP_ICONS_DIR, { recursive: true });
}

export const RESERVED_SLUGS = new Set([
  "manage",
  "download",
  "api",
  "public",
  "check-update",
  "versions",
  "icon",
  "releases",
]);

export function saveAppIcon(appSlug: string, iconPayload: any): string | null {
  if (!iconPayload) return null;

  let fileBuffer: Buffer | null = null;
  let origName = "icon.png";

  if (typeof iconPayload === "object" && iconPayload.data) {
    origName = iconPayload.name || "icon.png";
    const rawData = String(iconPayload.data);
    const base64Data = rawData.includes(";base64,") ? rawData.split(";base64,")[1] : rawData;
    fileBuffer = Buffer.from(base64Data, "base64");
  } else if (typeof iconPayload === "string" && (iconPayload.startsWith("data:") || iconPayload.length > 200)) {
    const base64Data = iconPayload.includes(";base64,") ? iconPayload.split(";base64,")[1] : iconPayload;
    fileBuffer = Buffer.from(base64Data, "base64");
  }

  if (fileBuffer) {
    const ext = path.extname(origName).toLowerCase() || ".png";
    const filename = `icon_${crypto.randomBytes(4).toString("hex")}${ext}`;
    const targetDir = path.join(APP_ICONS_DIR, appSlug);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = path.join(targetDir, filename);
    fs.writeFileSync(targetPath, fileBuffer);
    return `/api/apps/${encodeURIComponent(appSlug)}/icon/${filename}`;
  }

  if (
    typeof iconPayload === "string" &&
    (iconPayload.startsWith("http://") || iconPayload.startsWith("https://") || iconPayload.startsWith("/api/"))
  ) {
    return iconPayload;
  }

  return null;
}

export interface AppRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon_url?: string | null;
  webhook_url?: string | null;
  webhook_secret?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Dispatches an outgoing HTTP webhook notification to the app's configured webhook URL.
 */
export async function dispatchAppWebhook(
  app: AppRecord,
  event: string,
  release: any
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  if (!app.webhook_url || !app.webhook_url.trim()) {
    return { success: false, error: "No webhook URL configured for this app" };
  }

  const payload = {
    event,
    app: {
      id: app.id,
      name: app.name,
      slug: app.slug,
    },
    release,
    timestamp: new Date().toISOString(),
  };

  const payloadJson = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "AlsaBase-Release-Webhook/1.0",
    "X-AlsaBase-Event": event,
    "X-AlsaBase-App": app.slug,
  };

  if (app.webhook_secret && app.webhook_secret.trim()) {
    const signature = crypto
      .createHmac("sha256", app.webhook_secret.trim())
      .update(payloadJson)
      .digest("hex");
    headers["X-AlsaBase-Signature"] = `sha256=${signature}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(app.webhook_url.trim(), {
      method: "POST",
      headers,
      body: payloadJson,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return {
      success: resp.ok,
      statusCode: resp.status,
      error: resp.ok ? undefined : `HTTP ${resp.status} ${resp.statusText}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.name === "AbortError" ? "Webhook request timed out after 10s" : err.message,
    };
  }
}

export interface AppReleaseRecord {
  id: string;
  app_id: string;
  app_slug: string;
  version: string;
  build_number: number;
  importance: "automatic" | "mandatory" | "optional";
  channel: string;
  target_collection?: string | null;
  target_column?: string | null;
  target_value?: string | null;
  target_operator?: string | null;
  platform: string;
  file_name?: string | null;
  file_path?: string | null;
  file_size: number;
  file_hash?: string | null;
  release_notes?: string | null;
  min_os_version?: string | null;
  is_active: number;
  download_count: number;
  created_at: string;
  updated_at: string;
}

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || "";
  return param || "";
}

/**
 * Semver comparison utility.
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const clean = (v: string) => v.trim().replace(/^[vV]/, "");
  const s1 = clean(v1);
  const s2 = clean(v2);

  if (s1 === s2) return 0;

  const [main1, prerelease1] = s1.split("-");
  const [main2, prerelease2] = s2.split("-");

  const parts1 = (main1 || "").split(".").map((p) => parseInt(p, 10) || 0);
  const parts2 = (main2 || "").split(".").map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] !== undefined ? parts1[i] : 0;
    const num2 = parts2[i] !== undefined ? parts2[i] : 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  // If main versions are identical, version without prerelease is newer than prerelease
  // e.g. 1.0.0 > 1.0.0-beta.1
  if (!prerelease1 && prerelease2) return 1;
  if (prerelease1 && !prerelease2) return -1;
  if (prerelease1 && prerelease2) {
    return prerelease1.localeCompare(prerelease2, undefined, { numeric: true, sensitivity: "base" });
  }

  return 0;
}

function formatReleaseResponse(req: Request, r: AppReleaseRecord, appSlug: string) {
  const protocol = req.protocol;
  const host = req.get("host") || "localhost";
  const baseUrl = `${protocol}://${host}`;
  const downloadUrl = `/api/apps/${appSlug}/versions/${r.version}/download`;

  const isAuto = r.importance === "automatic" || r.importance === "mandatory";

  return {
    id: r.id,
    appId: r.app_id,
    appSlug: r.app_slug,
    version: r.version,
    buildNumber: r.build_number,
    importance: isAuto ? "automatic" : "optional",
    isAutomatic: isAuto,
    isMandatory: isAuto,
    channel: r.channel || "latest",
    platform: r.platform || "all",
    fileName: r.file_name || null,
    fileSize: r.file_size || 0,
    fileHash: r.file_hash || null,
    downloadUrl,
    fullDownloadUrl: `${baseUrl}${downloadUrl}`,
    releaseNotes: r.release_notes || null,
    minOsVersion: r.min_os_version || null,
    isActive: Boolean(r.is_active),
    downloadCount: r.download_count || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ============================================================================
// 1. Superuser Management Routes (Defined FIRST to prevent /:slug route conflicts)
// ============================================================================

/**
 * GET /api/apps/manage/apps
 * List all apps with detailed stats
 */
appsRouter.get("/manage/apps", requireSuperuser, (_req: Request, res: Response) => {
  try {
    const apps = db.prepare("SELECT * FROM _apps ORDER BY created_at DESC").all() as unknown as AppRecord[];

    const results = apps.map((app) => {
      const stats = db
        .prepare(
          `SELECT 
            COUNT(*) as total_releases,
            SUM(download_count) as total_downloads,
            SUM(file_size) as total_storage_bytes
           FROM _app_releases 
           WHERE app_id = ?`
        )
        .get(app.id) as unknown as { total_releases: number; total_downloads: number; total_storage_bytes: number };

      const latest = db
        .prepare(
          `SELECT version, build_number, importance, channel, created_at 
           FROM _app_releases 
           WHERE app_id = ? 
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(app.id) as any;

      return {
        id: app.id,
        name: app.name,
        slug: app.slug,
        description: app.description || "",
        iconUrl: app.icon_url || null,
        webhookUrl: app.webhook_url || null,
        webhookSecret: app.webhook_secret || null,
        totalReleases: stats?.total_releases || 0,
        totalDownloads: stats?.total_downloads || 0,
        totalStorageBytes: stats?.total_storage_bytes || 0,
        latestVersion: latest?.version || null,
        latestImportance: latest?.importance || null,
        latestChannel: latest?.channel || null,
        latestReleaseAt: latest?.created_at || null,
        createdAt: app.created_at,
        updatedAt: app.updated_at,
      };
    });

    res.json({ items: results, total: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/apps/manage/apps
 * Create a new app
 */
appsRouter.post("/manage/apps", requireSuperuser, (req: Request, res: Response) => {
  try {
    const { name, slug, description, iconUrl, iconFile, webhookUrl, webhookSecret } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "App name is required" });
    }

    const cleanSlug = (slug || name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug) {
      return res.status(400).json({ error: "Valid app slug identifier is required" });
    }

    if (RESERVED_SLUGS.has(cleanSlug)) {
      return res.status(400).json({ error: `Slug "${cleanSlug}" is reserved and cannot be used.` });
    }

    // Check if slug already exists
    const existing = db.prepare("SELECT id FROM _apps WHERE slug = ?").get(cleanSlug);
    if (existing) {
      return res.status(400).json({ error: `An app with slug "${cleanSlug}" already exists` });
    }

    let finalIconUrl = iconUrl?.trim() || null;
    if (iconFile) {
      finalIconUrl = saveAppIcon(cleanSlug, iconFile) || finalIconUrl;
    }

    const id = `app_${crypto.randomBytes(8).toString("hex")}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO _apps (id, name, slug, description, icon_url, webhook_url, webhook_secret, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      name.trim(),
      cleanSlug,
      description?.trim() || "",
      finalIconUrl,
      webhookUrl?.trim() || null,
      webhookSecret?.trim() || null,
      now,
      now
    );

    const app = db.prepare("SELECT * FROM _apps WHERE id = ?").get(id);
    res.status(201).json(app);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/apps/manage/apps/:id
 * Update an existing app
 */
appsRouter.put("/manage/apps/:id", requireSuperuser, (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const { name, slug, description, iconUrl, iconFile, webhookUrl, webhookSecret } = req.body;

    const current = db.prepare("SELECT * FROM _apps WHERE id = ?").get(id) as unknown as AppRecord | undefined;
    if (!current) {
      return res.status(404).json({ error: "App not found" });
    }

    let finalSlug = current.slug;
    if (slug && slug.trim().toLowerCase() !== current.slug) {
      finalSlug = slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      if (RESERVED_SLUGS.has(finalSlug)) {
        return res.status(400).json({ error: `Slug "${finalSlug}" is reserved and cannot be used.` });
      }

      const existing = db.prepare("SELECT id FROM _apps WHERE slug = ? AND id != ?").get(finalSlug, id);
      if (existing) {
        return res.status(400).json({ error: `Slug "${finalSlug}" is already in use by another app` });
      }

      // Update app_slug in all releases
      db.prepare("UPDATE _app_releases SET app_slug = ? WHERE app_id = ?").run(finalSlug, id);

      // Rename icon directory if exists
      const oldIconDir = path.join(APP_ICONS_DIR, current.slug);
      const newIconDir = path.join(APP_ICONS_DIR, finalSlug);
      if (fs.existsSync(oldIconDir) && !fs.existsSync(newIconDir)) {
        try {
          fs.renameSync(oldIconDir, newIconDir);
        } catch {}
      }
    }

    let finalIcon = iconUrl !== undefined ? iconUrl?.trim() || null : current.icon_url;
    if (iconFile) {
      finalIcon = saveAppIcon(finalSlug, iconFile) || finalIcon;
    }

    const finalName = name?.trim() || current.name;
    const finalDesc = description !== undefined ? description?.trim() || "" : current.description;
    const finalWebhookUrl = webhookUrl !== undefined ? webhookUrl?.trim() || null : current.webhook_url;
    const finalWebhookSecret = webhookSecret !== undefined ? webhookSecret?.trim() || null : current.webhook_secret;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE _apps 
       SET name = ?, slug = ?, description = ?, icon_url = ?, webhook_url = ?, webhook_secret = ?, updated_at = ?
       WHERE id = ?`
    ).run(finalName, finalSlug, finalDesc, finalIcon, finalWebhookUrl, finalWebhookSecret, now, id);

    const updated = db.prepare("SELECT * FROM _apps WHERE id = ?").get(id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/apps/manage/apps/:id/test-webhook
 * Trigger a test webhook dispatch to verify receiver endpoint
 */
appsRouter.post("/manage/apps/:id/test-webhook", requireSuperuser, async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const app = db
      .prepare("SELECT * FROM _apps WHERE id = ? OR slug = ?")
      .get(id, id) as unknown as AppRecord | undefined;

    if (!app) {
      return res.status(404).json({ error: "App not found" });
    }

    if (!app.webhook_url || !app.webhook_url.trim()) {
      return res.status(400).json({ error: "No webhook URL configured for this app. Please configure a Webhook URL first." });
    }

    const testRelease = {
      id: "rel_sample_test",
      version: "1.0.0-test",
      buildNumber: 1,
      importance: "optional",
      channel: "stable",
      platform: "all",
      fileName: `${app.slug}-1.0.0-test.zip`,
      fileSize: 1048576,
      releaseNotes: "This is a test release webhook event emitted by AlsaBase to verify the webhook receiver endpoint.",
      createdAt: new Date().toISOString(),
    };

    const result = await dispatchAppWebhook(app, "app.release.test", testRelease);
    if (result.success) {
      res.json({
        success: true,
        statusCode: result.statusCode,
        message: `Webhook sent and acknowledged successfully (HTTP ${result.statusCode})`,
      });
    } else {
      res.status(400).json({
        success: false,
        statusCode: result.statusCode,
        error: result.error || "Failed to deliver webhook",
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/apps/manage/apps/:id
 * Delete an app, all its releases, and physical files on disk
 */
appsRouter.delete("/manage/apps/:id", requireSuperuser, (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const app = db.prepare("SELECT * FROM _apps WHERE id = ?").get(id) as unknown as AppRecord | undefined;

    if (!app) {
      return res.status(404).json({ error: "App not found" });
    }

    // Clean up physical releases and icons files on disk
    try {
      const appFilesDir = path.join(APP_RELEASES_DIR, app.slug);
      if (fs.existsSync(appFilesDir)) {
        fs.rmSync(appFilesDir, { recursive: true, force: true });
      }
    } catch (fsErr: any) {
      console.warn(`[AppReleases] Warning deleting files for app ${app.slug}:`, fsErr.message);
    }

    try {
      const appIconsDir = path.join(APP_ICONS_DIR, app.slug);
      if (fs.existsSync(appIconsDir)) {
        fs.rmSync(appIconsDir, { recursive: true, force: true });
      }
    } catch (fsErr: any) {
      console.warn(`[AppReleases] Warning deleting icons for app ${app.slug}:`, fsErr.message);
    }

    // Delete releases & app from SQLite
    db.prepare("DELETE FROM _app_releases WHERE app_id = ?").run(id);
    db.prepare("DELETE FROM _apps WHERE id = ?").run(id);

    res.json({ success: true, message: `App "${app.name}" and its versions deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/apps/manage/versions
 * List all releases across all apps or for a specific app
 */
appsRouter.get("/manage/versions", requireSuperuser, (req: Request, res: Response) => {
  try {
    const appId = req.query.appId as string;
    const appSlug = req.query.appSlug as string;

    let sql = `SELECT * FROM _app_releases`;
    const params: any[] = [];

    if (appId) {
      sql += ` WHERE app_id = ?`;
      params.push(appId);
    } else if (appSlug) {
      sql += ` WHERE app_slug = ?`;
      params.push(appSlug);
    }

    sql += ` ORDER BY created_at DESC`;

    const releases = db.prepare(sql).all(...params) as unknown as AppReleaseRecord[];
    const items = releases.map((r) => formatReleaseResponse(req, r, r.app_slug));

    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/apps/manage/versions
 * Upload / Publish a new app version using superuser credentials
 */
appsRouter.post("/manage/versions", requireSuperuser, (req: Request, res: Response) => {
  try {
    const {
      appId,
      appSlug,
      appName,
      version,
      buildNumber = 1,
      importance = "optional",
      channel = "latest",
      platform = "all",
      releaseNotes,
      minOsVersion,
      isActive = true,
      file, // { name: string, data: string, size?: number, type?: string }
    } = req.body;

    if (!version || !version.trim()) {
      return res.status(400).json({ error: "Version string (e.g. '1.0.0') is required" });
    }

    // Resolve or auto-create app
    let app: AppRecord | undefined;
    if (appId) {
      app = db.prepare("SELECT * FROM _apps WHERE id = ? OR slug = ?").get(appId, appId) as unknown as AppRecord | undefined;
    } else if (appSlug) {
      app = db.prepare("SELECT * FROM _apps WHERE slug = ?").get(appSlug.trim().toLowerCase()) as unknown as AppRecord | undefined;
    }

    if (!app && appName) {
      // Auto-create app if appName provided
      const slug = (appSlug || appName)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      if (RESERVED_SLUGS.has(slug)) {
        return res.status(400).json({ error: `Slug "${slug}" is reserved and cannot be used.` });
      }

      const id = `app_${crypto.randomBytes(8).toString("hex")}`;
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO _apps (id, name, slug, description, icon_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, appName.trim(), slug, "", null, now, now);

      app = db.prepare("SELECT * FROM _apps WHERE id = ?").get(id) as unknown as AppRecord;
    }

    if (!app) {
      return res.status(400).json({ error: "App not found. Provide a valid appId, appSlug, or appName." });
    }

    const cleanVersion = version.trim();
    const cleanImportance =
      importance === "automatic" || importance === "mandatory" ? "automatic" : "optional";

    // Handle file upload
    let savedFileName: string | null = null;
    let savedFilePath: string | null = null;
    let savedFileSize = 0;
    let savedFileHash: string | null = null;

    if (file) {
      let fileBuffer: Buffer | null = null;
      let origName = "binary";

      if (typeof file === "object" && file.data) {
        origName = file.name || "binary";
        const rawData = String(file.data);
        const base64Data = rawData.includes(";base64,") ? rawData.split(";base64,")[1] : rawData;
        fileBuffer = Buffer.from(base64Data, "base64");
      } else if (typeof file === "string" && (file.startsWith("data:") || file.length > 200)) {
        const base64Data = file.includes(";base64,") ? file.split(";base64,")[1] : file;
        fileBuffer = Buffer.from(base64Data, "base64");
      }

      if (fileBuffer) {
        const ext = path.extname(origName) || "";
        const base = path.parse(origName).name.replace(/[^a-zA-Z0-9_-]/g, "_") || "release";
        savedFileName = `${base}_${cleanVersion}${ext}`;
        const targetDir = path.join(APP_RELEASES_DIR, app.slug, cleanVersion);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        savedFilePath = path.join(targetDir, savedFileName);
        fs.writeFileSync(savedFilePath, fileBuffer);
        savedFileSize = fileBuffer.length;
        savedFileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
      }
    }

    const releaseId = `rel_${crypto.randomBytes(8).toString("hex")}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO _app_releases (
        id, app_id, app_slug, version, build_number, importance, channel,
        target_collection, target_column, target_value, target_operator,
        platform, file_name, file_path, file_size, file_hash,
        release_notes, min_os_version, is_active, download_count,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        NULL, NULL, NULL, NULL,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )`
    ).run(
      releaseId,
      app.id,
      app.slug,
      cleanVersion,
      parseInt(String(buildNumber), 10) || 1,
      cleanImportance,
      (channel || "latest").trim().toLowerCase(),
      (platform || "all").trim().toLowerCase(),
      savedFileName,
      savedFilePath,
      savedFileSize,
      savedFileHash,
      releaseNotes?.trim() || null,
      minOsVersion?.trim() || null,
      isActive ? 1 : 0,
      0,
      now,
      now
    );

    const created = db.prepare("SELECT * FROM _app_releases WHERE id = ?").get(releaseId) as unknown as AppReleaseRecord;
    const formatted = formatReleaseResponse(req, created, app.slug);

    // 1. Broadcast real-time release event to all connected SDK/client subscribers (WebSocket & SSE)
    const eventPayload = {
      event: "app.release.created",
      app: {
        id: app.id,
        name: app.name,
        slug: app.slug,
      },
      release: formatted,
      timestamp: now,
    };
    try {
      broadcastCustomEvent(`apps/${app.slug}`, eventPayload, "new_release");
      broadcastCustomEvent("apps", eventPayload, "new_release");
    } catch (e: any) {
      console.warn("[Apps] Error broadcasting realtime release event:", e.message);
    }

    // 2. Dispatch outgoing webhook to configured URL if present
    if (app.webhook_url) {
      dispatchAppWebhook(app, "app.release.created", formatted).catch((webhookErr) => {
        console.warn(`[Apps Webhook] Failed to deliver webhook for ${app.slug}:`, webhookErr.message);
      });
    }

    res.status(201).json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/apps/manage/versions/:id
 * Update release metadata
 */
appsRouter.put("/manage/versions/:id", requireSuperuser, (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const current = db.prepare("SELECT * FROM _app_releases WHERE id = ?").get(id) as unknown as AppReleaseRecord | undefined;

    if (!current) {
      return res.status(404).json({ error: "Release not found" });
    }

    const {
      importance,
      channel,
      platform,
      releaseNotes,
      minOsVersion,
      isActive,
      buildNumber,
    } = req.body;

    const finalImportance =
      importance !== undefined
        ? importance === "automatic" || importance === "mandatory"
          ? "automatic"
          : "optional"
        : current.importance;

    const finalChannel = channel !== undefined ? channel.trim().toLowerCase() : current.channel;
    const finalPlatform = platform !== undefined ? platform.trim().toLowerCase() : current.platform;
    const finalNotes = releaseNotes !== undefined ? releaseNotes?.trim() || null : current.release_notes;
    const finalMinOs = minOsVersion !== undefined ? minOsVersion?.trim() || null : current.min_os_version;
    const finalActive = isActive !== undefined ? (isActive ? 1 : 0) : current.is_active;
    const finalBuild = buildNumber !== undefined ? parseInt(String(buildNumber), 10) || current.build_number : current.build_number;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE _app_releases 
       SET importance = ?, channel = ?, platform = ?, release_notes = ?,
           min_os_version = ?, is_active = ?, build_number = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      finalImportance,
      finalChannel,
      finalPlatform,
      finalNotes,
      finalMinOs,
      finalActive,
      finalBuild,
      now,
      id
    );

    const updated = db.prepare("SELECT * FROM _app_releases WHERE id = ?").get(id) as unknown as AppReleaseRecord;
    res.json(formatReleaseResponse(req, updated, current.app_slug));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/apps/manage/versions/:id
 * Delete a release and its physical binary file on disk
 */
appsRouter.delete("/manage/versions/:id", requireSuperuser, (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const current = db.prepare("SELECT * FROM _app_releases WHERE id = ?").get(id) as unknown as AppReleaseRecord | undefined;

    if (!current) {
      return res.status(404).json({ error: "Release not found" });
    }

    // Clean up physical file on disk
    if (current.file_path && fs.existsSync(current.file_path)) {
      try {
        fs.unlinkSync(current.file_path);
        const parentDir = path.dirname(current.file_path);
        if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
          fs.rmdirSync(parentDir);
        }
      } catch (fsErr: any) {
        console.warn(`[AppReleases] Warning deleting file for release ${id}:`, fsErr.message);
      }
    }

    db.prepare("DELETE FROM _app_releases WHERE id = ?").run(id);

    res.json({ success: true, message: `Version "${current.version}" deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 2. Standalone Download Routes
// ============================================================================

/**
 * GET /api/apps/download/:id
 * Direct download by release ID
 */
appsRouter.get("/download/:id", (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id).trim();
    const release = db
      .prepare("SELECT * FROM _app_releases WHERE id = ? LIMIT 1")
      .get(id) as unknown as AppReleaseRecord | undefined;

    if (!release) {
      return res.status(404).json({ error: "Release not found" });
    }

    if (!release.is_active) {
      return res.status(403).json({ error: "Access denied: this release is inactive" });
    }

    if (!release.file_path || !fs.existsSync(release.file_path)) {
      return res.status(404).json({ error: "Release binary file is missing on server" });
    }

    try {
      db.prepare("UPDATE _app_releases SET download_count = download_count + 1 WHERE id = ?").run(release.id);
    } catch {}

    const fileName = release.file_name || `${release.app_slug || "app"}-${release.version}`;
    const ext = path.extname(release.file_path).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", release.file_size);
    res.sendFile(path.resolve(release.file_path));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 3. Public Applications List
// ============================================================================

/**
 * GET /api/apps
 * List active applications
 */
appsRouter.get("/", (_req: Request, res: Response) => {
  try {
    const apps = db.prepare("SELECT * FROM _apps ORDER BY name ASC").all() as unknown as AppRecord[];

    const results = apps.map((app) => {
      const stats = db
        .prepare(
          `SELECT 
            COUNT(*) as total_releases,
            SUM(download_count) as total_downloads
           FROM _app_releases 
           WHERE app_id = ? AND is_active = 1`
        )
        .get(app.id) as unknown as { total_releases: number; total_downloads: number };

      const latest = db
        .prepare(
          `SELECT version, build_number, created_at 
           FROM _app_releases 
           WHERE app_id = ? AND is_active = 1 
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(app.id) as unknown as { version: string; build_number: number; created_at: string } | undefined;

      return {
        id: app.id,
        name: app.name,
        slug: app.slug,
        description: app.description || "",
        iconUrl: app.icon_url || null,
        totalReleases: stats?.total_releases || 0,
        totalDownloads: stats?.total_downloads || 0,
        latestVersion: latest?.version || null,
        latestReleaseAt: latest?.created_at || null,
        createdAt: app.created_at,
        updatedAt: app.updated_at,
      };
    });

    res.json({ items: results, total: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 4. Dynamic /:slug Routes (Registered AFTER specific /manage routes)
// ============================================================================

/**
 * GET /api/apps/:slug/icon/:filename
 * Serve uploaded app icon image file
 */
appsRouter.get("/:slug/icon/:filename", (req: Request, res: Response) => {
  try {
    const slug = getParam(req.params.slug).trim().toLowerCase();
    const filename = getParam(req.params.filename).trim();
    const filePath = path.join(APP_ICONS_DIR, slug, filename);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(APP_ICONS_DIR)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: "Icon not found" });
    }
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(resolved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/apps/:slug/icon
 * Serve app icon
 */
appsRouter.get("/:slug/icon", (req: Request, res: Response) => {
  try {
    const slug = getParam(req.params.slug).trim().toLowerCase();
    const app = db
      .prepare("SELECT * FROM _apps WHERE slug = ? OR id = ? LIMIT 1")
      .get(slug, slug) as unknown as AppRecord | undefined;
    if (!app || !app.icon_url) {
      return res.status(404).json({ error: "App icon not found" });
    }
    if (app.icon_url.startsWith("http://") || app.icon_url.startsWith("https://")) {
      return res.redirect(app.icon_url);
    }
    if (app.icon_url.includes("/icon/")) {
      const parts = app.icon_url.split("/");
      const filename = parts[parts.length - 1];
      const filePath = path.join(APP_ICONS_DIR, app.slug, filename);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", MIME_TYPES[ext] || "image/png");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.sendFile(path.resolve(filePath));
      }
    }
    res.status(404).json({ error: "Icon not found" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/apps/:slug/check-update
 * Check if an update is available for an app.
 * Evaluates semver, platform, channel, and target column rules (e.g. beta/alpha user targeting).
 */
appsRouter.get("/:slug/check-update", (req: Request, res: Response) => {
  try {
    const slug = getParam(req.params.slug).trim().toLowerCase();
    if (RESERVED_SLUGS.has(slug)) {
      return res.status(404).json({ error: "App not found" });
    }

    const app = db
      .prepare("SELECT * FROM _apps WHERE slug = ? OR id = ? LIMIT 1")
      .get(slug, slug) as unknown as AppRecord | undefined;

    if (!app) {
      return res.status(404).json({ error: `App "${slug}" not found` });
    }

    const currentVersion = (req.query.currentVersion as string)?.trim() || "0.0.0";
    const platform = (req.query.platform as string)?.trim().toLowerCase() || "all";
    const channel = (req.query.channel as string)?.trim().toLowerCase();

    // Fetch all active releases for this app
    let sql = `SELECT * FROM _app_releases WHERE app_id = ? AND is_active = 1`;
    const params: any[] = [app.id];

    if (platform && platform !== "all") {
      sql += ` AND (platform = 'all' OR platform = ?)`;
      params.push(platform);
    }

    if (channel) {
      sql += ` AND (channel = ? OR channel = 'all' OR channel = 'latest')`;
      params.push(channel);
    }

    const eligibleReleases = db.prepare(sql).all(...params) as unknown as AppReleaseRecord[];

    if (eligibleReleases.length === 0) {
      return res.json({
        updateAvailable: false,
        hasUpdate: false,
        currentVersion,
        latestVersion: null,
        importance: null,
        isAutomatic: false,
        isMandatory: false,
        version: null,
      });
    }

    // Sort eligible releases by semver descending
    eligibleReleases.sort((a, b) => {
      const cmp = compareVersions(b.version, a.version);
      if (cmp !== 0) return cmp;
      return (b.build_number || 0) - (a.build_number || 0);
    });

    const newest = eligibleReleases[0];
    const isNewer = compareVersions(newest.version, currentVersion) > 0;

    if (!isNewer) {
      return res.json({
        updateAvailable: false,
        hasUpdate: false,
        currentVersion,
        latestVersion: newest.version,
        importance: null,
        isAutomatic: false,
        isMandatory: false,
        version: null,
      });
    }

    // Find all eligible releases between currentVersion and newest.version
    // If any release in between was automatic/mandatory, mark update as automatic!
    const intermediateReleases = eligibleReleases.filter(
      (r) => compareVersions(r.version, currentVersion) > 0 && compareVersions(newest.version, r.version) >= 0
    );

    const hasAutomatic = intermediateReleases.some(
      (r) => r.importance === "automatic" || r.importance === "mandatory"
    );

    const importance = hasAutomatic ? "automatic" : "optional";
    const formatted = formatReleaseResponse(req, newest, app.slug);

    res.json({
      updateAvailable: true,
      hasUpdate: true,
      currentVersion,
      latestVersion: newest.version,
      importance,
      isAutomatic: hasAutomatic,
      isMandatory: hasAutomatic,
      releaseNotes: newest.release_notes || null,
      downloadUrl: formatted.downloadUrl,
      version: {
        ...formatted,
        importance,
        isAutomatic: hasAutomatic,
        isMandatory: hasAutomatic,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/apps/:slug/versions/:version/download
 * Download binary file for an app release
 */
appsRouter.get("/:slug/versions/:version/download", (req: Request, res: Response) => {
  try {
    const slug = getParam(req.params.slug).trim().toLowerCase();
    const version = getParam(req.params.version).trim();

    if (RESERVED_SLUGS.has(slug)) {
      return res.status(404).json({ error: "App not found" });
    }

    const app = db
      .prepare("SELECT * FROM _apps WHERE slug = ? OR id = ? LIMIT 1")
      .get(slug, slug) as unknown as AppRecord | undefined;

    if (!app) {
      return res.status(404).json({ error: `App "${slug}" not found` });
    }

    const release = db
      .prepare("SELECT * FROM _app_releases WHERE app_id = ? AND version = ? LIMIT 1")
      .get(app.id, version) as unknown as AppReleaseRecord | undefined;

    if (!release) {
      return res.status(404).json({ error: `Version "${version}" not found for app "${slug}"` });
    }

    if (!release.is_active) {
      return res.status(403).json({ error: "Access denied: this release is inactive" });
    }

    if (!release.file_path || !fs.existsSync(release.file_path)) {
      return res.status(404).json({ error: "Release binary file is missing on server" });
    }

    // Increment download count
    try {
      db.prepare("UPDATE _app_releases SET download_count = download_count + 1 WHERE id = ?").run(release.id);
    } catch {}

    const fileName = release.file_name || `${app.slug}-${release.version}`;
    const ext = path.extname(release.file_path).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", release.file_size);
    res.sendFile(path.resolve(release.file_path));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/apps/:slug/versions/:version
 * Get details for a specific version
 */
appsRouter.get("/:slug/versions/:version", (req: Request, res: Response) => {
  try {
    const slug = getParam(req.params.slug).trim().toLowerCase();
    const version = getParam(req.params.version).trim();

    if (RESERVED_SLUGS.has(slug)) {
      return res.status(404).json({ error: "App not found" });
    }

    const app = db
      .prepare("SELECT * FROM _apps WHERE slug = ? OR id = ? LIMIT 1")
      .get(slug, slug) as unknown as AppRecord | undefined;

    if (!app) {
      return res.status(404).json({ error: `App "${slug}" not found` });
    }

    const release = db
      .prepare("SELECT * FROM _app_releases WHERE app_id = ? AND version = ? LIMIT 1")
      .get(app.id, version) as unknown as AppReleaseRecord | undefined;

    if (!release) {
      return res.status(404).json({ error: `Version "${version}" not found for app "${slug}"` });
    }

    if (!release.is_active) {
      return res.status(403).json({ error: "Version is inactive" });
    }

    res.json(formatReleaseResponse(req, release, app.slug));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/apps/:slug/versions
 * List all eligible versions for the app
 */
appsRouter.get("/:slug/versions", (req: Request, res: Response) => {
  try {
    const slug = getParam(req.params.slug).trim().toLowerCase();
    if (RESERVED_SLUGS.has(slug)) {
      return res.status(404).json({ error: "App not found" });
    }

    const app = db
      .prepare("SELECT * FROM _apps WHERE slug = ? OR id = ? LIMIT 1")
      .get(slug, slug) as unknown as AppRecord | undefined;

    if (!app) {
      return res.status(404).json({ error: `App "${slug}" not found` });
    }

    const platform = (req.query.platform as string)?.trim().toLowerCase();

    let sql = `SELECT * FROM _app_releases WHERE app_id = ? AND is_active = 1`;
    const params: any[] = [app.id];

    if (platform && platform !== "all") {
      sql += ` AND (platform = 'all' OR platform = ?)`;
      params.push(platform);
    }

    const eligible = db.prepare(sql).all(...params) as unknown as AppReleaseRecord[];

    eligible.sort((a, b) => {
      const cmp = compareVersions(b.version, a.version);
      if (cmp !== 0) return cmp;
      return (b.build_number || 0) - (a.build_number || 0);
    });

    const items = eligible.map((r) => formatReleaseResponse(req, r, app.slug));
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/apps/:slug
 * Get details for a specific app
 */
appsRouter.get("/:slug", (req: Request, res: Response) => {
  try {
    const slug = getParam(req.params.slug).trim().toLowerCase();
    if (RESERVED_SLUGS.has(slug)) {
      return res.status(404).json({ error: "App not found" });
    }

    const app = db
      .prepare("SELECT * FROM _apps WHERE slug = ? OR id = ? LIMIT 1")
      .get(slug, slug) as unknown as AppRecord | undefined;

    if (!app) {
      return res.status(404).json({ error: `App "${slug}" not found` });
    }

    const { webhook_secret, ...safeApp } = app as any;
    res.json(safeApp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
