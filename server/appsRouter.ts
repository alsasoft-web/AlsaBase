import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db";
import { requireSuperuser, AuthPayload } from "./auth";
import { FILES_DIR, MIME_TYPES } from "./files";

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
  "licenses",
  "devices",
]);

export function generateSerialKey(format?: string): string {
  if (format && format.includes("X")) {
    return format.replace(/X/g, () =>
      crypto.randomBytes(1).toString("hex").toUpperCase()[0]
    );
  }
  const chunk = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ALSA-${chunk()}-${chunk()}-${chunk()}`;
}

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
  max_devices?: number | null;
  device_policy?: "unrestricted" | "max_devices" | "whitelist_only" | string;
  created_at: string;
  updated_at: string;
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

export interface AppLicenseRecord {
  id: string;
  app_id: string;
  app_slug: string;
  serial_key: string;
  status: "active" | "revoked" | "suspended" | "expired";
  customer_name?: string | null;
  customer_email?: string | null;
  max_activations: number;
  activated_count: number;
  expires_at?: string | null;
  notes?: string | null;
  metadata?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppDeviceRecord {
  id: string;
  app_id: string;
  app_slug: string;
  device_id: string;
  device_name?: string | null;
  license_id?: string | null;
  license_key?: string | null;
  os_name?: string | null;
  platform?: string | null;
  ip_address?: string | null;
  is_locked: number;
  lock_reason?: string | null;
  locked_at?: string | null;
  last_seen_at: string;
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

function formatLicenseResponse(lic: AppLicenseRecord) {
  const isExpired = lic.expires_at ? new Date(lic.expires_at) < new Date() : false;
  const currentStatus = isExpired && lic.status === "active" ? "expired" : lic.status;
  let parsedMetadata: any = null;
  if (lic.metadata) {
    try {
      parsedMetadata = JSON.parse(lic.metadata);
    } catch {}
  }

  return {
    id: lic.id,
    appId: lic.app_id,
    appSlug: lic.app_slug,
    serialKey: lic.serial_key,
    status: currentStatus,
    rawStatus: lic.status,
    isExpired,
    customerName: lic.customer_name || null,
    customerEmail: lic.customer_email || null,
    maxActivations: lic.max_activations || 1,
    activatedCount: lic.activated_count || 0,
    expiresAt: lic.expires_at || null,
    notes: lic.notes || null,
    metadata: parsedMetadata,
    createdAt: lic.created_at,
    updatedAt: lic.updated_at,
  };
}

function formatDeviceResponse(dev: AppDeviceRecord) {
  return {
    id: dev.id,
    appId: dev.app_id,
    appSlug: dev.app_slug,
    deviceId: dev.device_id,
    deviceName: dev.device_name || null,
    licenseId: dev.license_id || null,
    licenseKey: dev.license_key || null,
    osName: dev.os_name || null,
    platform: dev.platform || null,
    ipAddress: dev.ip_address || null,
    isLocked: Boolean(dev.is_locked),
    lockReason: dev.lock_reason || null,
    lockedAt: dev.locked_at || null,
    lastSeenAt: dev.last_seen_at,
    createdAt: dev.created_at,
    updatedAt: dev.updated_at,
  };
}

/**
 * Gatekeeper helper to verify if a client device is authorized to run or access the app,
 * enforcing individual lock status, global app max_devices quotas, or whitelist-only policies.
 */
export function checkOrRegisterAppDevice(
  app: AppRecord,
  req: Request,
  deviceId?: string,
  deviceName?: string,
  platform?: string,
  osName?: string
): { allowed: boolean; isLocked: boolean; reason?: string | null; device?: AppDeviceRecord | null; limitReached?: boolean } {
  if (!deviceId || !deviceId.trim()) {
    if (app.device_policy === "whitelist_only" || (app.device_policy === "max_devices" && (app.max_devices ?? 0) > 0)) {
      return {
        allowed: false,
        isLocked: true,
        reason: "Device ID / hardware identifier is required to access this restricted application",
      };
    }
    return { allowed: true, isLocked: false };
  }

  const cleanDeviceId = deviceId.trim();
  const existing = db
    .prepare("SELECT * FROM _app_devices WHERE app_id = ? AND device_id = ?")
    .get(app.id, cleanDeviceId) as unknown as AppDeviceRecord | undefined;

  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null;
  const now = new Date().toISOString();

  if (existing) {
    if (existing.is_locked) {
      return {
        allowed: false,
        isLocked: true,
        reason: existing.lock_reason || "This device has been locked from accessing this application",
        device: existing,
      };
    }

    // Update last seen and device metadata
    try {
      db.prepare(
        `UPDATE _app_devices 
         SET last_seen_at = ?, ip_address = COALESCE(?, ip_address),
             platform = COALESCE(?, platform), os_name = COALESCE(?, os_name),
             device_name = COALESCE(?, device_name)
         WHERE id = ?`
      ).run(now, ip, platform?.trim() || null, osName?.trim() || null, deviceName?.trim() || null, existing.id);
    } catch {}

    return { allowed: true, isLocked: false, device: existing };
  }

  // Device does not exist in registry yet
  if (app.device_policy === "whitelist_only") {
    return {
      allowed: false,
      isLocked: true,
      reason: "Unauthorized PC. This application is restricted to whitelisted computers only.",
    };
  }

  if (app.device_policy === "max_devices" && (app.max_devices ?? 0) > 0) {
    const max = app.max_devices as number;
    const countRow = db
      .prepare("SELECT COUNT(*) as cnt FROM _app_devices WHERE app_id = ? AND is_locked = 0")
      .get(app.id) as { cnt: number };

    if (countRow.cnt >= max) {
      return {
        allowed: false,
        isLocked: true,
        limitReached: true,
        reason: `Application device limit reached (maximum ${max} computers allowed). Contact your administrator to register this device or free up a seat.`,
      };
    }
  }

  // Auto-register device as allowed
  const id = `dev_${crypto.randomBytes(8).toString("hex")}`;
  try {
    db.prepare(
      `INSERT INTO _app_devices (
        id, app_id, app_slug, device_id, device_name,
        is_locked, last_seen_at, created_at, updated_at,
        ip_address, platform, os_name
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      app.id,
      app.slug,
      cleanDeviceId,
      deviceName?.trim() || cleanDeviceId,
      now,
      now,
      now,
      ip,
      platform?.trim() || null,
      osName?.trim() || null
    );

    const created = db.prepare("SELECT * FROM _app_devices WHERE id = ?").get(id) as unknown as AppDeviceRecord;
    return { allowed: true, isLocked: false, device: created };
  } catch {
    return { allowed: true, isLocked: false };
  }
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

      const licenseStats = db
        .prepare(
          `SELECT 
            COUNT(*) as total_licenses,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_licenses
           FROM _app_licenses 
           WHERE app_id = ?`
        )
        .get(app.id) as any;

      const deviceStats = db
        .prepare(
          `SELECT 
            COUNT(*) as total_devices,
            SUM(CASE WHEN is_locked = 1 THEN 1 ELSE 0 END) as locked_devices
           FROM _app_devices 
           WHERE app_id = ?`
        )
        .get(app.id) as any;

      return {
        id: app.id,
        name: app.name,
        slug: app.slug,
        description: app.description || "",
        iconUrl: app.icon_url || null,
        maxDevices: app.max_devices !== undefined && app.max_devices !== null ? app.max_devices : null,
        devicePolicy: app.device_policy || "unrestricted",
        totalReleases: stats?.total_releases || 0,
        totalDownloads: stats?.total_downloads || 0,
        totalStorageBytes: stats?.total_storage_bytes || 0,
        totalLicenses: licenseStats?.total_licenses || 0,
        activeLicenses: licenseStats?.active_licenses || 0,
        totalDevices: deviceStats?.total_devices || 0,
        lockedDevices: deviceStats?.locked_devices || 0,
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
    const { name, slug, description, iconUrl, iconFile, maxDevices, devicePolicy } = req.body;

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

    const finalMaxDevices =
      maxDevices !== undefined && maxDevices !== null && maxDevices !== ""
        ? Math.max(1, parseInt(String(maxDevices), 10) || 1)
        : null;
    const finalDevicePolicy =
      devicePolicy === "max_devices" || devicePolicy === "whitelist_only"
        ? devicePolicy
        : "unrestricted";

    const id = `app_${crypto.randomBytes(8).toString("hex")}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO _apps (id, name, slug, description, icon_url, max_devices, device_policy, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name.trim(), cleanSlug, description?.trim() || "", finalIconUrl, finalMaxDevices, finalDevicePolicy, now, now);

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
    const { name, slug, description, iconUrl, iconFile, maxDevices, devicePolicy } = req.body;

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

      // Update app_slug in all releases, licenses, devices
      db.prepare("UPDATE _app_releases SET app_slug = ? WHERE app_id = ?").run(finalSlug, id);
      db.prepare("UPDATE _app_licenses SET app_slug = ? WHERE app_id = ?").run(finalSlug, id);
      db.prepare("UPDATE _app_devices SET app_slug = ? WHERE app_id = ?").run(finalSlug, id);

      // Rename icon directory if exists
      const oldIconDir = path.join(APP_ICONS_DIR, current.slug);
      const newIconDir = path.join(APP_ICONS_DIR, finalSlug);
      if (fs.existsSync(oldIconDir) && !fs.existsSync(newIconDir)) {
        try {
          fs.renameSync(oldIconDir, newIconDir);
        } catch {}
      }
    }

    let finalIcon = iconUrl !== undefined ? iconUrl?.trim() || null : (current.icon_url ?? null);
    if (iconFile) {
      finalIcon = saveAppIcon(finalSlug, iconFile) || finalIcon;
    }

    const finalMaxDevices =
      maxDevices !== undefined
        ? maxDevices !== null && maxDevices !== ""
          ? Math.max(1, parseInt(String(maxDevices), 10) || 1)
          : null
        : (current.max_devices ?? null);

    const finalDevicePolicy =
      devicePolicy !== undefined
        ? devicePolicy === "max_devices" || devicePolicy === "whitelist_only"
          ? devicePolicy
          : "unrestricted"
        : (current.device_policy || "unrestricted");

    const finalName = name?.trim() || current.name;
    const finalDesc = description !== undefined ? description?.trim() || "" : (current.description ?? "");
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE _apps 
       SET name = ?, slug = ?, description = ?, icon_url = ?, max_devices = ?, device_policy = ?, updated_at = ?
       WHERE id = ?`
    ).run(finalName, finalSlug, finalDesc, finalIcon, finalMaxDevices, finalDevicePolicy, now, id);

    const updated = db.prepare("SELECT * FROM _apps WHERE id = ?").get(id);
    res.json(updated);
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

    // Delete devices, licenses, releases & app from SQLite
    db.prepare("DELETE FROM _app_devices WHERE app_id = ?").run(id);
    db.prepare("DELETE FROM _app_licenses WHERE app_id = ?").run(id);
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
    res.status(201).json(formatReleaseResponse(req, created, app.slug));
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

// ----------------------------------------------------------------------------
// License / Serial Key Management Routes (Superuser)
// ----------------------------------------------------------------------------

/**
 * GET /api/apps/manage/licenses
 * List serial numbers / licenses with filtering and metrics
 */
appsRouter.get("/manage/licenses", requireSuperuser, (req: Request, res: Response) => {
  try {
    const appId = req.query.appId as string;
    const appSlug = req.query.appSlug as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    let sql = `SELECT * FROM _app_licenses WHERE 1=1`;
    const params: any[] = [];

    if (appId) {
      sql += ` AND app_id = ?`;
      params.push(appId);
    } else if (appSlug) {
      sql += ` AND app_slug = ?`;
      params.push(appSlug.toLowerCase());
    }

    if (status && status !== "all") {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (serial_key LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR notes LIKE ?)`;
      params.push(q, q, q, q);
    }

    sql += ` ORDER BY created_at DESC`;

    const licenses = db.prepare(sql).all(...params) as unknown as AppLicenseRecord[];
    const items = licenses.map((l) => formatLicenseResponse(l));

    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/apps/manage/licenses
 * Create single or batch serial keys
 */
appsRouter.post("/manage/licenses", requireSuperuser, (req: Request, res: Response) => {
  try {
    const {
      appId,
      appSlug,
      serialKey,
      count = 1,
      format,
      maxActivations = 1,
      expiresAt,
      customerName,
      customerEmail,
      notes,
      metadata,
    } = req.body;

    // Resolve app
    let app: AppRecord | undefined;
    if (appId) {
      app = db.prepare("SELECT * FROM _apps WHERE id = ? OR slug = ?").get(appId, appId) as unknown as AppRecord | undefined;
    } else if (appSlug) {
      app = db.prepare("SELECT * FROM _apps WHERE slug = ?").get(appSlug.trim().toLowerCase()) as unknown as AppRecord | undefined;
    }

    if (!app) {
      return res.status(400).json({ error: "Valid appId or appSlug is required" });
    }

    const numCount = Math.max(1, Math.min(100, parseInt(String(count), 10) || 1));
    const maxAct = Math.max(1, parseInt(String(maxActivations), 10) || 1);
    const metaStr = metadata ? JSON.stringify(metadata) : null;
    const now = new Date().toISOString();

    const insertStmt = db.prepare(
      `INSERT INTO _app_licenses (
        id, app_id, app_slug, serial_key, status, customer_name, customer_email,
        max_activations, activated_count, expires_at, notes, metadata,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, 0, ?, ?, ?, ?, ?)`
    );

    const createdItems: any[] = [];

    if (serialKey && serialKey.trim()) {
      const cleanKey = serialKey.trim().toUpperCase();
      const existing = db.prepare("SELECT id FROM _app_licenses WHERE serial_key = ?").get(cleanKey);
      if (existing) {
        return res.status(400).json({ error: `Serial key "${cleanKey}" already exists` });
      }

      const id = `lic_${crypto.randomBytes(8).toString("hex")}`;
      insertStmt.run(
        id,
        app.id,
        app.slug,
        cleanKey,
        customerName?.trim() || null,
        customerEmail?.trim() || null,
        maxAct,
        expiresAt?.trim() || null,
        notes?.trim() || null,
        metaStr,
        now,
        now
      );

      const created = db.prepare("SELECT * FROM _app_licenses WHERE id = ?").get(id) as unknown as AppLicenseRecord;
      return res.status(201).json(formatLicenseResponse(created));
    }

    // Batch generate random serial keys
    for (let i = 0; i < numCount; i++) {
      let uniqueKey = "";
      let attempts = 0;
      while (attempts < 10) {
        uniqueKey = generateSerialKey(format);
        const existing = db.prepare("SELECT id FROM _app_licenses WHERE serial_key = ?").get(uniqueKey);
        if (!existing) break;
        attempts++;
      }

      const id = `lic_${crypto.randomBytes(8).toString("hex")}`;
      insertStmt.run(
        id,
        app.id,
        app.slug,
        uniqueKey,
        customerName?.trim() || null,
        customerEmail?.trim() || null,
        maxAct,
        expiresAt?.trim() || null,
        notes?.trim() || null,
        metaStr,
        now,
        now
      );

      const created = db.prepare("SELECT * FROM _app_licenses WHERE id = ?").get(id) as unknown as AppLicenseRecord;
      createdItems.push(formatLicenseResponse(created));
    }

    if (numCount === 1) {
      res.status(201).json(createdItems[0]);
    } else {
      res.status(201).json({ items: createdItems, total: createdItems.length });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/apps/manage/licenses/:id
 * Update license status, limits, customer, or notes
 */
appsRouter.put("/manage/licenses/:id", requireSuperuser, (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const current = db.prepare("SELECT * FROM _app_licenses WHERE id = ?").get(id) as unknown as AppLicenseRecord | undefined;

    if (!current) {
      return res.status(404).json({ error: "License not found" });
    }

    const {
      status,
      maxActivations,
      expiresAt,
      customerName,
      customerEmail,
      notes,
      metadata,
    } = req.body;

    const finalStatus = status !== undefined ? String(status) : current.status;
    const finalMax = maxActivations !== undefined ? Math.max(1, parseInt(String(maxActivations), 10) || 1) : current.max_activations;
    const finalExp = expiresAt !== undefined ? (expiresAt ? String(expiresAt).trim() : null) : (current.expires_at ?? null);
    const finalName = customerName !== undefined ? (customerName ? String(customerName).trim() : null) : (current.customer_name ?? null);
    const finalEmail = customerEmail !== undefined ? (customerEmail ? String(customerEmail).trim() : null) : (current.customer_email ?? null);
    const finalNotes = notes !== undefined ? (notes ? String(notes).trim() : null) : (current.notes ?? null);
    const finalMeta = metadata !== undefined ? (metadata ? JSON.stringify(metadata) : null) : (current.metadata ?? null);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE _app_licenses 
       SET status = ?, max_activations = ?, expires_at = ?,
           customer_name = ?, customer_email = ?, notes = ?,
           metadata = ?, updated_at = ?
       WHERE id = ?`
    ).run(finalStatus, finalMax, finalExp, finalName, finalEmail, finalNotes, finalMeta, now, id);

    // Refresh active count
    db.prepare(
      `UPDATE _app_licenses 
       SET activated_count = (SELECT COUNT(*) FROM _app_devices WHERE license_id = ? AND is_locked = 0)
       WHERE id = ?`
    ).run(id, id);

    const updated = db.prepare("SELECT * FROM _app_licenses WHERE id = ?").get(id) as unknown as AppLicenseRecord;
    res.json(formatLicenseResponse(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/apps/manage/licenses/:id
 * Delete license and unbind associated devices
 */
appsRouter.delete("/manage/licenses/:id", requireSuperuser, (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const current = db.prepare("SELECT * FROM _app_licenses WHERE id = ?").get(id) as unknown as AppLicenseRecord | undefined;

    if (!current) {
      return res.status(404).json({ error: "License not found" });
    }

    // Unbind devices
    db.prepare("UPDATE _app_devices SET license_id = NULL, license_key = NULL WHERE license_id = ?").run(id);
    db.prepare("DELETE FROM _app_licenses WHERE id = ?").run(id);

    res.json({ success: true, message: `License "${current.serial_key}" deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Device / PC Lock & Access Management Routes (Superuser)
// ----------------------------------------------------------------------------

/**
 * GET /api/apps/manage/devices
 * List registered devices / PCs with lock status
 */
appsRouter.get("/manage/devices", requireSuperuser, (req: Request, res: Response) => {
  try {
    const appId = req.query.appId as string;
    const appSlug = req.query.appSlug as string;
    const isLocked = req.query.isLocked as string;
    const licenseId = req.query.licenseId as string;
    const search = req.query.search as string;

    let sql = `SELECT * FROM _app_devices WHERE 1=1`;
    const params: any[] = [];

    if (appId) {
      sql += ` AND app_id = ?`;
      params.push(appId);
    } else if (appSlug) {
      sql += ` AND app_slug = ?`;
      params.push(appSlug.toLowerCase());
    }

    if (isLocked !== undefined && isLocked !== "" && isLocked !== "all") {
      sql += ` AND is_locked = ?`;
      params.push(isLocked === "true" || isLocked === "1" ? 1 : 0);
    }

    if (licenseId) {
      sql += ` AND license_id = ?`;
      params.push(licenseId);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (device_id LIKE ? OR device_name LIKE ? OR license_key LIKE ? OR ip_address LIKE ? OR lock_reason LIKE ?)`;
      params.push(q, q, q, q, q);
    }

    sql += ` ORDER BY last_seen_at DESC`;

    const devices = db.prepare(sql).all(...params) as unknown as AppDeviceRecord[];
    const items = devices.map((d) => formatDeviceResponse(d));

    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/apps/manage/devices/lock
 * Manually lock / ban a device ID or PC (can pre-ban an HWID)
 */
appsRouter.post("/manage/devices/lock", requireSuperuser, (req: Request, res: Response) => {
  try {
    const { appId, appSlug, deviceId, deviceName, reason } = req.body;

    if (!deviceId || !deviceId.trim()) {
      return res.status(400).json({ error: "Device ID / HWID is required" });
    }

    // Resolve app
    let app: AppRecord | undefined;
    if (appId) {
      app = db.prepare("SELECT * FROM _apps WHERE id = ? OR slug = ?").get(appId, appId) as unknown as AppRecord | undefined;
    } else if (appSlug) {
      app = db.prepare("SELECT * FROM _apps WHERE slug = ?").get(appSlug.trim().toLowerCase()) as unknown as AppRecord | undefined;
    }

    if (!app) {
      return res.status(400).json({ error: "Valid appId or appSlug is required" });
    }

    const cleanDeviceId = deviceId.trim();
    const cleanReason = reason?.trim() || "Locked by administrator";
    const now = new Date().toISOString();

    const existing = db
      .prepare("SELECT * FROM _app_devices WHERE app_id = ? AND device_id = ?")
      .get(app.id, cleanDeviceId) as unknown as AppDeviceRecord | undefined;

    if (existing) {
      db.prepare(
        `UPDATE _app_devices 
         SET is_locked = 1, lock_reason = ?, locked_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(cleanReason, now, now, existing.id);

      const updated = db.prepare("SELECT * FROM _app_devices WHERE id = ?").get(existing.id) as unknown as AppDeviceRecord;
      return res.json(formatDeviceResponse(updated));
    }

    // Insert new locked device
    const id = `dev_${crypto.randomBytes(8).toString("hex")}`;
    db.prepare(
      `INSERT INTO _app_devices (
        id, app_id, app_slug, device_id, device_name,
        is_locked, lock_reason, locked_at, last_seen_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
    ).run(
      id,
      app.id,
      app.slug,
      cleanDeviceId,
      deviceName?.trim() || cleanDeviceId,
      cleanReason,
      now,
      now,
      now,
      now
    );

    const created = db.prepare("SELECT * FROM _app_devices WHERE id = ?").get(id) as unknown as AppDeviceRecord;
    res.status(201).json(formatDeviceResponse(created));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/apps/manage/devices/:id/lock
 * Toggle or set lock/block status on a device
 */
appsRouter.put("/manage/devices/:id/lock", requireSuperuser, (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const current = db.prepare("SELECT * FROM _app_devices WHERE id = ?").get(id) as unknown as AppDeviceRecord | undefined;

    if (!current) {
      return res.status(404).json({ error: "Device not found" });
    }

    const { isLocked, reason } = req.body;
    const lockVal = isLocked !== undefined ? (isLocked ? 1 : 0) : current.is_locked ? 0 : 1;
    const cleanReason = lockVal ? (reason?.trim() || current.lock_reason || "Locked by administrator") : null;
    const now = new Date().toISOString();
    const lockedAt = lockVal ? now : null;

    db.prepare(
      `UPDATE _app_devices 
       SET is_locked = ?, lock_reason = ?, locked_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(lockVal, cleanReason, lockedAt, now, id);

    // Refresh license active count if linked
    if (current.license_id) {
      db.prepare(
        `UPDATE _app_licenses 
         SET activated_count = (SELECT COUNT(*) FROM _app_devices WHERE license_id = ? AND is_locked = 0)
         WHERE id = ?`
      ).run(current.license_id, current.license_id);
    }

    const updated = db.prepare("SELECT * FROM _app_devices WHERE id = ?").get(id) as unknown as AppDeviceRecord;
    res.json(formatDeviceResponse(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/apps/manage/devices/:id
 * Delete / unbind device from app and license
 */
appsRouter.delete("/manage/devices/:id", requireSuperuser, (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const current = db.prepare("SELECT * FROM _app_devices WHERE id = ?").get(id) as unknown as AppDeviceRecord | undefined;

    if (!current) {
      return res.status(404).json({ error: "Device not found" });
    }

    db.prepare("DELETE FROM _app_devices WHERE id = ?").run(id);

    // Refresh license count if linked
    if (current.license_id) {
      db.prepare(
        `UPDATE _app_licenses 
         SET activated_count = (SELECT COUNT(*) FROM _app_devices WHERE license_id = ? AND is_locked = 0)
         WHERE id = ?`
      ).run(current.license_id, current.license_id);
    }

    res.json({ success: true, message: `Device "${current.device_id}" removed successfully` });
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
        maxDevices: app.max_devices !== undefined && app.max_devices !== null ? app.max_devices : null,
        devicePolicy: app.device_policy || "unrestricted",
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
    const deviceId = (req.query.deviceId as string)?.trim();

    // Verify PC hardware access & global device quota
    const gate = checkOrRegisterAppDevice(app, req, deviceId, undefined, platform, undefined);
    if (!gate.allowed) {
      return res.status(403).json({
        updateAvailable: false,
        hasUpdate: false,
        isDeviceLocked: true,
        limitReached: Boolean(gate.limitReached),
        error: gate.reason || "This device has been locked from accessing this application",
        lockReason: gate.reason || "Locked by administrator",
      });
    }

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

    res.json({
      id: app.id,
      name: app.name,
      slug: app.slug,
      description: app.description || "",
      iconUrl: app.icon_url || null,
      maxDevices: app.max_devices ?? null,
      devicePolicy: app.device_policy || "unrestricted",
      createdAt: app.created_at,
      updatedAt: app.updated_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Client App License & Device Check Endpoints
// ----------------------------------------------------------------------------

/**
 * GET /api/apps/:slug/devices/check
 * Check if a PC or device ID is registered, allowed, or locked
 */
appsRouter.get("/:slug/devices/check", (req: Request, res: Response) => {
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

    const deviceId = (req.query.deviceId as string)?.trim();
    const deviceName = (req.query.deviceName as string)?.trim();
    const platform = (req.query.platform as string)?.trim();
    const osName = (req.query.osName as string)?.trim();

    if (!deviceId) {
      return res.status(400).json({ error: "Query parameter deviceId is required" });
    }

    const gate = checkOrRegisterAppDevice(app, req, deviceId, deviceName, platform, osName);
    if (!gate.allowed) {
      return res.status(403).json({
        allowed: false,
        isLocked: true,
        limitReached: Boolean(gate.limitReached),
        error: gate.reason || "This device has been locked from accessing this application",
        lockReason: gate.reason || "Locked by administrator",
        device: gate.device ? formatDeviceResponse(gate.device) : null,
      });
    }

    res.json({
      allowed: true,
      isLocked: false,
      isRegistered: Boolean(gate.device),
      lockReason: null,
      device: gate.device ? formatDeviceResponse(gate.device) : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/apps/:slug/licenses/validate
 * Validate device lock status and optional license serial key
 */
appsRouter.post("/:slug/licenses/validate", (req: Request, res: Response) => {
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

    const { deviceId, key } = req.body;
    if (!deviceId || !deviceId.trim()) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const cleanDeviceId = deviceId.trim();
    const gate = checkOrRegisterAppDevice(app, req, cleanDeviceId);
    if (!gate.allowed) {
      return res.status(403).json({
        valid: false,
        isLocked: true,
        limitReached: Boolean(gate.limitReached),
        error: gate.reason || "This device has been locked from accessing this application",
        lockReason: gate.reason || "Locked by administrator",
        device: gate.device ? formatDeviceResponse(gate.device) : null,
      });
    }

    const dev = gate.device;

    if (!key || !key.trim()) {
      // Validate device only
      return res.json({
        valid: true,
        isLocked: false,
        isRegistered: Boolean(dev),
        device: dev ? formatDeviceResponse(dev) : null,
      });
    }

    // Validate license key
    const cleanKey = key.trim().toUpperCase();
    const lic = db
      .prepare("SELECT * FROM _app_licenses WHERE app_id = ? AND serial_key = ?")
      .get(app.id, cleanKey) as unknown as AppLicenseRecord | undefined;

    if (!lic) {
      return res.status(404).json({
        valid: false,
        isLocked: false,
        error: "Invalid serial number",
      });
    }

    const isExpired = lic.expires_at ? new Date(lic.expires_at) < new Date() : false;
    if (isExpired) {
      return res.status(400).json({
        valid: false,
        isLocked: false,
        isExpired: true,
        error: "License has expired",
        license: formatLicenseResponse(lic),
      });
    }

    if (lic.status !== "active") {
      return res.status(400).json({
        valid: false,
        isLocked: false,
        status: lic.status,
        error: `License is ${lic.status}`,
        license: formatLicenseResponse(lic),
      });
    }

    res.json({
      valid: true,
      isLocked: false,
      license: formatLicenseResponse(lic),
      device: dev ? formatDeviceResponse(dev) : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/apps/:slug/licenses/activate
 * Activate a serial key on a specific PC / device ID
 */
appsRouter.post("/:slug/licenses/activate", (req: Request, res: Response) => {
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

    const { key, deviceId, deviceName, osName, platform } = req.body;

    if (!key || !key.trim()) {
      return res.status(400).json({ error: "Serial key is required" });
    }

    if (!deviceId || !deviceId.trim()) {
      return res.status(400).json({ error: "Device ID / HWID is required" });
    }

    const cleanKey = key.trim().toUpperCase();
    const cleanDeviceId = deviceId.trim();

    // 1. Verify device access & global app quota
    const gate = checkOrRegisterAppDevice(app, req, cleanDeviceId, deviceName, platform, osName);
    if (!gate.allowed) {
      return res.status(403).json({
        error: gate.reason || "This device is locked from using this application",
        isLocked: true,
        limitReached: Boolean(gate.limitReached),
        lockReason: gate.reason || "Locked by administrator",
      });
    }

    const existingDev = gate.device || (db
      .prepare("SELECT * FROM _app_devices WHERE app_id = ? AND device_id = ?")
      .get(app.id, cleanDeviceId) as unknown as AppDeviceRecord | undefined);

    // 2. Find license
    const lic = db
      .prepare("SELECT * FROM _app_licenses WHERE app_id = ? AND serial_key = ?")
      .get(app.id, cleanKey) as unknown as AppLicenseRecord | undefined;

    if (!lic) {
      return res.status(404).json({ error: "Invalid serial number" });
    }

    // 3. Verify status and expiration
    if (lic.status !== "active") {
      return res.status(400).json({ error: `License is ${lic.status}` });
    }

    if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
      return res.status(400).json({ error: "License has expired" });
    }

    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null;
    const now = new Date().toISOString();

    // 4. Check if device already activated for this license
    if (existingDev && existingDev.license_id === lic.id) {
      db.prepare(
        `UPDATE _app_devices 
         SET device_name = COALESCE(?, device_name), os_name = COALESCE(?, os_name),
             platform = COALESCE(?, platform), ip_address = COALESCE(?, ip_address),
             last_seen_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        deviceName?.trim() || null,
        osName?.trim() || null,
        platform?.trim() || null,
        ip,
        now,
        now,
        existingDev.id
      );

      const updated = db.prepare("SELECT * FROM _app_devices WHERE id = ?").get(existingDev.id) as unknown as AppDeviceRecord;
      return res.json({
        success: true,
        alreadyActivated: true,
        license: formatLicenseResponse(lic),
        device: formatDeviceResponse(updated),
      });
    }

    // 5. Check max activations limit
    const activeStats = db
      .prepare("SELECT COUNT(*) as c FROM _app_devices WHERE license_id = ? AND is_locked = 0")
      .get(lic.id) as unknown as { c: number };

    if (activeStats.c >= lic.max_activations) {
      return res.status(400).json({
        error: `Maximum activation limit reached for this serial key (limit: ${lic.max_activations} devices). Deactivate an existing device to proceed.`,
        maxActivations: lic.max_activations,
        activatedCount: activeStats.c,
      });
    }

    // 6. Bind device to license
    if (existingDev) {
      db.prepare(
        `UPDATE _app_devices 
         SET license_id = ?, license_key = ?, device_name = COALESCE(?, device_name),
             os_name = COALESCE(?, os_name), platform = COALESCE(?, platform),
             ip_address = COALESCE(?, ip_address), last_seen_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        lic.id,
        lic.serial_key,
        deviceName?.trim() || null,
        osName?.trim() || null,
        platform?.trim() || null,
        ip,
        now,
        now,
        existingDev.id
      );
    } else {
      const devId = `dev_${crypto.randomBytes(8).toString("hex")}`;
      db.prepare(
        `INSERT INTO _app_devices (
          id, app_id, app_slug, device_id, device_name,
          license_id, license_key, os_name, platform, ip_address,
          is_locked, last_seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
      ).run(
        devId,
        app.id,
        app.slug,
        cleanDeviceId,
        deviceName?.trim() || cleanDeviceId,
        lic.id,
        lic.serial_key,
        osName?.trim() || null,
        platform?.trim() || null,
        ip,
        now,
        now,
        now
      );
    }

    // Update activated_count on license
    db.prepare(
      `UPDATE _app_licenses 
       SET activated_count = (SELECT COUNT(*) FROM _app_devices WHERE license_id = ? AND is_locked = 0)
       WHERE id = ?`
    ).run(lic.id, lic.id);

    const freshLic = db.prepare("SELECT * FROM _app_licenses WHERE id = ?").get(lic.id) as unknown as AppLicenseRecord;
    const freshDev = db
      .prepare("SELECT * FROM _app_devices WHERE app_id = ? AND device_id = ?")
      .get(app.id, cleanDeviceId) as unknown as AppDeviceRecord;

    res.status(200).json({
      success: true,
      activated: true,
      license: formatLicenseResponse(freshLic),
      device: formatDeviceResponse(freshDev),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/apps/:slug/licenses/deactivate
 * Deactivate / unbind a device from a license
 */
appsRouter.post("/:slug/licenses/deactivate", (req: Request, res: Response) => {
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

    const { key, deviceId } = req.body;
    if (!deviceId || !deviceId.trim()) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const cleanDeviceId = deviceId.trim();
    const dev = db
      .prepare("SELECT * FROM _app_devices WHERE app_id = ? AND device_id = ?")
      .get(app.id, cleanDeviceId) as unknown as AppDeviceRecord | undefined;

    if (!dev) {
      return res.status(404).json({ error: "Device not found" });
    }

    const oldLicId = dev.license_id;

    db.prepare(
      `UPDATE _app_devices 
       SET license_id = NULL, license_key = NULL, updated_at = ?
       WHERE id = ?`
    ).run(new Date().toISOString(), dev.id);

    if (oldLicId) {
      db.prepare(
        `UPDATE _app_licenses 
         SET activated_count = (SELECT COUNT(*) FROM _app_devices WHERE license_id = ? AND is_locked = 0)
         WHERE id = ?`
      ).run(oldLicId, oldLicId);
    }

    res.json({ success: true, message: "Device successfully deactivated from license" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
