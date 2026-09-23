import express, { Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR =
  process.env.PUBLIC_DIR || path.resolve(process.cwd(), "_public");

export function initPublicDir() {
  const isFirstRun = !fs.existsSync(PUBLIC_DIR);
  if (isFirstRun) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });

    const defaultIndexPath = path.join(PUBLIC_DIR, "index.html");
    const defaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AlsaBase Public Hosting</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 32px;
      max-width: 540px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    }
    h1 { color: #38bdf8; margin-top: 0; }
    p { color: #94a3b8; line-height: 1.6; }
    code { background: #0f172a; padding: 3px 8px; border-radius: 4px; color: #a5f3fc; font-family: monospace; }
    .badge {
      display: inline-block;
      background: #0369a1;
      color: #fff;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    a.button {
      display: inline-block;
      margin-top: 20px;
      background: #2563eb;
      color: white;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 500;
    }
    a.button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Static Hosting Active</div>
    <h1>AlsaBase Static Server</h1>
    <p>This page is served from your <code>./_public</code> directory.</p>
    <p>Place your HTML, CSS, JavaScript, or single page application files into <code>./_public</code> and they will be served directly at the root URL.</p>
    <a href="/_/" class="button">Open Admin Dashboard</a>
  </div>
</body>
</html>
`;
    fs.writeFileSync(defaultIndexPath, defaultHtml, "utf8");
  }
}

export function staticHostingMiddleware() {
  initPublicDir();
  const staticHandler = express.static(PUBLIC_DIR, {
    dotfiles: "allow",
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
    },
  });

  return (req: Request, res: Response, next: NextFunction) => {
    // Exclude internal API routes and Admin routes from static fallback
    if (
      (req.path.startsWith("/api") && !req.path.startsWith("/api/public")) ||
      req.path.startsWith("/_")
    ) {
      return next();
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

    // Clean relative path inside public dir
    const cleanRel = req.path
      .replace(/^\/api\/public/, "")
      .replace(/^\/public/, "");
    const filePath = path.join(PUBLIC_DIR, cleanRel || "/");

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        return res.sendFile(filePath);
      }
      if (stat.isDirectory()) {
        const nestedIndex = path.join(filePath, "index.html");
        if (fs.existsSync(nestedIndex)) {
          // If accessing directory without trailing slash, redirect to add trailing slash
          // so relative links, images, scripts, and CSS inside index.html resolve correctly
          if (!req.path.endsWith("/") && !req.path.endsWith("\\")) {
            const queryStr = req.url.includes("?")
              ? req.url.substring(req.url.indexOf("?"))
              : "";
            return res.redirect(301, req.path + "/" + queryStr);
          }
          return res.sendFile(nestedIndex);
        }
      }
    }

    // SPA fallback: If requesting a route without file extension, check closest parent index.html or root index.html
    const hasExtension = path.extname(cleanRel) !== "";
    if (!hasExtension) {
      let currentDir = path.dirname(filePath);
      while (currentDir.startsWith(PUBLIC_DIR)) {
        const candidate = path.join(currentDir, "index.html");
        if (fs.existsSync(candidate)) {
          return res.sendFile(candidate);
        }
        if (currentDir === PUBLIC_DIR) break;
        currentDir = path.dirname(currentDir);
      }

      if (fs.existsSync(path.join(PUBLIC_DIR, "index.html"))) {
        return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
      }
    }

    return staticHandler(req, res, next);
  };
}

export const staticRouter = express.Router();

function resolvePublicPath(relPath: string): string {
  const cleanPath = relPath.replace(/^[\/\\]+/, "");
  const normalized = path.normalize(cleanPath);
  const fullPath = path.resolve(PUBLIC_DIR, normalized);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    throw new Error("Access denied: Invalid file path outside _public directory");
  }
  return fullPath;
}

// Serve raw file stream with proper MIME headers & CORS
staticRouter.get(["/raw", /^\/raw\/(.+)$/], (req: Request, res: Response) => {
  try {
    const rawParam = (req.params as any)[0];
    const rawQuery = (req.query.path as string) || (req.query.name as string);
    const filename = rawParam || rawQuery || "";

    if (!filename) {
      return res.status(400).json({ error: "File path parameter is required" });
    }

    const filePath = resolvePublicPath(filename);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res
        .status(404)
        .json({ error: `File "${filename}" not found in _public` });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function getAllFilesRecursively(
  dir: string,
  baseDir = dir,
): { name: string; sizeBytes: number; updatedAt: string }[] {
  let results: { name: string; sizeBytes: number; updatedAt: string }[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllFilesRecursively(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
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

// On-demand single directory listing (instant <1ms even with 100k files)
staticRouter.get("/tree", (req: Request, res: Response) => {
  initPublicDir();
  try {
    const relDir = ((req.query.dir as string) || "").replace(/^[\\\/]+/, "");
    const targetDir = relDir ? resolvePublicPath(relDir) : PUBLIC_DIR;

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
        .relative(PUBLIC_DIR, fullEntryPath)
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

    // Folders first, then index.html, then alphabetical
    items.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      if (a.name === "index.html") return -1;
      if (b.name === "index.html") return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ items, dir: relDir, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fast capped search across all public files (limits to 100 results)
staticRouter.get("/search", (req: Request, res: Response) => {
  initPublicDir();
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

    searchRecursive(PUBLIC_DIR, PUBLIC_DIR);
    res.json({ items: matches, total: matches.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List files in _public (with optional limit/depth)
staticRouter.get("/", (req: Request, res: Response) => {
  initPublicDir();
  try {
    const isLazy = req.query.lazy === "true";
    if (isLazy) {
      const entries = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });
      const items = entries
        .filter(
          (entry) =>
            entry.name !== ".git" &&
            entry.name !== ".trash" &&
            entry.name !== "node_modules",
        )
        .map((entry) => {
          const fullEntryPath = path.join(PUBLIC_DIR, entry.name);
          const isDir = entry.isDirectory();
          const stats = isDir ? null : fs.statSync(fullEntryPath);
          return {
            name: entry.name,
            sizeBytes: stats ? stats.size : 0,
            updatedAt: stats ? stats.mtime.toISOString() : new Date().toISOString(),
            isFolder: isDir,
          };
        });

      items.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        if (a.name === "index.html") return -1;
        if (b.name === "index.html") return 1;
        return a.name.localeCompare(b.name);
      });

      return res.json({ items, total: items.length, publicDir: PUBLIC_DIR });
    }

    const files = getAllFilesRecursively(PUBLIC_DIR);
    // Sort files alphabetically with index.html at top
    files.sort((a, b) => {
      if (a.name === "index.html") return -1;
      if (b.name === "index.html") return 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ items: files, total: files.length, publicDir: PUBLIC_DIR });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Read file content
staticRouter.get("/file", (req: Request, res: Response) => {
  try {
    const rawPath = (req.query.path as string) || (req.query.name as string);
    if (!rawPath) {
      return res.status(400).json({ error: "File path parameter required" });
    }
    const filePath = resolvePublicPath(rawPath);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res
        .status(404)
        .json({ error: `File "${rawPath}" not found in _public` });
    }

    const content = fs.readFileSync(filePath, "utf8");
    const stats = fs.statSync(filePath);

    res.json({
      name: rawPath.replace(/\\/g, "/"),
      content,
      sizeBytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backward-compatible route for /file/*
staticRouter.get(/^\/file\/(.+)$/, (req: Request, res: Response) => {
  try {
    const filename = (req.params as any)[0] || "";
    const filePath = resolvePublicPath(filename);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res
        .status(404)
        .json({ error: `File "${filename}" not found in _public` });
    }

    const content = fs.readFileSync(filePath, "utf8");
    const stats = fs.statSync(filePath);

    res.json({
      name: filename.replace(/\\/g, "/"),
      content,
      sizeBytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save single file
staticRouter.post("/file", (req: Request, res: Response) => {
  try {
    const { name, content, isBase64 } = req.body;
    if (!name || content === undefined) {
      return res
        .status(400)
        .json({ error: "Filename and content are required" });
    }

    initPublicDir();
    const filePath = resolvePublicPath(name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    if (isBase64) {
      fs.writeFileSync(filePath, Buffer.from(content, "base64"));
    } else {
      fs.writeFileSync(filePath, content, "utf8");
    }

    res.status(201).json({
      name: name.replace(/\\/g, "/"),
      saved: true,
      path: filePath,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload batch of files (for whole folder upload or multi-file upload)
staticRouter.post("/upload-batch", (req: Request, res: Response) => {
  try {
    const { files, overwrite = true } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res
        .status(400)
        .json({ error: "Array of files is required for batch upload" });
    }

    initPublicDir();
    const savedList: string[] = [];

    for (const item of files) {
      if (!item.path || item.content === undefined) continue;
      const filePath = resolvePublicPath(item.path);

      if (!overwrite && fs.existsSync(filePath)) {
        continue;
      }

      fs.mkdirSync(path.dirname(filePath), { recursive: true });

      if (item.isBase64) {
        fs.writeFileSync(filePath, Buffer.from(item.content, "base64"));
      } else {
        fs.writeFileSync(filePath, item.content, "utf8");
      }

      savedList.push(item.path.replace(/\\/g, "/"));
    }

    res.status(201).json({
      success: true,
      count: savedList.length,
      saved: savedList,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rename file or directory
staticRouter.post("/rename", (req: Request, res: Response) => {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      return res.status(400).json({ error: "oldPath and newPath are required" });
    }

    const srcPath = resolvePublicPath(oldPath);
    const dstPath = resolvePublicPath(newPath);

    if (!fs.existsSync(srcPath)) {
      return res.status(404).json({ error: `Path "${oldPath}" not found` });
    }

    if (fs.existsSync(dstPath)) {
      return res.status(409).json({ error: `Target "${newPath}" already exists` });
    }

    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.renameSync(srcPath, dstPath);

    res.json({
      success: true,
      oldPath: oldPath.replace(/\\/g, "/"),
      newPath: newPath.replace(/\\/g, "/"),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Copy / Duplicate file or directory
staticRouter.post("/copy", (req: Request, res: Response) => {
  try {
    const { sourcePath, targetPath } = req.body;
    if (!sourcePath || !targetPath) {
      return res.status(400).json({ error: "sourcePath and targetPath are required" });
    }

    const src = resolvePublicPath(sourcePath);
    const dst = resolvePublicPath(targetPath);

    if (!fs.existsSync(src)) {
      return res.status(404).json({ error: `Source "${sourcePath}" not found` });
    }

    fs.mkdirSync(path.dirname(dst), { recursive: true });

    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      fs.cpSync(src, dst, { recursive: true });
    } else {
      fs.copyFileSync(src, dst);
    }

    res.json({
      success: true,
      sourcePath: sourcePath.replace(/\\/g, "/"),
      targetPath: targetPath.replace(/\\/g, "/"),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create folder
staticRouter.post("/folder", (req: Request, res: Response) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) {
      return res.status(400).json({ error: "Path parameter is required" });
    }

    const fullPath = resolvePublicPath(dirPath);
    fs.mkdirSync(fullPath, { recursive: true });

    res.status(201).json({
      success: true,
      path: dirPath.replace(/\\/g, "/"),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete folder (moves directory to .trash)
staticRouter.delete(["/folder", "/directory"], (req: Request, res: Response) => {
  try {
    const rawPath = (req.query.path as string) || (req.body && req.body.path) || "";
    if (!rawPath) {
      return res.status(400).json({ error: "Folder path is required" });
    }

    const dirPath = resolvePublicPath(rawPath);

    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: `Folder "${rawPath}" not found` });
    }

    const trashDir = path.resolve(process.cwd(), ".trash");
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }

    const safeClean = rawPath.replace(/[\/\\]/g, "_");
    const trashTarget = path.join(trashDir, `${Date.now()}_public_dir_${safeClean}`);
    fs.renameSync(dirPath, trashTarget);

    res.json({ success: true, message: `Moved folder ${rawPath} to .trash` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file (supports both query /file?path=... and path /file/...)
staticRouter.delete(["/file", /^\/file\/(.+)$/], (req: Request, res: Response) => {
  try {
    const rawParam = (req.params as any)[0];
    const rawQuery = (req.query.path as string) || (req.query.name as string);
    const filename = rawParam || rawQuery || "";

    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    const filePath = resolvePublicPath(filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File "${filename}" not found` });
    }

    const trashDir = path.resolve(process.cwd(), ".trash");
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }

    const safeClean = filename.replace(/[\/\\]/g, "_");
    const trashTarget = path.join(trashDir, `${Date.now()}_public_${safeClean}`);
    fs.renameSync(filePath, trashTarget);

    res.json({ success: true, message: `Moved ${filename} to .trash` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

