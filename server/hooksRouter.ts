import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { requireSuperuser } from './auth';
import {
  HOOKS_DIR,
  getHooksOverview,
  loadAllHooks,
  executeHookCron,
  executeHookCommand,
  cancelRunningCommand,
  initHooksDir
} from './hooks';

export const hooksRouter = Router();

// Sanitize and resolve hook path safely to prevent directory traversal
function resolveHookPath(relPath: string): string {
  const cleanPath = relPath.replace(/^[\/\\]+/, '');
  const normalized = path.normalize(cleanPath);
  const fullPath = path.resolve(HOOKS_DIR, normalized);
  if (!fullPath.startsWith(HOOKS_DIR)) {
    throw new Error('Access denied: Invalid hook file path outside _hooks directory');
  }
  return fullPath;
}

function getAllHookFilesRecursively(
  dir: string,
  baseDir = dir,
): { name: string; sizeBytes: number; updatedAt: string }[] {
  let results: { name: string; sizeBytes: number; updatedAt: string }[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.trash' || entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllHookFilesRecursively(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const stats = fs.statSync(fullPath);
      results.push({
        name: relPath,
        sizeBytes: stats.size,
        updatedAt: stats.mtime.toISOString(),
      });
    }
  }
  return results;
}

// 1. Overview of all hooks, registered routes, and crons
hooksRouter.get('/', requireSuperuser, (_req: Request, res: Response) => {
  res.json(getHooksOverview());
});

// Raw file streaming (for images, media, and binary assets)
hooksRouter.get(['/files/raw', /^\/files\/raw\/(.+)$/], (req: Request, res: Response) => {
  try {
    const rawParam = (req.params as any)[0];
    const rawQuery = (req.query.path as string) || (req.query.name as string);
    const filename = rawParam || rawQuery || '';

    if (!filename) {
      return res.status(400).json({ error: 'File path parameter is required' });
    }

    const filePath = resolveHookPath(filename);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).json({ error: `File "${filename}" not found in _hooks` });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. On-demand directory listing in _hooks directory
hooksRouter.get('/tree', requireSuperuser, (req: Request, res: Response) => {
  initHooksDir();
  try {
    const relDir = ((req.query.dir as string) || "").replace(/^[\\\/]+/, "");
    const targetDir = relDir ? resolveHookPath(relDir) : HOOKS_DIR;

    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      return res.json({ items: [], dir: relDir, total: 0 });
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const items: {
      name: string;
      fullPath: string;
      isFolder: boolean;
      sizeBytes?: number;
      updatedAt?: string;
    }[] = [];

    for (const entry of entries) {
      if (
        entry.name === ".git" ||
        entry.name === ".trash" ||
        entry.name === "node_modules"
      )
        continue;
      const fullEntryPath = path.join(targetDir, entry.name);
      const entryRelPath = path
        .relative(HOOKS_DIR, fullEntryPath)
        .replace(/\\/g, "/");

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          fullPath: entryRelPath,
          isFolder: true,
        });
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullEntryPath);
        items.push({
          name: entry.name,
          fullPath: entryRelPath,
          isFolder: false,
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString(),
        });
      }
    }

    items.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ items, dir: relDir, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fast capped search across all hook files
hooksRouter.get('/search', requireSuperuser, (req: Request, res: Response) => {
  initHooksDir();
  try {
    const q = ((req.query.q as string) || "").trim().toLowerCase();
    if (!q) return res.json({ items: [], total: 0 });

    const matches: {
      name: string;
      sizeBytes: number;
      updatedAt: string;
    }[] = [];

    const searchRecursive = (dir: string, baseDir = dir) => {
      if (matches.length >= 100) return;
      if (!fs.existsSync(dir)) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= 100) break;
        if (
          entry.name === ".git" ||
          entry.name === ".trash" ||
          entry.name === "node_modules"
        )
          continue;

        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

        if (entry.name.toLowerCase().includes(q)) {
          const stats = fs.statSync(fullPath);
          matches.push({
            name: relPath,
            sizeBytes: entry.isFile() ? stats.size : 0,
            updatedAt: stats.mtime.toISOString(),
          });
        }

        if (entry.isDirectory()) {
          searchRecursive(fullPath, baseDir);
        }
      }
    };

    searchRecursive(HOOKS_DIR, HOOKS_DIR);
    res.json({ items: matches, total: matches.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List hook files recursively in _hooks directory
hooksRouter.get('/files', requireSuperuser, (req: Request, res: Response) => {
  initHooksDir();
  try {
    const isLazy = req.query.lazy === "true";
    if (isLazy) {
      const entries = fs.readdirSync(HOOKS_DIR, { withFileTypes: true });
      const items = entries.map((entry) => {
        const fullEntryPath = path.join(HOOKS_DIR, entry.name);
        const isDir = entry.isDirectory();
        const stats = isDir ? null : fs.statSync(fullEntryPath);
        return {
          name: entry.name,
          sizeBytes: stats ? stats.size : 0,
          updatedAt: stats ? stats.mtime.toISOString() : new Date().toISOString(),
          isFolder: isDir,
        };
      });
      return res.json({ items, total: items.length, hooksDir: HOOKS_DIR });
    }

    const files = getAllHookFilesRecursively(HOOKS_DIR);
    files.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ items: files, total: files.length, hooksDir: HOOKS_DIR });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Read specific hook file content
hooksRouter.get('/files/file', requireSuperuser, (req: Request, res: Response) => {
  try {
    const rawPath = (req.query.path as string) || (req.query.name as string);
    if (!rawPath) {
      return res.status(400).json({ error: 'File path parameter required' });
    }
    const filePath = resolveHookPath(rawPath);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).json({ error: `Hook file "${rawPath}" not found` });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);

    res.json({
      name: rawPath.replace(/\\/g, '/'),
      content,
      sizeBytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backward-compatible route for /files/<path>
hooksRouter.get(/^\/files\/(.+)$/, requireSuperuser, (req: Request, res: Response) => {
  try {
    const rawName = (req.params as any)[0] || '';
    if (!rawName || rawName === 'file') return;
    const filePath = resolveHookPath(rawName);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).json({ error: `Hook file "${rawName}" not found` });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);

    res.json({
      name: rawName.replace(/\\/g, '/'),
      content,
      sizeBytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create or Update hook file
hooksRouter.post('/files', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { name, content } = req.body;
    if (!name || content === undefined) {
      return res.status(400).json({ error: 'Filename and content are required' });
    }

    let filePath = resolveHookPath(name);
    if (
      !filePath.endsWith('.js') &&
      !filePath.endsWith('.ts') &&
      !filePath.endsWith('.cjs') &&
      !filePath.endsWith('.mjs')
    ) {
      filePath += '.js';
    }

    initHooksDir();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');

    // Reload hooks registry
    await loadAllHooks();

    const cleanName = path.relative(HOOKS_DIR, filePath).replace(/\\/g, '/');
    res.status(201).json({
      name: cleanName,
      saved: true,
      path: filePath,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rename hook file or directory
hooksRouter.post('/files/rename', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'oldName and newName are required' });
    }

    const srcPath = resolveHookPath(oldName);
    const dstPath = resolveHookPath(newName);

    if (!fs.existsSync(srcPath)) {
      return res.status(404).json({ error: `Hook file "${oldName}" not found` });
    }

    if (fs.existsSync(dstPath)) {
      return res.status(409).json({ error: `Target "${newName}" already exists` });
    }

    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.renameSync(srcPath, dstPath);

    // Reload hooks registry
    await loadAllHooks();

    res.json({
      success: true,
      oldName: oldName.replace(/\\/g, '/'),
      newName: newName.replace(/\\/g, '/'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Copy hook file or directory
hooksRouter.post('/files/copy', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { sourceName, targetName } = req.body;
    if (!sourceName || !targetName) {
      return res.status(400).json({ error: 'sourceName and targetName are required' });
    }

    const src = resolveHookPath(sourceName);
    const dst = resolveHookPath(targetName);

    if (!fs.existsSync(src)) {
      return res.status(404).json({ error: `Source "${sourceName}" not found` });
    }

    fs.mkdirSync(path.dirname(dst), { recursive: true });

    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      fs.cpSync(src, dst, { recursive: true });
    } else {
      fs.copyFileSync(src, dst);
    }

    // Reload hooks registry
    await loadAllHooks();

    res.json({
      success: true,
      sourceName: sourceName.replace(/\\/g, '/'),
      targetName: targetName.replace(/\\/g, '/'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create folder in _hooks
hooksRouter.post('/files/folder', requireSuperuser, (req: Request, res: Response) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    const fullPath = resolveHookPath(dirPath);
    fs.mkdirSync(fullPath, { recursive: true });

    res.status(201).json({
      success: true,
      path: dirPath.replace(/\\/g, '/'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete folder in _hooks (moves to .trash)
hooksRouter.delete(['/files/folder', '/files/directory'], requireSuperuser, async (req: Request, res: Response) => {
  try {
    const rawPath = (req.query.path as string) || (req.body && req.body.path) || '';
    if (!rawPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    const dirPath = resolveHookPath(rawPath);

    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: `Folder "${rawPath}" not found` });
    }

    const trashDir = path.resolve(process.cwd(), '.trash');
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }

    const safeClean = rawPath.replace(/[\/\\]/g, '_');
    const trashTarget = path.join(trashDir, `${Date.now()}_hooks_dir_${safeClean}`);
    fs.renameSync(dirPath, trashTarget);

    // Reload hooks registry
    await loadAllHooks();

    res.json({ success: true, message: `Moved folder ${rawPath} to .trash` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload batch of files to _hooks (for clipboard paste or multi-file upload)
hooksRouter.post('/files/upload-batch', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { files, overwrite = true } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Array of files is required' });
    }

    initHooksDir();
    const savedList: string[] = [];

    for (const item of files) {
      if (!item.path || item.content === undefined) continue;
      const filePath = resolveHookPath(item.path);

      if (!overwrite && fs.existsSync(filePath)) {
        continue;
      }

      fs.mkdirSync(path.dirname(filePath), { recursive: true });

      if (item.isBase64) {
        fs.writeFileSync(filePath, Buffer.from(item.content, 'base64'));
      } else {
        fs.writeFileSync(filePath, item.content, 'utf8');
      }

      savedList.push(item.path.replace(/\\/g, '/'));
    }

    // Reload hooks registry
    await loadAllHooks();

    res.status(201).json({
      success: true,
      count: savedList.length,
      saved: savedList,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete hook file (Move to .trash if configured)
hooksRouter.delete('/files/file', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const filename = (req.query.path as string) || (req.query.name as string) || '';
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const filePath = resolveHookPath(filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Hook file "${filename}" not found` });
    }

    // Move to .trash folder
    const trashDir = path.resolve(process.cwd(), '.trash');
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }

    const safeClean = filename.replace(/[\/\\]/g, '_');
    const trashTarget = path.join(trashDir, `${Date.now()}_hooks_${safeClean}`);
    fs.renameSync(filePath, trashTarget);

    // Reload hooks registry
    await loadAllHooks();

    res.json({ success: true, message: `Moved ${filename} to .trash` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

hooksRouter.delete(/^\/files\/(.+)$/, requireSuperuser, async (req: Request, res: Response) => {
  try {
    const filename = (req.params as any)[0] || '';
    if (!filename || filename === 'file' || filename === 'folder' || filename === 'directory') return;

    const filePath = resolveHookPath(filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Hook file "${filename}" not found` });
    }

    // Move to .trash folder
    const trashDir = path.resolve(process.cwd(), '.trash');
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }

    const safeClean = filename.replace(/[\/\\]/g, '_');
    const trashTarget = path.join(trashDir, `${Date.now()}_hooks_${safeClean}`);
    fs.renameSync(filePath, trashTarget);

    // Reload hooks registry
    await loadAllHooks();

    res.json({ success: true, message: `Moved ${filename} to .trash` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Manual trigger reload
hooksRouter.post('/reload', requireSuperuser, async (_req: Request, res: Response) => {
  try {
    await loadAllHooks();
    res.json({ success: true, overview: getHooksOverview() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Manually trigger a registered cron job (Standard JSON response)
hooksRouter.post('/cron/:name/trigger', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const name = decodeURIComponent(rawName);
    const result = await executeHookCron(name);
    res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 7b. Execute a registered cron job with real-time log streaming via Server-Sent Events (SSE)
hooksRouter.post('/cron/stream', requireSuperuser, async (req: Request, res: Response) => {
  const { name, executionId: customExecId } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Cron name is required' });
  }

  const executionId = customExecId || `cron_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('started', { executionId, name });

  req.on('close', () => {
    cancelRunningCommand(executionId, name);
  });

  try {
    const result = await executeHookCron(
      name,
      (logLine) => {
        sendEvent('log', { line: logLine });
      },
      executionId
    );
    sendEvent('done', result);
    res.end();
  } catch (err: any) {
    sendEvent('error', { error: err.message });
    res.end();
  }
});

hooksRouter.post('/cron/:name/stream', requireSuperuser, async (req: Request, res: Response) => {
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = decodeURIComponent(rawName);
  const { executionId: customExecId } = req.body || {};
  const executionId = customExecId || `cron_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('started', { executionId, name });

  req.on('close', () => {
    cancelRunningCommand(executionId, name);
  });

  try {
    const result = await executeHookCron(
      name,
      (logLine) => {
        sendEvent('log', { line: logLine });
      },
      executionId
    );
    sendEvent('done', result);
    res.end();
  } catch (err: any) {
    sendEvent('error', { error: err.message });
    res.end();
  }
});

// 7c. Cancel a running cron job
hooksRouter.post('/cron/cancel', requireSuperuser, (req: Request, res: Response) => {
  const { executionId, name } = req.body || {};
  const cancelled = cancelRunningCommand(executionId, name);
  res.json({ success: true, cancelled });
});

// 8. Execute a registered hook command or CLI script (Standard JSON Response)
hooksRouter.post('/commands/run', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { name, args } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Command name is required' });
    }
    const result = await executeHookCommand(name, args || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message, success: false });
  }
});

hooksRouter.post('/commands/:name/run', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const name = decodeURIComponent(rawName);
    const { args } = req.body || {};
    const result = await executeHookCommand(name, args || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message, success: false });
  }
});

// 9. Execute a hook command with real-time log streaming via Server-Sent Events (SSE)
hooksRouter.post('/commands/stream', requireSuperuser, async (req: Request, res: Response) => {
  const { name, args, executionId: customExecId } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Command name is required' });
  }

  const executionId = customExecId || `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('started', { executionId, name });

  // If client disconnects or aborts the request, automatically kill running child process
  req.on('close', () => {
    cancelRunningCommand(executionId);
  });

  try {
    const result = await executeHookCommand(
      name,
      args || [],
      (logLine) => {
        sendEvent('log', { line: logLine });
      },
      executionId
    );
    sendEvent('done', result);
    res.end();
  } catch (err: any) {
    sendEvent('error', { error: err.message });
    res.end();
  }
});

// 10. Cancel a running hook command (Ctrl+C / SIGINT equivalent)
hooksRouter.post('/commands/cancel', requireSuperuser, (req: Request, res: Response) => {
  const { executionId, name } = req.body || {};
  const cancelled = cancelRunningCommand(executionId, name);
  res.json({ success: true, cancelled });
});

const SYSTEM_INTERNAL_PACKAGES = new Set([
  '@mantine/core',
  '@mantine/hooks',
  '@mantine/modals',
  '@mantine/notifications',
  '@monaco-editor/react',
  '@tabler/icons-react',
  'better-sqlite3',
  'cors',
  'dotenv',
  'express',
  'node-cron',
  'react',
  'react-dom',
  'concurrently',
  'postcss',
  'postcss-preset-mantine',
  'postcss-simple-vars',
  'tsx',
  'typescript',
  'vite'
]);

function isInternalPackage(name: string): boolean {
  if (SYSTEM_INTERNAL_PACKAGES.has(name)) return true;
  if (name.startsWith('@mantine/')) return true;
  if (name.startsWith('@types/')) return true;
  if (name.startsWith('@vitejs/')) return true;
  if (name.startsWith('postcss')) return true;
  if (name === 'react' || name === 'react-dom') return true;
  return false;
}

// 8. List installed custom npm packages (excluding internal frontend/server core packages)
hooksRouter.get('/packages', requireSuperuser, (_req: Request, res: Response) => {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return res.json({ packages: [], devPackages: [] });
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const dependencies = pkg.dependencies || {};
    const devDependencies = pkg.devDependencies || {};
    
    // Filter out internal frontend and server framework packages
    const customList = Object.keys(dependencies)
      .filter((name) => !isInternalPackage(name))
      .map((name) => ({
        name,
        version: dependencies[name],
        isDev: false
      }));

    res.json({
      packages: customList,
      devPackages: Object.keys(devDependencies).filter((name) => !isInternalPackage(name))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Install npm package
hooksRouter.post('/packages/install', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Package name is required' });
    }
    const sanitizedName = name.trim();
    if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[a-zA-Z0-9^~._-]+)?$/.test(sanitizedName)) {
      return res.status(400).json({ error: 'Invalid npm package name format' });
    }

    console.log(`[Hooks:NPM] Installing package: ${sanitizedName}...`);
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync(`npm install ${sanitizedName} --save`, { cwd: process.cwd() });
    
    // Clear hook module cache & reload hooks
    await loadAllHooks();

    res.json({
      success: true,
      message: `Package ${sanitizedName} installed successfully`,
      output: stdout || stderr
    });
  } catch (err: any) {
    console.error(`[Hooks:NPM] Install failed:`, err);
    res.status(500).json({ error: err.message || 'Failed to install npm package' });
  }
});

// 10. Uninstall npm package
hooksRouter.post('/packages/uninstall', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Package name is required' });
    }
    const sanitizedName = name.trim();
    if (isInternalPackage(sanitizedName)) {
      return res.status(400).json({ error: `Cannot uninstall core system package '${sanitizedName}'.` });
    }

    console.log(`[Hooks:NPM] Uninstalling package: ${sanitizedName}...`);
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync(`npm uninstall ${sanitizedName}`, { cwd: process.cwd() });
    await loadAllHooks();

    res.json({
      success: true,
      message: `Package ${sanitizedName} uninstalled successfully`,
      output: stdout || stderr
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to uninstall npm package' });
  }
});
