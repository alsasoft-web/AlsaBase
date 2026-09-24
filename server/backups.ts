import fs from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";
import AdmZip from "adm-zip";
import cron, { ScheduledTask } from "node-cron";
import { db, reopenDatabase } from "./db";
import { getAllSettings } from "./settings";
import { loadAllHooks, initHooksDir } from "./hooks";
import { initPublicDir } from "./static";
import { initDefaultCollections, syncDatabaseCollections } from "./schema";

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
export const BACKUPS_DIR = path.resolve(DATA_DIR, "backups");
const DB_FILE = path.join(DATA_DIR, "alsabase.sqlite");
const PUBLIC_DIR = path.resolve(process.cwd(), "_public");
const HOOKS_DIR = path.resolve(process.cwd(), "_hooks");

export function initBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

initBackupsDir();

export interface BackupItemMeta {
  key: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
  includePublic: boolean;
  includeHooks: boolean;
}

// Generate unique clean backup filename
function generateBackupFilename(customName?: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  if (customName && customName.trim()) {
    const clean = customName.trim().replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    return clean.endsWith(".zip") ? clean : `${clean}_${timestamp}.zip`;
  }

  return `alsabase_backup_${timestamp}.zip`;
}

// Create a complete or selective backup .zip archive
export async function createBackup(options: {
  name?: string;
  includePublic?: boolean;
  includeHooks?: boolean;
}): Promise<BackupItemMeta> {
  initBackupsDir();

  const includePublic = options.includePublic ?? true;
  const includeHooks = options.includeHooks ?? true;
  const filename = generateBackupFilename(options.name);
  const targetZipPath = path.join(BACKUPS_DIR, filename);

  // 1. Flush SQLite Write-Ahead-Log
  try {
    db.exec("PRAGMA wal_checkpoint(FULL);");
  } catch (err) {
    console.warn("[Backups] WAL checkpoint warning:", err);
  }

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetZipPath);
    const archive = new ZipArchive({
      zlib: { level: 9 },
    });

    output.on("close", () => {
      const stats = fs.statSync(targetZipPath);
      const meta: BackupItemMeta = {
        key: filename,
        name: filename,
        sizeBytes: stats.size,
        createdAt: new Date().toISOString(),
        includePublic,
        includeHooks,
      };

      console.log(`[Backups] Backup created successfully: ${filename} (${stats.size} bytes)`);
      resolve(meta);
    });

    archive.on("error", (err: any) => {
      reject(err);
    });

    archive.pipe(output);

    // 2. Add metadata file
    const metaPayload = {
      app: "AlsaBase",
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      includePublic,
      includeHooks,
    };
    archive.append(JSON.stringify(metaPayload, null, 2), { name: "backup_manifest.json" });

    // 3. Add SQLite database file
    if (fs.existsSync(DB_FILE)) {
      archive.file(DB_FILE, { name: "data/alsabase.sqlite" });
    }

    // Add SQLite WAL / SHM files if present
    const walFile = `${DB_FILE}-wal`;
    const shmFile = `${DB_FILE}-shm`;
    if (fs.existsSync(walFile)) archive.file(walFile, { name: "data/alsabase.sqlite-wal" });
    if (fs.existsSync(shmFile)) archive.file(shmFile, { name: "data/alsabase.sqlite-shm" });

    // 4. Add data/uploads directory if exists
    const uploadsDir = path.join(DATA_DIR, "uploads");
    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, "data/uploads");
    }

    // 5. Add _public directory if requested
    if (includePublic && fs.existsSync(PUBLIC_DIR)) {
      archive.directory(PUBLIC_DIR, "_public");
    }

    // 6. Add _hooks directory if requested
    if (includeHooks && fs.existsSync(HOOKS_DIR)) {
      archive.directory(HOOKS_DIR, "_hooks");
    }

    archive.finalize();
  });
}

// List all existing backups
export function listBackups(): BackupItemMeta[] {
  initBackupsDir();
  const entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true });

  const backups: BackupItemMeta[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".zip")) {
      const fullPath = path.join(BACKUPS_DIR, entry.name);
      const stats = fs.statSync(fullPath);

      let includePublic = true;
      let includeHooks = true;

      // Try quick manifest read
      try {
        const zip = new AdmZip(fullPath);
        const manifestEntry = zip.getEntry("backup_manifest.json");
        if (manifestEntry) {
          const manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
          if (manifest.includePublic !== undefined) includePublic = manifest.includePublic;
          if (manifest.includeHooks !== undefined) includeHooks = manifest.includeHooks;
        }
      } catch {
        // ignore zip parse error
      }

      backups.push({
        key: entry.name,
        name: entry.name,
        sizeBytes: stats.size,
        createdAt: stats.mtime.toISOString(),
        includePublic,
        includeHooks,
      });
    }
  }

  // Sort newest first
  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return backups;
}

// Restore system from backup zip
export async function restoreBackup(filename: string): Promise<{ success: boolean; message: string }> {
  initBackupsDir();
  const zipPath = path.join(BACKUPS_DIR, path.basename(filename));

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Backup file "${filename}" not found.`);
  }

  const zip = new AdmZip(zipPath);
  const zipEntries = zip.getEntries();

  // Validate backup format
  const hasDb = zipEntries.some((e) => e.entryName.includes("alsabase.sqlite") || e.entryName.endsWith(".sqlite") || e.entryName.endsWith(".db"));
  if (!hasDb) {
    throw new Error("Invalid backup archive: SQLite database file not found in zip.");
  }

  // Safe trash backup of current database
  const trashDir = path.resolve(process.cwd(), ".trash");
  if (!fs.existsSync(trashDir)) {
    fs.mkdirSync(trashDir, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    const preRestoreBackup = path.join(trashDir, `${Date.now()}_pre_restore_alsabase.sqlite`);
    fs.copyFileSync(DB_FILE, preRestoreBackup);
  }

  // Close active connection and remove WAL/SHM files before extracting
  db.close();
  if (fs.existsSync(DB_FILE + "-wal")) {
    try { fs.unlinkSync(DB_FILE + "-wal"); } catch {}
  }
  if (fs.existsSync(DB_FILE + "-shm")) {
    try { fs.unlinkSync(DB_FILE + "-shm"); } catch {}
  }

  // Extract contents
  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;

    if (entry.entryName.startsWith("data/")) {
      const rel = entry.entryName.slice("data/".length);
      const target = path.join(DATA_DIR, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.getData());
    } else if (entry.entryName.startsWith("_public/")) {
      const rel = entry.entryName.slice("_public/".length);
      const target = path.join(PUBLIC_DIR, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.getData());
    } else if (entry.entryName.startsWith("_hooks/")) {
      const rel = entry.entryName.slice("_hooks/".length);
      const target = path.join(HOOKS_DIR, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.getData());
    }
  }

  // Reopen database and re-initialize all system services
  try {
    reopenDatabase();
    syncDatabaseCollections();
    initDefaultCollections();
    initPublicDir();
    initHooksDir();
    await loadAllHooks();
  } catch (err) {
    console.error("[Backups:Restore] System re-init error:", err);
  }

  return { success: true, message: `Successfully restored backup "${filename}".` };
}

// Delete backup file
export function deleteBackup(filename: string): { success: boolean } {
  initBackupsDir();
  const cleanName = path.basename(filename);
  const zipPath = path.join(BACKUPS_DIR, cleanName);

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Backup file "${cleanName}" not found.`);
  }

  fs.unlinkSync(zipPath);

  return { success: true };
}

// Automated Backup Scheduler
let activeCronTask: ScheduledTask | null = null;

export function setupAutoBackupScheduler() {
  const settings = getAllSettings();
  const backupCfg = settings.backups;

  if (activeCronTask) {
    activeCronTask.stop();
    activeCronTask = null;
  }

  if (!backupCfg.autoBackupEnabled || !backupCfg.cronSchedule) {
    return;
  }

  if (!cron.validate(backupCfg.cronSchedule)) {
    console.warn(`[Backups:Auto] Invalid cron expression: "${backupCfg.cronSchedule}"`);
    return;
  }

  activeCronTask = cron.schedule(backupCfg.cronSchedule, async () => {
    console.log(`[Backups:Auto] Running scheduled auto-backup...`);
    try {
      await createBackup({
        name: `auto_backup`,
        includePublic: backupCfg.includePublic,
        includeHooks: backupCfg.includeHooks,
      });

      // Prune excess backups beyond maxRetention
      const list = listBackups();
      if (backupCfg.maxRetention > 0 && list.length > backupCfg.maxRetention) {
        const toDelete = list.slice(backupCfg.maxRetention);
        for (const item of toDelete) {
          try {
            deleteBackup(item.name);
            console.log(`[Backups:Auto] Pruned old backup: ${item.name}`);
          } catch {}
        }
      }
    } catch (err) {
      console.error(`[Backups:Auto] Error during scheduled backup:`, err);
    }
  });

  console.log(`[Backups:Auto] Auto-backup scheduler activated on "${backupCfg.cronSchedule}".`);
}
