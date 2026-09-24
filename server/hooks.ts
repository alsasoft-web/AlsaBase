import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import cron, { ScheduledTask } from "node-cron";
import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { AuthPayload } from "./auth";
import { logToDb } from "./logger";
import { listCollections } from "./schema";
import {
  onRecordEvent,
  onCustomEvent,
  broadcastCustomEvent,
  broadcastRecordEvent,
  clearBackendEventListeners,
} from "./events";

export const HOOKS_DIR =
  process.env.HOOKS_DIR || path.resolve(process.cwd(), "_hooks");
export const PUBLIC_DIR =
  process.env.PUBLIC_DIR || path.resolve(process.cwd(), "_public");

const nativeNodeRequire = createRequire(import.meta.url);

export interface HookRouteDef {
  method: string;
  path: string;
  handler: Function;
  authLevel: "public" | "auth" | "superuser";
  sourceFile: string;
}

export interface HookCronDef {
  name: string;
  schedule: string;
  handler: Function;
  sourceFile: string;
  active: boolean;
  last_run_at?: string | null;
  last_status?: string | null;
  last_duration_ms?: number | null;
  task?: ScheduledTask;
}

export interface HookCommandOptionDef {
  name: string;
  flag?: string;
  param?: string;
  aliases?: string[];
  description?: string;
  type?: "string" | "boolean" | "number";
  default?: any;
}

export interface HookCommandDef {
  name: string;
  description: string;
  usage?: string;
  sourceFile: string;
  type: "script" | "custom";
  options?: HookCommandOptionDef[];
  handler?: Function;
  scriptPath?: string;
}

export interface HookFileStatus {
  filename: string;
  fullPath: string;
  sizeBytes: number;
  updatedAt: string;
  error?: string | null;
  errorLine?: number | null;
  errorCol?: number | null;
  errorSnippet?: string | null;
  errorStack?: string | null;
}

const activeRoutes = new Map<string, HookRouteDef>();
const activeCrons = new Map<string, HookCronDef>();
const activeCommands = new Map<string, HookCommandDef>();
const fileStatuses = new Map<string, HookFileStatus>();
const moduleCache = new Map<string, any>();
const globalHelpers = new Map<string, any>();
let isWatcherActive = false;

// Normalize request/route paths
export function normalizePath(p: string): string {
  let cleaned = (p || "/").trim();
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  return cleaned.replace(/\/+/g, "/");
}

// Generate route key for map lookup
function getRouteKey(method: string, routePath: string): string {
  return `${method.toUpperCase()} ${normalizePath(routePath)}`;
}

// Custom require for hook files
export function createHookRequire(fromFilePath: string) {
  return function hookRequire(moduleName: string): any {
    // 1. Relative local JS/TS/JSON file in _hooks/
    if (moduleName.startsWith("./") || moduleName.startsWith("../")) {
      const targetBase = path.resolve(path.dirname(fromFilePath), moduleName);
      const cleanName = moduleName.replace(/\.(js|ts|mjs|cjs|json)$/, "");
      const possiblePaths = [
        targetBase,
        `${targetBase}.js`,
        `${targetBase}.mjs`,
        `${targetBase}.ts`,
        `${targetBase}.cjs`,
        `${targetBase}.json`,
        `${cleanName}.js`,
        `${cleanName}.mjs`,
        `${cleanName}.ts`,
        `${cleanName}.cjs`,
        path.join(targetBase, "index.js"),
        path.join(targetBase, "index.mjs"),
        path.join(targetBase, "index.ts"),
        path.join(targetBase, "index.cjs"),
      ];

      let resolvedPath: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          resolvedPath = p;
          break;
        }
      }

      if (!resolvedPath) {
        throw new Error(
          `Cannot find local module '${moduleName}' requested from '${path.basename(fromFilePath)}'`,
        );
      }

      if (moduleCache.has(resolvedPath)) {
        return moduleCache.get(resolvedPath);
      }

      if (resolvedPath.endsWith(".json")) {
        const json = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
        moduleCache.set(resolvedPath, json);
        return json;
      }

      const modCode = fs.readFileSync(resolvedPath, "utf8");
      const modExports: any = {};
      const modModule = { exports: modExports };
      const childRequire = createHookRequire(resolvedPath);
      const filename = path.basename(resolvedPath);

      const scope = createSandboxScope(
        resolvedPath,
        filename,
        modModule,
        modExports,
        childRequire,
      );

      const processed = preprocessHookCode(modCode);
      const fn = vm.compileFunction(
        `return (async () => {\n${processed}\n})();`,
        Object.keys(scope),
        { filename: resolvedPath, lineOffset: -1 },
      );

      try {
        fn(...Object.values(scope));
      } catch (_e) {}

      const exported = modModule.exports;
      moduleCache.set(resolvedPath, exported);
      return exported;
    }

    // 2. Built-in node packages or npm dependencies
    try {
      return nativeNodeRequire(moduleName);
    } catch (_err) {
      try {
        const cleanMod = moduleName.replace(/^node:/, "");
        return nativeNodeRequire(cleanMod);
      } catch (err2) {
        throw new Error(
          `Cannot find package '${moduleName}'. Install it via NPM Packages tab.`,
        );
      }
    }
  };
}

// Preprocess hook source code: strip shebang and transform ESM imports/exports while keeping line numbers 1:1
function preprocessHookCode(rawCode: string): string {
  // 1. Remove shebang line (e.g. #!/usr/bin/env node) but preserve newline to keep line numbers exact
  let processed = rawCode.replace(/^#!.*/, "// [shebang stripped]");

  // 2. Transform ESM import statements to require calls (matching line-by-line)
  processed = processed.replace(
    /^\s*import\s+\*\s+as\s+([a-zA-Z0-9_$]+)\s+from\s+(['"][^'"]+['"])\s*;?/gm,
    "const $1 = require($2);",
  );

  processed = processed.replace(
    /^\s*import\s+([a-zA-Z0-9_$]+)\s+from\s+(['"][^'"]+['"])\s*;?/gm,
    "const $1 = require($2);",
  );

  processed = processed.replace(
    /^\s*import\s+\{([^}]+)\}\s+from\s+(['"][^'"]+['"])\s*;?/gm,
    (_match, imports, pkg) => {
      const transformedImports = imports.replace(
        /\b(\w+)\s+as\s+(\w+)\b/g,
        "$1: $2",
      );
      return `const { ${transformedImports} } = require(${pkg});`;
    },
  );

  processed = processed.replace(
    /^\s*import\s+(['"][^'"]+['"])\s*;?/gm,
    "require($1);",
  );

  // 3. Transform ESM exports to module.exports / exports
  processed = processed.replace(
    /^\s*export\s+default\s+/gm,
    "module.exports = exports.default = ",
  );

  processed = processed.replace(
    /^\s*export\s+(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/gm,
    "const $2 = exports.$2 =",
  );

  processed = processed.replace(
    /^\s*export\s+(async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/gm,
    "exports.$2 = $1function $2(",
  );

  processed = processed.replace(
    /^\s*export\s+class\s+([a-zA-Z0-9_$]+)/gm,
    "const $1 = exports.$1 = class $1",
  );

  processed = processed.replace(
    /^\s*export\s+\{([^}]+)\}\s*;?/gm,
    (_match, exportsList) => {
      return `Object.assign(exports, { ${exportsList} });`;
    },
  );

  // 4. Handle import.meta references
  processed = processed.replace(
    /\bimport\.meta\.url\b/g,
    `require('url').pathToFileURL(__filename).href`,
  );
  processed = processed.replace(
    /\bimport\.meta\b/g,
    `({ url: require('url').pathToFileURL(__filename).href })`,
  );

  // 5. Handle top-level __filename / __dirname declarations to avoid duplicate identifier errors
  processed = processed.replace(
    /^\s*(?:const|let|var)\s+__filename\s*=[^;\n]+;?/gm,
    "// [__filename already available in scope]",
  );
  processed = processed.replace(
    /^\s*(?:const|let|var)\s+__dirname\s*=[^;\n]+;?/gm,
    "// [__dirname already available in scope]",
  );

  return processed;
}

// Ensure _hooks directory exists with default starter hook on initial creation
export function initHooksDir() {
  const isFirstRun = !fs.existsSync(HOOKS_DIR);
  if (isFirstRun) {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    console.log(`[Hooks] Created directory: ${HOOKS_DIR}`);

    const defaultHookPath = path.join(HOOKS_DIR, "main.js");
    const defaultHookCode = `// Hooks & Scheduled Tasks
// Place any *.js files in this _hooks directory to automatically register routes & cron jobs.

// 1. Custom HTTP Route (Public)
routerAdd("GET", "/api/hello", (c) => {
  return c.json({
    message: "Hello from AlsaBase _hooks!",
    timestamp: new Date().toISOString()
  });
});

// 2. Custom HTTP Route with Database Access
routerAdd("GET", "/api/stats", (c) => {
  const collectionsList = collections.list();
  const logCount = collections.get("SELECT COUNT(*) as count FROM _logs");
  
  return c.json({
    totalCollections: collectionsList.length,
    totalLogs: logCount ? logCount.count : 0,
    serverTime: new Date().toISOString()
  });
});

// 3. Authenticated Route Example
routerAdd("POST", "/api/echo-user", (c) => {
  const user = c.user;
  return c.json({
    message: "Authorized access",
    user: user,
    body: c.body
  });
}, "auth");

// 4. Dynamic Scheduled Cron Job
cronAdd("cleanup_old_logs", "0 0 * * *", () => {
  log("Running daily log cleanup check...");
  // collections.run("DELETE FROM _logs WHERE timestamp < datetime('now', '-30 days')");
});
`;
    fs.writeFileSync(defaultHookPath, defaultHookCode, "utf8");
    console.log(`[Hooks] Created starter hook: ${defaultHookPath}`);
  }
}

// Clear all registered tasks, routes, and commands
export function resetHooksRegistry() {
  for (const [name, cronDef] of activeCrons.entries()) {
    if (cronDef.task) {
      try {
        cronDef.task.stop();
      } catch (err) {
        console.error(`[Hooks] Error stopping cron "${name}":`, err);
      }
    }
  }
  activeCrons.clear();
  activeRoutes.clear();
  activeCommands.clear();
  fileStatuses.clear();
  moduleCache.clear();
  globalHelpers.clear();
  clearBackendEventListeners();
}

// Register a CLI or custom hook command
export function registerCommand(
  name: string,
  description: string,
  sourceFile: string,
  handler?: Function,
  options: HookCommandOptionDef[] = [],
  usage?: string,
  scriptPath?: string,
  type: "script" | "custom" = "custom",
) {
  activeCommands.set(name, {
    name,
    description,
    sourceFile,
    handler,
    options,
    usage: usage || `command: ${name}`,
    scriptPath,
    type,
  });
  console.log(
    `[Hooks:Command] Registered command: ${name} (${type}) from ${sourceFile}`,
  );
}

// Register a custom HTTP endpoint
export function registerRoute(
  method: string,
  routePath: string,
  handler: Function,
  authLevel: "public" | "auth" | "superuser" = "public",
  sourceFile: string = "internal",
) {
  const normalized = normalizePath(routePath);
  const normalizedMethod = method.toUpperCase();
  const key = getRouteKey(normalizedMethod, normalized);

  activeRoutes.set(key, {
    method: normalizedMethod,
    path: normalized,
    handler,
    authLevel,
    sourceFile,
  });

  console.log(
    `[Hooks] Registered route: [${normalizedMethod}] ${normalized} (${authLevel}) from ${sourceFile}`,
  );
}

// Helper to retrieve persisted execution status for a cron job from SQLite
export function getCronPersistedState(name: string): {
  last_run_at: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
} | null {
  try {
    const row = db
      .prepare(
        "SELECT last_run_at, last_status, last_duration_ms FROM _crons WHERE name = ?",
      )
      .get(name) as any;
    if (row && row.last_run_at) {
      return {
        last_run_at: row.last_run_at,
        last_status: row.last_status,
        last_duration_ms:
          row.last_duration_ms != null ? Number(row.last_duration_ms) : null,
      };
    }
    // Fallback: check recent execution in _logs table
    const logRow = db
      .prepare(
        "SELECT timestamp as last_run_at, CASE WHEN status = 200 THEN 'SUCCESS' ELSE 'ERROR' END as last_status, duration_ms as last_duration_ms FROM _logs WHERE method = 'CRON' AND path = ? ORDER BY timestamp DESC LIMIT 1",
      )
      .get(`/cron/${name}`) as any;
    if (logRow && logRow.last_run_at) {
      return {
        last_run_at: logRow.last_run_at,
        last_status: logRow.last_status,
        last_duration_ms:
          logRow.last_duration_ms != null
            ? Number(logRow.last_duration_ms)
            : null,
      };
    }
  } catch (err) {}
  return null;
}

// Helper to save cron execution state persistently in SQLite
export function saveCronExecution(
  name: string,
  schedule: string,
  status: "SUCCESS" | "ERROR",
  durationMs: number,
  runAt: string,
) {
  try {
    db.prepare(`
      INSERT INTO _crons (name, schedule, last_run_at, last_status, last_duration_ms, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        schedule = excluded.schedule,
        last_run_at = excluded.last_run_at,
        last_status = excluded.last_status,
        last_duration_ms = excluded.last_duration_ms,
        updated_at = excluded.updated_at
    `).run(name, schedule, runAt, status, durationMs, runAt);
  } catch (err) {
    console.error(
      `[Hooks:Cron] Failed to persist cron execution state for "${name}":`,
      err,
    );
  }
}

// Register a cron job
export function registerCron(
  name: string,
  schedule: string,
  handler: Function,
  sourceFile: string = "internal",
) {
  if (!name || !schedule || typeof handler !== "function") {
    throw new Error(
      `Invalid cronAdd arguments. Usage: cronAdd(name, schedule, handler)`,
    );
  }

  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron pattern "${schedule}" for job "${name}"`);
  }

  // Remove existing job with same name if any
  const existing = activeCrons.get(name);
  const persisted = getCronPersistedState(name);

  if (existing?.task) {
    try {
      existing.task.stop();
    } catch {}
    activeCrons.delete(name);
  }

  const cronDef: HookCronDef = {
    name,
    schedule,
    handler,
    sourceFile,
    active: true,
    last_run_at: existing?.last_run_at || persisted?.last_run_at || null,
    last_status: existing?.last_status || persisted?.last_status || null,
    last_duration_ms:
      existing?.last_duration_ms ?? persisted?.last_duration_ms ?? null,
  };

  const task = cron.schedule(schedule, () => {
    executeHookCron(name);
  });

  cronDef.task = task;
  activeCrons.set(name, cronDef);
  console.log(
    `[Hooks] Registered cron job "${name}" [${schedule}] from ${sourceFile}`,
  );
}

// Remove a cron job by name
export function unregisterCron(name: string) {
  if (activeCrons.has(name)) {
    const existing = activeCrons.get(name);
    if (existing?.task) existing.task.stop();
    activeCrons.delete(name);
    console.log(`[Hooks] Unregistered cron "${name}"`);
  }
}

// Helper to create the standard collections API for hooks, crons and routes
export function createCollectionsApi(sourceContext: string = "internal") {
  return {
    list: listCollections,

    // Execute SQL statement (INSERT, UPDATE, DELETE, DDL)
    run: (sql: string, ...params: any[]) => {
      const flattenedParams =
        params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      return db.prepare(sql).run(...flattenedParams);
    },

    // Query multiple rows (SELECT)
    query: (sql: string, ...params: any[]) => {
      const flattenedParams =
        params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      return db.prepare(sql).all(...flattenedParams);
    },

    // Alias for query
    all: (sql: string, ...params: any[]) => {
      const flattenedParams =
        params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      return db.prepare(sql).all(...flattenedParams);
    },

    // Query a single row (SELECT)
    get: (sql: string, ...params: any[]) => {
      const flattenedParams =
        params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      return db.prepare(sql).get(...flattenedParams);
    },

    // Alias for get
    getOne: (sql: string, ...params: any[]) => {
      const flattenedParams =
        params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      return db.prepare(sql).get(...flattenedParams);
    },

    // Execute multiple SQL statements / scripts
    exec: (sql: string) => {
      return db.exec(sql);
    },

    // High-level find records in a collection
    find: (
      collectionName: string,
      options: {
        filter?: string;
        params?: any[];
        sort?: string;
        limit?: number;
        offset?: number;
      } = {},
    ) => {
      let sql = `SELECT * FROM ${collectionName}`;
      const params: any[] = options.params || [];
      if (options.filter) {
        sql += ` WHERE ${options.filter}`;
      }
      if (options.sort) {
        sql += ` ORDER BY ${options.sort}`;
      }
      if (options.limit !== undefined) {
        sql += ` LIMIT ${Number(options.limit)}`;
        if (options.offset !== undefined) {
          sql += ` OFFSET ${Number(options.offset)}`;
        }
      }
      return db.prepare(sql).all(...params);
    },

    // High-level find by ID
    findById: (collectionName: string, id: string) => {
      return db.prepare(`SELECT * FROM ${collectionName} WHERE id = ?`).get(id);
    },

    // High-level insert record
    create: (collectionName: string, data: Record<string, any>) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      const payload: Record<string, any> = {
        ...data,
        id,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
      };

      const keys = Object.keys(payload);
      const placeholders = keys.map(() => "?").join(", ");
      const values = keys.map((k) => {
        const v = payload[k];
        if (v !== null && typeof v === "object") return JSON.stringify(v);
        if (typeof v === "boolean") return v ? 1 : 0;
        return v;
      });

      const sql = `INSERT INTO ${collectionName} (${keys.join(", ")}) VALUES (${placeholders})`;
      db.prepare(sql).run(...values);
      return payload;
    },

    // High-level update record
    update: (collectionName: string, id: string, data: Record<string, any>) => {
      const payload: Record<string, any> = {
        ...data,
        updated_at: new Date().toISOString(),
      };
      delete payload.id;
      delete payload.created_at;

      const keys = Object.keys(payload);
      if (keys.length === 0)
        return db
          .prepare(`SELECT * FROM ${collectionName} WHERE id = ?`)
          .get(id);

      const setClause = keys.map((k) => `${k} = ?`).join(", ");
      const values = keys.map((k) => {
        const v = payload[k];
        if (v !== null && typeof v === "object") return JSON.stringify(v);
        if (typeof v === "boolean") return v ? 1 : 0;
        return v;
      });

      values.push(id);
      db.prepare(`UPDATE ${collectionName} SET ${setClause} WHERE id = ?`).run(
        ...values,
      );
      return db.prepare(`SELECT * FROM ${collectionName} WHERE id = ?`).get(id);
    },

    // High-level delete record
    delete: (collectionName: string, id: string) => {
      return db.prepare(`DELETE FROM ${collectionName} WHERE id = ?`).run(id);
    },

    // High-level count records
    count: (collectionName: string, whereClause?: string, ...params: any[]) => {
      const flattenedParams =
        params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const sql = whereClause
        ? `SELECT COUNT(*) as total FROM ${collectionName} WHERE ${whereClause}`
        : `SELECT COUNT(*) as total FROM ${collectionName}`;
      const row = db.prepare(sql).get(...flattenedParams) as any;
      return row?.total || 0;
    },
  };
}

// Resolve paths safely within _public directory
export function resolvePublicPath(relPath: string = ""): string {
  const cleanPath = relPath.replace(/^[\/\\]+/, "");
  const normalized = path.normalize(cleanPath);
  const fullPath = path.resolve(PUBLIC_DIR, normalized);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    throw new Error(
      "Access denied: Invalid file path outside _public directory",
    );
  }
  return fullPath;
}

// Helper to provide files API for hooks to interact with _public directory
export function createPublicFilesApi() {
  const save = (
    relPath: string,
    content: string | Buffer | Uint8Array | object,
    isBase64 = false,
  ) => {
    if (!relPath) throw new Error("File path is required for savePublicFile");
    const fullPath = resolvePublicPath(relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    if (isBase64 && typeof content === "string") {
      fs.writeFileSync(fullPath, Buffer.from(content, "base64"));
    } else if (Buffer.isBuffer(content) || content instanceof Uint8Array) {
      fs.writeFileSync(fullPath, content);
    } else if (typeof content === "object" && content !== null) {
      fs.writeFileSync(fullPath, JSON.stringify(content, null, 2), "utf8");
    } else {
      fs.writeFileSync(fullPath, String(content ?? ""), "utf8");
    }

    const stats = fs.statSync(fullPath);
    return {
      name: relPath.replace(/\\/g, "/"),
      path: fullPath,
      sizeBytes: stats.size,
      saved: true,
      updatedAt: stats.mtime.toISOString(),
    };
  };

  const saveJson = (relPath: string, data: any, spaces: number = 2) => {
    if (!relPath) throw new Error("File path is required for savePublicJson");
    const fullPath = resolvePublicPath(relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(data, null, spaces), "utf8");
    const stats = fs.statSync(fullPath);
    return {
      name: relPath.replace(/\\/g, "/"),
      path: fullPath,
      sizeBytes: stats.size,
      saved: true,
      updatedAt: stats.mtime.toISOString(),
    };
  };

  const read = (relPath: string) => {
    const fullPath = resolvePublicPath(relPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      throw new Error(`File "${relPath}" not found in _public`);
    }
    return fs.readFileSync(fullPath, "utf8");
  };

  const readBuffer = (relPath: string) => {
    const fullPath = resolvePublicPath(relPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      throw new Error(`File "${relPath}" not found in _public`);
    }
    return fs.readFileSync(fullPath);
  };

  const readJson = (relPath: string) => {
    const fullPath = resolvePublicPath(relPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      throw new Error(`File "${relPath}" not found in _public`);
    }
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  };

  const exists = (relPath: string) => {
    try {
      const fullPath = resolvePublicPath(relPath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  };

  const remove = (relPath: string) => {
    const fullPath = resolvePublicPath(relPath);
    if (!fs.existsSync(fullPath)) {
      return false;
    }
    const trashDir = path.resolve(process.cwd(), ".trash");
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }
    const safeClean = relPath.replace(/[\/\\]/g, "_");
    const trashTarget = path.join(
      trashDir,
      `${Date.now()}_public_${safeClean}`,
    );
    fs.renameSync(fullPath, trashTarget);
    return true;
  };

  const mkdir = (relPath: string) => {
    const fullPath = resolvePublicPath(relPath);
    fs.mkdirSync(fullPath, { recursive: true });
    return fullPath;
  };

  const list = (relDir: string = "") => {
    const targetDir = relDir ? resolvePublicPath(relDir) : PUBLIC_DIR;
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      return [];
    }
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.name !== ".git" && e.name !== ".trash" && e.name !== "node_modules",
      )
      .map((e) => ({
        name: e.name,
        path: path
          .relative(PUBLIC_DIR, path.join(targetDir, e.name))
          .replace(/\\/g, "/"),
        isFolder: e.isDirectory(),
      }));
  };

  const getPath = (relPath: string = "") => resolvePublicPath(relPath);

  return {
    dir: PUBLIC_DIR,
    path: getPath,
    save,
    saveFile: save,
    saveJson,
    read,
    readFile: read,
    readBuffer,
    readJson,
    exists,
    delete: remove,
    deleteFile: remove,
    remove,
    mkdir,
    createFolder: mkdir,
    list,
  };
}

// Global active execution log buffer for capturing cron/route output
let activeCronExecutionBuffer: {
  cronName: string;
  logs: string[];
  onLog?: (line: string) => void;
} | null = null;

// Execute a registered cron job with real-time log callback
export async function executeHookCron(
  name: string,
  onLog?: (line: string) => void,
  executionId?: string,
): Promise<{
  success: boolean;
  durationMs: number;
  output?: string[];
  error?: string;
}> {
  const cronDef = activeCrons.get(name);
  if (!cronDef) {
    throw new Error(`Cron job "${name}" not found`);
  }

  const start = performance.now();
  const now = new Date().toISOString();
  const executionLogs: string[] = [];
  activeCronExecutionBuffer = { cronName: name, logs: executionLogs, onLog };

  console.log(`[Hooks:Cron] Running job "${name}"...`);

  const collectionsApi = createCollectionsApi(`cron:${name}`);
  const cronLogger = (...args: any[]) => {
    const formatted = args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
      .join(" ");
    executionLogs.push(formatted);
    if (onLog) {
      onLog(formatted);
    }
    console.log(`[Cron:${name}]`, ...args);
    logToDb({
      level: "INFO",
      method: "CRON_LOG",
      path: `/cron/${name}`,
      status: 200,
      duration_ms: 0,
      error_message: formatted,
      metadata_json: JSON.stringify({
        cronName: name,
        schedule: cronDef.schedule,
        sourceFile: cronDef.sourceFile,
      }),
    });
  };

  const execKey =
    executionId ||
    `cron_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  activeRunningProcesses.set(execKey, {
    commandName: name,
    cancel: () => {
      console.log(`[Hooks:Cron] Cancellation requested for cron "${name}"`);
    },
  });

  try {
    const publicFilesApi = createPublicFilesApi();
    const sandboxContext = {
      db,
      collections: collectionsApi,
      publicFiles: publicFilesApi,
      public: publicFilesApi,
      savePublicFile: publicFilesApi.save,
      savePublicJson: publicFilesApi.saveJson,
      readPublicFile: publicFilesApi.read,
      readPublicJson: publicFilesApi.readJson,
      deletePublicFile: publicFilesApi.delete,
      publicPath: publicFilesApi.path,
      PUBLIC_DIR,
      log: cronLogger,
      $app: {
        db,
        collections: collectionsApi,
        publicFiles: publicFilesApi,
        public: publicFilesApi,
        savePublicFile: publicFilesApi.save,
        savePublicJson: publicFilesApi.saveJson,
        readPublicFile: publicFilesApi.read,
        readPublicJson: publicFilesApi.readJson,
        deletePublicFile: publicFilesApi.delete,
        publicPath: publicFilesApi.path,
        PUBLIC_DIR,
        log: cronLogger,
      },
    };

    await cronDef.handler(sandboxContext);
    const duration = Number((performance.now() - start).toFixed(2));

    cronDef.last_run_at = now;
    cronDef.last_status = "SUCCESS";
    cronDef.last_duration_ms = duration;
    saveCronExecution(name, cronDef.schedule, "SUCCESS", duration, now);

    logToDb({
      level: "INFO",
      method: "CRON",
      path: `/cron/${name}`,
      status: 200,
      duration_ms: duration,
      error_message: `Cron [${name}] completed successfully (${duration}ms). ${executionLogs.length} log(s) captured.`,
      metadata_json: JSON.stringify({
        cronName: name,
        schedule: cronDef.schedule,
        sourceFile: cronDef.sourceFile,
        output: executionLogs,
      }),
    });

    console.log(`[Hooks:Cron] Job "${name}" finished in ${duration}ms.`);
    return { success: true, durationMs: duration, output: executionLogs };
  } catch (err: any) {
    const duration = Number((performance.now() - start).toFixed(2));
    const stack = err?.stack || "";

    cronDef.last_run_at = now;
    cronDef.last_status = "ERROR";
    cronDef.last_duration_ms = duration;
    saveCronExecution(name, cronDef.schedule, "ERROR", duration, now);

    logToDb({
      level: "ERROR",
      method: "CRON",
      path: `/cron/${name}`,
      status: 500,
      duration_ms: duration,
      error_message: `Cron job [${name}] failed: ${err?.message}`,
      stack_trace: stack,
      metadata_json: JSON.stringify({
        cronName: name,
        schedule: cronDef.schedule,
        sourceFile: cronDef.sourceFile,
        output: executionLogs,
      }),
    });

    console.error(`[Hooks:Cron] Job "${name}" failed:`, err);
    return {
      success: false,
      durationMs: duration,
      output: executionLogs,
      error: err?.message,
    };
  } finally {
    activeCronExecutionBuffer = null;
  }
}

// Create execution sandbox scope
export function createSandboxScope(
  filePath: string,
  filename: string,
  modModule: any = { exports: {} },
  modExports: any = modModule.exports,
  customReq?: Function,
) {
  const hookRequire = customReq || createHookRequire(filePath);
  const collectionsApi = createCollectionsApi(filename);
  const publicFilesApi = createPublicFilesApi();

  const hookLogger = (...args: any[]) => {
    const formatted = args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
      .join(" ");
    console.log(`[Hook:${filename}]`, ...args);

    if (activeCronExecutionBuffer) {
      activeCronExecutionBuffer.logs.push(formatted);
      if (activeCronExecutionBuffer.onLog) {
        activeCronExecutionBuffer.onLog(formatted);
      }
    }

    logToDb({
      level: "INFO",
      method: "HOOK_LOG",
      path: `/_hooks/${filename}`,
      status: 200,
      duration_ms: 0,
      error_message: formatted,
      metadata_json: JSON.stringify({
        sourceFile: filename,
        args: args.length === 1 ? args[0] : args,
      }),
    });
  };

  const scope: Record<string, any> = {
    require: hookRequire,
    module: modModule,
    exports: modExports,
    __filename: filePath,
    __dirname: path.dirname(filePath),
    helpers: Object.fromEntries(globalHelpers),
    registerHelper: (name: string, fn: any) => {
      globalHelpers.set(name, fn);
    },
    routerAdd: (method: string, routePath: string, arg3: any, arg4?: any) => {
      let handler: Function;
      let authLevel: "public" | "auth" | "superuser" = "public";

      if (typeof arg3 === "function") {
        handler = arg3;
        if (typeof arg4 === "string") authLevel = arg4 as any;
      } else if (typeof arg4 === "function") {
        authLevel = (typeof arg3 === "string" ? arg3 : "public") as any;
        handler = arg4;
      } else {
        throw new Error(
          `routerAdd for ${method} ${routePath} requires a valid handler function.`,
        );
      }

      registerRoute(method, routePath, handler, authLevel, filename);
    },
    cronAdd: (name: string, schedule: string, handler: Function) => {
      registerCron(name, schedule, handler, filename);
    },
    cronRemove: (name: string) => {
      unregisterCron(name);
    },
    commandAdd: (name: string, arg2: any, arg3?: any, arg4?: any) => {
      let description = typeof arg2 === "string" ? arg2 : `Command ${name}`;
      let handler: Function | undefined =
        typeof arg2 === "function"
          ? arg2
          : typeof arg3 === "function"
            ? arg3
            : undefined;
      let options: HookCommandOptionDef[] = Array.isArray(arg3)
        ? arg3
        : Array.isArray(arg4)
          ? arg4
          : [];
      let usage: string | undefined =
        typeof arg4 === "string" ? arg4 : undefined;
      registerCommand(
        name,
        description,
        filename,
        handler,
        options,
        usage,
        filePath,
        "custom",
      );
    },
    onRecordAfterCreate: (collection: string, handler: Function) => {
      onRecordEvent("create", collection, handler);
    },
    onRecordAfterUpdate: (collection: string, handler: Function) => {
      onRecordEvent("update", collection, handler);
    },
    onRecordAfterDelete: (collection: string, handler: Function) => {
      onRecordEvent("delete", collection, handler);
    },
    onRecordEvent: (
      action: "create" | "update" | "delete" | "*",
      collection: string,
      handler: Function,
    ) => {
      onRecordEvent(action, collection, handler);
    },
    onEvent: (topic: string, handler: Function) => {
      onCustomEvent(topic, handler);
    },
    events: {
      emit: (topic: string, data: any, eventName?: string) =>
        broadcastCustomEvent(topic, data, eventName),
      on: (topic: string, handler: Function) => onCustomEvent(topic, handler),
    },
    realtime: {
      publish: (topic: string, data: any, eventName?: string) =>
        broadcastCustomEvent(topic, data, eventName),
      broadcast: (
        action: "create" | "update" | "delete",
        collection: string,
        record: any,
      ) => broadcastRecordEvent(action, collection, record),
    },
    db,
    collections: collectionsApi,
    publicFiles: publicFilesApi,
    public: publicFilesApi,
    savePublicFile: publicFilesApi.save,
    savePublicJson: publicFilesApi.saveJson,
    readPublicFile: publicFilesApi.read,
    readPublicJson: publicFilesApi.readJson,
    deletePublicFile: publicFilesApi.delete,
    existsPublicFile: publicFilesApi.exists,
    publicPath: publicFilesApi.path,
    PUBLIC_DIR,
    log: hookLogger,
    $app: {
      require: hookRequire,
      helpers: Object.fromEntries(globalHelpers),
      registerHelper: (name: string, fn: any) => {
        globalHelpers.set(name, fn);
      },
      db,
      collections: collectionsApi,
      publicFiles: publicFilesApi,
      public: publicFilesApi,
      savePublicFile: publicFilesApi.save,
      savePublicJson: publicFilesApi.saveJson,
      readPublicFile: publicFilesApi.read,
      readPublicJson: publicFilesApi.readJson,
      deletePublicFile: publicFilesApi.delete,
      existsPublicFile: publicFilesApi.exists,
      publicPath: publicFilesApi.path,
      PUBLIC_DIR,
      routerAdd: (method: string, routePath: string, arg3: any, arg4?: any) => {
        let handler: Function;
        let authLevel: "public" | "auth" | "superuser" = "public";

        if (typeof arg3 === "function") {
          handler = arg3;
          if (typeof arg4 === "string") authLevel = arg4 as any;
        } else if (typeof arg4 === "function") {
          authLevel = (typeof arg3 === "string" ? arg3 : "public") as any;
          handler = arg4;
        } else {
          throw new Error(`routerAdd requires a handler function.`);
        }

        registerRoute(method, routePath, handler, authLevel, filename);
      },
      cronAdd: (name: string, schedule: string, handler: Function) => {
        registerCron(name, schedule, handler, filename);
      },
      cronRemove: (name: string) => {
        unregisterCron(name);
      },
      commandAdd: (name: string, arg2: any, arg3?: any, arg4?: any) => {
        let description = typeof arg2 === "string" ? arg2 : `Command ${name}`;
        let handler: Function | undefined =
          typeof arg2 === "function"
            ? arg2
            : typeof arg3 === "function"
              ? arg3
              : undefined;
        let options: HookCommandOptionDef[] = Array.isArray(arg3)
          ? arg3
          : Array.isArray(arg4)
            ? arg4
            : [];
        let usage: string | undefined =
          typeof arg4 === "string" ? arg4 : undefined;
        registerCommand(
          name,
          description,
          filename,
          handler,
          options,
          usage,
          filePath,
          "custom",
        );
      },
      onRecordAfterCreate: (collection: string, handler: Function) => {
        onRecordEvent("create", collection, handler);
      },
      onRecordAfterUpdate: (collection: string, handler: Function) => {
        onRecordEvent("update", collection, handler);
      },
      onRecordAfterDelete: (collection: string, handler: Function) => {
        onRecordEvent("delete", collection, handler);
      },
      onEvent: (topic: string, handler: Function) => {
        onCustomEvent(topic, handler);
      },
      events: {
        emit: (topic: string, data: any, eventName?: string) =>
          broadcastCustomEvent(topic, data, eventName),
        on: (topic: string, handler: Function) => onCustomEvent(topic, handler),
      },
      realtime: {
        publish: (topic: string, data: any, eventName?: string) =>
          broadcastCustomEvent(topic, data, eventName),
        broadcast: (
          action: "create" | "update" | "delete",
          collection: string,
          record: any,
        ) => broadcastRecordEvent(action, collection, record),
      },
      log: hookLogger,
    },
  };

  return scope;
}

// Extract exact error location (line, column, snippet) from stack or error object
function extractErrorLocation(err: any, rawCode: string, filePath: string) {
  const message = err?.message || String(err);
  let line: number | null = null;
  let column: number | null = null;

  const stack = err?.stack || "";
  const lines = stack.split("\n");

  const fileName = path.basename(filePath);
  const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Regex specifically targeting the target hook file or VM compilation context
  const fileRegex = new RegExp(
    `(?:${escapedPath}|${escapedFileName}|evalmachine\\.<anonymous>):(\\d+)(?::(\\d+))?`,
    "i",
  );

  for (const l of lines) {
    // Ignore internal server runner frames and node core internals
    if (
      l.includes("server/hooks.ts") ||
      l.includes("server\\hooks.ts") ||
      l.includes("node_modules") ||
      l.includes("node:internal") ||
      l.includes("internal/timers")
    ) {
      continue;
    }

    const match = l.match(fileRegex);
    if (match) {
      line = parseInt(match[1], 10);
      column = match[2] ? parseInt(match[2], 10) : 1;
      break;
    }
  }

  // Fallback: check other stack lines that are NOT internal server files
  if (line === null) {
    for (const l of lines) {
      if (
        l.includes("server/hooks.ts") ||
        l.includes("server\\hooks.ts") ||
        l.includes("node_modules") ||
        l.includes("node:internal") ||
        l.includes("internal/timers")
      ) {
        continue;
      }
      const genericMatch = l.match(/:(\d+)(?::(\d+))?\)?$/);
      if (genericMatch) {
        line = parseInt(genericMatch[1], 10);
        column = genericMatch[2] ? parseInt(genericMatch[2], 10) : 1;
        break;
      }
    }
  }

  if (err.lineNumber !== undefined && typeof err.lineNumber === "number") {
    line = err.lineNumber;
  }
  if (err.columnNumber !== undefined && typeof err.columnNumber === "number") {
    column = err.columnNumber;
  }
  if (err.loc?.line !== undefined && typeof err.loc.line === "number") {
    line = err.loc.line;
  }
  if (err.loc?.column !== undefined && typeof err.loc.column === "number") {
    column = err.loc.column;
  }

  let snippet: string | null = null;
  if (line !== null && line > 0) {
    const codeLines = rawCode.split("\n");
    const targetIdx = line - 1;
    if (targetIdx < codeLines.length) {
      const startIdx = Math.max(0, targetIdx - 2);
      const endIdx = Math.min(codeLines.length - 1, targetIdx + 2);

      const snippetLines: string[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const lineNum = String(i + 1).padStart(4, " ");
        const isTarget = i === targetIdx;
        const prefix = isTarget ? "> " : "  ";
        snippetLines.push(`${prefix}${lineNum} | ${codeLines[i]}`);

        if (isTarget && column !== null && column > 0) {
          const colPos = Math.min(column - 1, codeLines[i].length);
          const padding = " ".repeat(7 + Math.max(0, colPos));
          snippetLines.push(`${padding}^ ${message}`);
        }
      }
      snippet = snippetLines.join("\n");
    }
  }

  return {
    message,
    line,
    column,
    snippet,
    stack,
  };
}

// Load a single hook file in a sandboxed evaluation context
export async function loadHookFile(filePath: string) {
  const relPath = path.relative(HOOKS_DIR, filePath).replace(/\\/g, "/");
  const stats = fs.statSync(filePath);
  const rawCode = fs.readFileSync(filePath, "utf8");

  try {
    const modExports: any = {};
    const modModule = { exports: modExports };
    const hookRequire = createHookRequire(filePath);
    const sandboxScope = createSandboxScope(
      filePath,
      relPath,
      modModule,
      modExports,
      hookRequire,
    );

    const processedCode = preprocessHookCode(rawCode);

    const paramNames = Object.keys(sandboxScope);
    const paramValues = Object.values(sandboxScope);

    const fn = vm.compileFunction(
      `return (async () => {\n${processedCode}\n})();`,
      paramNames,
      {
        filename: filePath,
        lineOffset: -1, // Compensate for wrapper line to keep original line numbers 1:1
      },
    );
    const asyncRunner = fn(...paramValues);
    await asyncRunner;

    moduleCache.set(filePath, modModule.exports);

    // Register CLI script metadata if detected
    const cliMeta = extractCliScriptMeta(filePath, rawCode);
    if (cliMeta) {
      activeCommands.set(cliMeta.name, cliMeta);
      console.log(
        `[Hooks:Command] Detected CLI script command: ${cliMeta.name} (${cliMeta.options?.length || 0} options)`,
      );
    }

    fileStatuses.set(relPath, {
      filename: relPath,
      fullPath: filePath,
      sizeBytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
      error: null,
      errorLine: null,
      errorCol: null,
      errorSnippet: null,
      errorStack: null,
    });
    console.log(`[Hooks] Successfully loaded: ${relPath}`);
  } catch (err: any) {
    // If it's a CLI script that threw because it needs command line execution (e.g. process.exit or argument parsing), still register its command metadata
    const cliMeta = extractCliScriptMeta(filePath, rawCode);
    if (cliMeta) {
      activeCommands.set(cliMeta.name, cliMeta);
    }

    const errInfo = extractErrorLocation(err, rawCode, filePath);

    console.error(
      `\n========================================================================`,
    );
    console.error(`[Hooks] Error loading hook file: ${relPath}`);
    console.error(
      `------------------------------------------------------------------------`,
    );
    console.error(`Error: ${errInfo.message}`);
    if (errInfo.line !== null) {
      console.error(
        `Location: ${filePath}:${errInfo.line}:${errInfo.column || 1}`,
      );
    }
    if (errInfo.snippet) {
      console.error(`\n${errInfo.snippet}\n`);
    } else {
      console.error(err.stack || err);
    }
    console.error(
      `========================================================================\n`,
    );

    fileStatuses.set(relPath, {
      filename: relPath,
      fullPath: filePath,
      sizeBytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
      error: errInfo.message,
      errorLine: errInfo.line,
      errorCol: errInfo.column,
      errorSnippet: errInfo.snippet,
      errorStack: errInfo.stack,
    });
  }
}

function isExecutableHook(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.endsWith(".js") ||
    lower.endsWith(".ts") ||
    lower.endsWith(".cjs") ||
    lower.endsWith(".mjs")
  );
}

function getAllHookFiles(
  dir: string,
  baseDir = dir,
): { fullPath: string; relPath: string; isExecutable: boolean }[] {
  let results: { fullPath: string; relPath: string; isExecutable: boolean }[] =
    [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === ".trash" ||
      entry.name.startsWith(".")
    )
      continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllHookFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      results.push({
        fullPath,
        relPath,
        isExecutable: isExecutableHook(entry.name),
      });
    }
  }
  return results;
}

// Load all hook files from _hooks/ directory
export async function loadAllHooks() {
  initHooksDir();
  resetHooksRegistry();

  if (!fs.existsSync(HOOKS_DIR)) return;

  const allFiles = getAllHookFiles(HOOKS_DIR);
  let executableCount = 0;

  for (const file of allFiles) {
    if (file.isExecutable) {
      executableCount++;
      await loadHookFile(file.fullPath);
    } else {
      // Record non-JS files in fileStatuses so they can be viewed, edited and managed
      try {
        const stats = fs.statSync(file.fullPath);
        fileStatuses.set(file.relPath, {
          filename: file.relPath,
          fullPath: file.fullPath,
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString(),
          error: null,
        });
      } catch {}
    }
  }

  console.log(
    `[Hooks] Loaded ${allFiles.length} files in _hooks/ (${executableCount} active script modules, ${activeRoutes.size} routes, ${activeCrons.size} crons).`,
  );
}

// Watch _hooks/ for live reload
export function setupHooksWatcher() {
  if (isWatcherActive || !fs.existsSync(HOOKS_DIR)) return;

  let debounceTimer: NodeJS.Timeout | null = null;
  try {
    fs.watch(HOOKS_DIR, (_eventType, _filename) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(
          `[Hooks] Detected file changes in ${HOOKS_DIR}, reloading hooks...`,
        );
        loadAllHooks().catch((err) =>
          console.error("[Hooks] Reload error:", err),
        );
      }, 200);
    });
    isWatcherActive = true;
    console.log(`[Hooks] File watcher active on ${HOOKS_DIR}`);
  } catch (err) {
    console.warn(`[Hooks] Could not start file watcher:`, err);
  }
}

// Global initialization entrypoint
export async function initHooks() {
  initHooksDir();
  await loadAllHooks();
  setupHooksWatcher();
}

// Express dynamic route matching & execution middleware
export async function executeHooksRoute(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const reqPath = normalizePath(req.path);
  const method = req.method.toUpperCase();

  // 1. Exact match for METHOD + PATH
  let matchedRoute = activeRoutes.get(getRouteKey(method, reqPath));

  // 2. ALL match for PATH
  if (!matchedRoute) {
    matchedRoute = activeRoutes.get(getRouteKey("ALL", reqPath));
  }

  if (!matchedRoute) {
    return next();
  }

  const auth = (req as any).auth as AuthPayload | undefined;

  // Authorization check
  if (matchedRoute.authLevel === "superuser" && (!auth || !auth.isSuperuser)) {
    return res
      .status(403)
      .json({ error: "Superuser access required for this hook endpoint" });
  }

  if (matchedRoute.authLevel === "auth" && !auth) {
    return res
      .status(401)
      .json({ error: "Authentication required for this hook endpoint" });
  }

  const start = performance.now();

  // Create AlsaBase context object `c`
  const c = {
    req,
    res,
    query: req.query,
    body: req.body,
    params: req.params,
    headers: req.headers,
    user: auth || null,
    auth: auth || null,
    get: (key: string) => {
      if (key === "auth" || key === "user") return auth || null;
      if (key === "req") return req;
      if (key === "res") return res;
      return undefined;
    },
    json: (data: any, status = 200) => {
      if (!res.headersSent) res.status(status).json(data);
    },
    error: (msg: string, status = 400) => {
      if (!res.headersSent)
        res.status(status).json({ error: msg, code: status });
    },
    string: (text: string, status = 200) => {
      if (!res.headersSent) res.status(status).type("text/plain").send(text);
    },
    html: (htmlStr: string, status = 200) => {
      if (!res.headersSent) res.status(status).type("text/html").send(htmlStr);
    },
    db,
    collections: createCollectionsApi(matchedRoute.path),
    publicFiles: createPublicFilesApi(),
    public: createPublicFilesApi(),
    savePublicFile: createPublicFilesApi().save,
    savePublicJson: createPublicFilesApi().saveJson,
    readPublicFile: createPublicFilesApi().read,
    readPublicJson: createPublicFilesApi().readJson,
    deletePublicFile: createPublicFilesApi().delete,
    publicPath: createPublicFilesApi().path,
    PUBLIC_DIR,
    log: (...args: any[]) => {
      const formatted = args
        .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
      console.log(`[Route:${matchedRoute!.path}]`, ...args);
      logToDb({
        level: "INFO",
        method: "ROUTE_LOG",
        path: matchedRoute!.path,
        status: 200,
        duration_ms: 0,
        error_message: formatted,
        metadata_json: JSON.stringify({
          route: matchedRoute!.path,
          sourceFile: matchedRoute!.sourceFile,
          args: args.length === 1 ? args[0] : args,
        }),
      });
    },
  };

  try {
    const result = await matchedRoute.handler(c, req, res);
    const duration = Number((performance.now() - start).toFixed(2));

    if (!res.headersSent) {
      if (result !== undefined) {
        res.json(result);
      } else {
        res.json({ success: true });
      }
    }

    logToDb({
      level: "INFO",
      method: req.method,
      path: req.originalUrl || req.path,
      status: res.statusCode || 200,
      duration_ms: duration,
      metadata_json: JSON.stringify({
        hookPath: matchedRoute.path,
        sourceFile: matchedRoute.sourceFile,
      }),
    });
  } catch (err: any) {
    const duration = Number((performance.now() - start).toFixed(2));
    const stack = err?.stack || "";

    logToDb({
      level: "ERROR",
      method: req.method,
      path: req.originalUrl || req.path,
      status: 500,
      duration_ms: duration,
      error_message: `Hook route [${matchedRoute.path}] error: ${err?.message}`,
      stack_trace: stack,
      metadata_json: JSON.stringify({
        hookPath: matchedRoute.path,
        sourceFile: matchedRoute.sourceFile,
      }),
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: `Hook execution failed: ${err.message}`,
        stack: auth?.isSuperuser ? stack : undefined,
      });
    }
  }
}

// Prefixes to strictly ignore (CSS variables, HTML attributes, UI styles)
const IGNORED_FLAG_PREFIXES = [
  "bg-",
  "border-",
  "accent-",
  "sidebar-",
  "color-",
  "font-",
  "text-",
  "shadow-",
  "radius-",
  "btn-",
  "card-",
  "input-",
  "modal-",
  "header-",
  "panel-",
];

function isValidCliFlag(flag: string): boolean {
  if (!flag) return false;
  const clean = flag.replace(/^--?/, "").toLowerCase();
  if (clean.length < 1) return false;
  // If it's only dashes or underscores, reject
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(clean)) return false;
  // If it matches CSS variable prefixes, reject
  for (const prefix of IGNORED_FLAG_PREFIXES) {
    if (clean.startsWith(prefix)) return false;
  }
  return true;
}

// Extract comprehensive metadata and CLI option flags from standalone script files
export function extractCliScriptMeta(
  filePath: string,
  rawCode: string,
): HookCommandDef | null {
  const filename = path.basename(filePath);
  const isCli =
    rawCode.startsWith("#!") ||
    rawCode.includes("process.argv") ||
    rawCode.includes("parseArgs") ||
    rawCode.includes("--list") ||
    rawCode.includes("--help") ||
    filename.endsWith(".mjs") ||
    filename.startsWith("download_") ||
    filename.startsWith("script_") ||
    filename.startsWith("cli_");

  if (!isCli) return null;

  // 1. Extract clean description from top JSDoc or comments
  let description = `${filename} CLI Script`;
  const commentBlockMatch = rawCode.match(/\/\*\*?([\s\S]*?)\*\//);
  if (commentBlockMatch) {
    const lines = commentBlockMatch[1]
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter(
        (l) => l && !l.toLowerCase().startsWith("usage:") && !l.startsWith("@"),
      );
    if (lines.length > 0) {
      description = lines[0];
      if (lines.length > 1 && !lines[1].toLowerCase().startsWith("usage:")) {
        description += " - " + lines[1];
      }
    }
  }

  // 2. Extract clean multi-line Usage block
  let usage = `node _hooks/${filename}`;
  if (commentBlockMatch) {
    const commentText = commentBlockMatch[1];
    const usageIndex = commentText.search(/usage:/i);
    if (usageIndex !== -1) {
      const usageLines = commentText
        .slice(usageIndex)
        .split("\n")
        .slice(1) // skip the "Usage:" title line
        .map((l) => l.replace(/^\s*\*\s?/, "").trim())
        .filter(
          (l) =>
            l.length > 0 &&
            !l.startsWith("@") &&
            (l.startsWith("node") ||
              l.startsWith("$") ||
              l.startsWith("npm") ||
              l.startsWith("./")),
        );
      if (usageLines.length > 0) {
        usage = usageLines.join("\n");
      }
    }
  }

  // 3. Extract ALL option flags precisely from CLI parsing logic only
  const optionsMap = new Map<string, HookCommandOptionDef>();

  // A. Scan parseArgs function or argument handling block specifically
  const parseArgsMatch = rawCode.match(
    /function\s+parseArgs[^{]*\{([\s\S]*?\n\})/,
  );
  const argSection = parseArgsMatch
    ? parseArgsMatch[1]
    : rawCode.slice(0, 4000);

  const ifConditionRegex = /(?:if|else\s+if)\s*\(([^)]+)\)\s*\{([^}]*)\}/gs;
  let ifMatch;
  while ((ifMatch = ifConditionRegex.exec(argSection)) !== null) {
    const condition = ifMatch[1];
    const body = ifMatch[2];

    // Must be checking arg / process.argv / options
    if (!condition.includes("arg") && !condition.includes("process.argv")) {
      continue;
    }

    const flagStrings: string[] = [];
    const strRegex = /['"](--[a-zA-Z][a-zA-Z0-9_-]*|-[a-zA-Z0-9])['"]/g;
    let sm;
    while ((sm = strRegex.exec(condition)) !== null) {
      if (isValidCliFlag(sm[1])) {
        flagStrings.push(sm[1]);
      }
    }

    if (flagStrings.length > 0) {
      const longFlags = flagStrings.filter((f) => f.startsWith("--"));
      const shortFlags = flagStrings.filter((f) => !f.startsWith("--"));
      const primaryFlag = longFlags[0] || shortFlags[0];
      if (!primaryFlag) continue;

      const flagKey = primaryFlag.replace(/^--?/, "").toLowerCase();
      if (!isValidCliFlag(primaryFlag)) continue;

      const otherAliases = flagStrings.filter((f) => f !== primaryFlag);
      const isParam =
        body.includes("args[++i]") ||
        body.includes("parseInt(") ||
        body.includes("parseFloat(") ||
        body.includes("path.resolve(");

      const paramName = isParam ? "value" : undefined;
      const paramType = isParam
        ? body.includes("parseInt") || body.includes("parseFloat")
          ? "number"
          : "string"
        : "boolean";
      const desc = paramName ? `Specify ${paramName}` : `Flag: ${primaryFlag}`;

      optionsMap.set(flagKey, {
        name: `${primaryFlag}${paramName ? ` <${paramName}>` : ""}`,
        flag: primaryFlag,
        param: paramName,
        aliases: otherAliases.length > 0 ? otherAliases : undefined,
        description: desc,
        type: paramType as any,
      });
    }
  }

  // B. Scan JSDoc / Usage comments for documented flags and parameters
  const docFlagRegex =
    /--([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+<([a-zA-Z0-9_]+)>|\s+\[([a-zA-Z0-9_]+)\])?/g;
  let docMatch;
  const searchArea = commentBlockMatch ? commentBlockMatch[1] : "";
  while ((docMatch = docFlagRegex.exec(searchArea)) !== null) {
    const rawFlagName = docMatch[1];
    if (!isValidCliFlag(`--${rawFlagName}`)) continue;

    const flagKey = rawFlagName.toLowerCase();
    if (flagKey.replace(/[-_]/g, "").length === 0) continue;

    // Check if the match accidentally captured another flag as a parameter
    let paramName: string | undefined = docMatch[2] || docMatch[3];
    if (
      paramName &&
      (paramName.startsWith("-") || paramName.startsWith("--"))
    ) {
      paramName = undefined;
    }

    const finalParam = paramName;
    const finalType = finalParam ? "string" : "boolean";
    const desc = finalParam ? `Specify ${finalParam}` : `Flag: --${docMatch[1]}`;

    if (!optionsMap.has(flagKey)) {
      optionsMap.set(flagKey, {
        name: `--${docMatch[1]}${finalParam ? ` <${finalParam}>` : ""}`,
        flag: `--${docMatch[1]}`,
        param: finalParam,
        description: desc,
        type: finalType as any,
      });
    } else if (finalParam && !optionsMap.get(flagKey)!.param) {
      const existing = optionsMap.get(flagKey)!;
      existing.param = finalParam;
      existing.name = `${existing.flag || `--${flagKey}`} <${finalParam}>`;
      existing.type = finalType as any;
    }
  }

  const options = Array.from(optionsMap.values());

  return {
    name: filename,
    description,
    usage,
    sourceFile: filename,
    type: "script",
    options,
    scriptPath: filePath,
  };
}

// Active running command processes for cancellation / Ctrl+C
export const activeRunningProcesses = new Map<
  string,
  {
    commandName: string;
    child?: any;
    cancel: () => void;
  }
>();

export function cancelRunningCommand(
  executionId?: string,
  name?: string,
): boolean {
  if (executionId && activeRunningProcesses.has(executionId)) {
    const entry = activeRunningProcesses.get(executionId);
    if (entry) {
      entry.cancel();
      activeRunningProcesses.delete(executionId);
      return true;
    }
  }

  if (name) {
    let cancelled = false;
    for (const [id, entry] of activeRunningProcesses.entries()) {
      if (entry.commandName === name) {
        entry.cancel();
        activeRunningProcesses.delete(id);
        cancelled = true;
      }
    }
    return cancelled;
  }

  // Cancel all if no params given
  let anyCancelled = false;
  for (const [id, entry] of activeRunningProcesses.entries()) {
    entry.cancel();
    activeRunningProcesses.delete(id);
    anyCancelled = true;
  }
  return anyCancelled;
}

// Execute a registered hook command or CLI script with optional real-time line callback and execution ID for cancellation
export async function executeHookCommand(
  name: string,
  rawArgs: string | string[] = [],
  onLog?: (line: string) => void,
  executionId?: string,
): Promise<{
  success: boolean;
  output: string[];
  durationMs: number;
  exitCode: number;
  error?: string;
}> {
  const start = performance.now();
  const cmd = activeCommands.get(name);
  if (!cmd) {
    throw new Error(`Command "${name}" not found.`);
  }

  let argsArray: string[] = [];
  if (typeof rawArgs === "string") {
    // Parse arguments respecting double/single quotes
    const matches = rawArgs.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    argsArray = matches.map((arg) => arg.replace(/^['"]|['"]$/g, ""));
  } else if (Array.isArray(rawArgs)) {
    argsArray = rawArgs;
  }

  const collectionsApi = createCollectionsApi(cmd.sourceFile);
  const duration = Number((performance.now() - start).toFixed(2));

  if (cmd.type === "script" && cmd.scriptPath) {
    const { spawn, exec } = await import("node:child_process");
    const output: string[] = [];

    return new Promise((resolve) => {
      const child = spawn(process.execPath, [cmd.scriptPath!, ...argsArray], {
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      const execKey =
        executionId ||
        `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      activeRunningProcesses.set(execKey, {
        commandName: name,
        child,
        cancel: () => {
          try {
            if (process.platform === "win32") {
              if (child.pid) {
                exec(`taskkill /pid ${child.pid} /T /F`, () => {});
              }
            } else {
              child.kill("SIGINT");
              setTimeout(() => {
                try {
                  child.kill("SIGKILL");
                } catch {}
              }, 1000);
            }
          } catch {}
        },
      });

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split("\n");
        for (const l of lines) {
          const trimmed = l.trimEnd();
          if (trimmed.length > 0) {
            output.push(trimmed);
            if (onLog) onLog(trimmed);
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split("\n");
        for (const l of lines) {
          const trimmed = l.trimEnd();
          if (trimmed.length > 0) {
            const lineStr = `[stderr] ${trimmed}`;
            output.push(lineStr);
            if (onLog) onLog(lineStr);
          }
        }
      });

      child.on("close", (code) => {
        activeRunningProcesses.delete(execKey);
        logToDb({
          level: code === 0 ? "INFO" : "ERROR",
          method: "CLI_COMMAND",
          path: `/command/${name}`,
          status: code === 0 ? 200 : 500,
          duration_ms: duration,
          error_message:
            code === 0
              ? `Command [${name}] completed successfully (${duration}ms)`
              : `Command [${name}] exited with code ${code}`,
          metadata_json: JSON.stringify({
            command: name,
            args: argsArray,
            output: output.slice(-200),
          }),
        });

        resolve({
          success: code === 0,
          output,
          durationMs: duration,
          exitCode: code ?? 0,
        });
      });

      child.on("error", (err) => {
        activeRunningProcesses.delete(execKey);
        const duration = Number((performance.now() - start).toFixed(2));
        const errLine = `[error] ${err.message}`;
        output.push(errLine);
        if (onLog) onLog(errLine);
        resolve({
          success: false,
          output,
          durationMs: duration,
          exitCode: 1,
          error: err.message,
        });
      });
    });
  } else if (cmd.handler) {
    const output: string[] = [];
    const customLogger = (...logArgs: any[]) => {
      const line = logArgs
        .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
      output.push(line);
      if (onLog) onLog(line);
    };

    try {
      const publicFilesApi = createPublicFilesApi();
      const res = await cmd.handler({
        args: argsArray,
        log: customLogger,
        db,
        collections: collectionsApi,
        publicFiles: publicFilesApi,
        public: publicFilesApi,
        savePublicFile: publicFilesApi.save,
        savePublicJson: publicFilesApi.saveJson,
        readPublicFile: publicFilesApi.read,
        readPublicJson: publicFilesApi.readJson,
        deletePublicFile: publicFilesApi.delete,
        publicPath: publicFilesApi.path,
        PUBLIC_DIR,
        metadata_json: JSON.stringify({
          command: name,
          args: argsArray,
          output,
        }),
      });

      return {
        success: true,
        output,
        durationMs: duration,
        exitCode: 0,
      };
    } catch (err: any) {
      const duration = Number((performance.now() - start).toFixed(2));
      output.push(`[error] ${err.message}`);
      return {
        success: false,
        output,
        durationMs: duration,
        exitCode: 1,
        error: err.message,
      };
    }
  }

  throw new Error(`Command "${name}" cannot be executed.`);
}

// Getters for inspecting hooks status via API
export function getHooksOverview() {
  const routes: any[] = [];
  for (const route of activeRoutes.values()) {
    routes.push({
      method: route.method,
      path: route.path,
      authLevel: route.authLevel,
      sourceFile: route.sourceFile,
    });
  }

  const crons: any[] = [];
  for (const cronDef of activeCrons.values()) {
    if (!cronDef.last_run_at) {
      const persisted = getCronPersistedState(cronDef.name);
      if (persisted) {
        cronDef.last_run_at = persisted.last_run_at;
        cronDef.last_status = persisted.last_status;
        cronDef.last_duration_ms = persisted.last_duration_ms;
      }
    }
    crons.push({
      name: cronDef.name,
      schedule: cronDef.schedule,
      sourceFile: cronDef.sourceFile,
      active: cronDef.active,
      last_run_at: cronDef.last_run_at,
      last_status: cronDef.last_status,
      last_duration_ms: cronDef.last_duration_ms,
    });
  }

  const commands: any[] = [];
  for (const cmd of activeCommands.values()) {
    commands.push({
      name: cmd.name,
      description: cmd.description,
      usage: cmd.usage,
      sourceFile: cmd.sourceFile,
      type: cmd.type,
      options: cmd.options || [],
    });
  }

  const files = Array.from(fileStatuses.values());
  files.sort((a, b) => a.filename.localeCompare(b.filename));

  return {
    hooksDir: HOOKS_DIR,
    files,
    routes,
    crons,
    commands,
    totalFiles: files.length,
    totalRoutes: routes.length,
    totalCrons: crons.length,
    totalCommands: commands.length,
  };
}
