import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "dist");

async function build() {
  console.log("Building AlsaBase JavaScript/TypeScript SDK...");

  // Import esbuild from vite or direct module resolution
  let esbuild;
  try {
    esbuild = await import("esbuild");
  } catch {
    try {
      esbuild = await import("vite/node_modules/esbuild/lib/main.js");
    } catch {
      // Fallback
      const { createRequire } = await import("node:module");
      const require = createRequire(import.meta.url);
      esbuild = require("esbuild");
    }
  }

  // 1. Build ESM Bundle
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    outfile: path.resolve(distDir, "index.js"),
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "neutral",
    external: ["socket.io-client"],
    sourcemap: false,
  });

  // 2. Build CommonJS Bundle
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    outfile: path.resolve(distDir, "index.cjs"),
    bundle: true,
    format: "cjs",
    target: "es2022",
    platform: "neutral",
    external: ["socket.io-client"],
    sourcemap: false,
  });

  console.log("AlsaBase SDK build completed successfully!");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
