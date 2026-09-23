import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    {
      name: "alsabase-static-and-admin-router",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || "/";

          // If the request is for API routes, let proxy handle it
          if (url.startsWith("/api")) {
            return next();
          }

          // If the request is for the Admin Dashboard UI
          // Handle /_ redirect to /_/
          if (url === "/_") {
            res.writeHead(302, { Location: "/_/" });
            return res.end();
          }

          // If internal Vite assets, /_/ routes, or favicon, let Vite handle them
          if (
            url.startsWith("/_/") ||
            url.startsWith("/@") ||
            url.startsWith("/src") ||
            url.startsWith("/node_modules") ||
            url.startsWith("/@fs") ||
            url === "/favicon.svg" ||
            url === "/favicon.ico"
          ) {
            return next();
          }

          // Otherwise, serve static files from the ./_public directory at root /
          const publicDir = path.resolve(process.cwd(), "_public");
          let cleanPath = url.split("?")[0];
          const queryStr = url.includes("?") ? url.substring(url.indexOf("?")) : "";

          // Normalize optional /public/, /_public/, or /_/public/ prefixes
          if (cleanPath.startsWith("/_/public/")) {
            cleanPath = cleanPath.replace(/^\/_\/public/, "") || "/";
          } else if (cleanPath.startsWith("/public/")) {
            cleanPath = cleanPath.replace(/^\/public/, "") || "/";
          } else if (cleanPath.startsWith("/_public/")) {
            cleanPath = cleanPath.replace(/^\/_public/, "") || "/";
          }

          const relativePath =
            cleanPath === "/" || cleanPath === "" ? "/index.html" : cleanPath;
          const targetPath = path.join(publicDir, relativePath);

          const mimeTypes: Record<string, string> = {
            ".html": "text/html; charset=utf-8",
            ".htm": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".mjs": "text/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".avif": "image/avif",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".txt": "text/plain; charset=utf-8",
            ".woff": "font/woff",
            ".woff2": "font/woff2",
            ".ttf": "font/ttf",
            ".mp3": "audio/mpeg",
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".wasm": "application/wasm",
          };

          if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) {
              const nestedIndex = path.join(targetPath, "index.html");
              if (fs.existsSync(nestedIndex)) {
                if (!cleanPath.endsWith("/")) {
                  res.writeHead(301, { Location: cleanPath + "/" + queryStr });
                  return res.end();
                }
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.setHeader("Access-Control-Allow-Origin", "*");
                return fs.createReadStream(nestedIndex).pipe(res);
              }
            } else if (stat.isFile()) {
              const ext = path.extname(targetPath).toLowerCase();
              res.setHeader(
                "Content-Type",
                mimeTypes[ext] || "application/octet-stream"
              );
              res.setHeader("Access-Control-Allow-Origin", "*");
              return fs.createReadStream(targetPath).pipe(res);
            }
          }

          // SPA fallback for public static site: if route doesn't have an extension, serve closest parent index.html or root index.html
          const hasExtension = path.extname(cleanPath) !== "";
          if (!hasExtension) {
            let currentDir = targetPath;
            if (!fs.existsSync(currentDir) || !fs.statSync(currentDir).isDirectory()) {
              currentDir = path.dirname(targetPath);
            }
            while (currentDir.startsWith(publicDir)) {
              const candidate = path.join(currentDir, "index.html");
              if (fs.existsSync(candidate)) {
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.setHeader("Access-Control-Allow-Origin", "*");
                return fs.createReadStream(candidate).pipe(res);
              }
              if (currentDir === publicDir) break;
              currentDir = path.dirname(currentDir);
            }

            const rootIndex = path.join(publicDir, "index.html");
            if (fs.existsSync(rootIndex)) {
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.setHeader("Access-Control-Allow-Origin", "*");
              return fs.createReadStream(rootIndex).pipe(res);
            }
          } else {
            // Missing asset file with an extension: return a clean 404 rather than falling through to Vite router
            res.writeHead(404, {
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            });
            return res.end(
              JSON.stringify({
                error: `File "${cleanPath.replace(/^\//, "")}" not found in _public`,
                status: 404,
              })
            );
          }

          next();
        });
      },
    },
  ],
  base: "/_/",
  server: {
    port: 5173,
    host: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      overlay: true,
    },
    proxy: {
      "/api": {
        target: "http://localhost:8090",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});



