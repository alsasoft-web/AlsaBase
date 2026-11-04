/**
 * Hardware ID (HWID) / Device ID Generation Utility for AlsaBase.
 *
 * Provides deterministic, persistent, and tamper-resistant device identification
 * across Node.js, Electron, Browser, Tauri, and hybrid JavaScript runtimes.
 */

declare const process: any;
declare const require: any;

import type { HwidOptions } from "../types";

export type { HwidOptions };

// In-memory cache for fast repeated lookups
const memoryCache = new Map<string, string>();

/**
 * UTF-8 byte encoding helper
 */
function utf8Encode(str: string): string {
  try {
    return unescape(encodeURIComponent(str));
  } catch {
    return str;
  }
}

/**
 * High-performance, zero-dependency pure TypeScript SHA-256 implementation.
 * Runs identically in Node.js, Browsers, WebWorkers, React Native, and Deno/Bun.
 */
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  let result = "";
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let i = 0; i < ascii.length; i++) {
    const code = ascii.charCodeAt(i);
    words[i >> 2] |= (code & 0xff) << ((3 - (i % 4)) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << ((3 - ((asciiBitLength >> 3) % 4)) * 8);
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  const w: number[] = new Array(64);
  for (let j = 0; j < words.length; j += 16) {
    const [a0, b0, c0, d0, e0, f0, g0, h0] = hash;
    let [a, b, c, d, e, f, g, h] = [a0, b0, c0, d0, e0, f0, g0, h0];

    for (let i = 0; i < 64; i++) {
      if (i < 16) {
        w[i] = words[j + i] | 0;
      } else {
        const gamma0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const gamma1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + gamma0 + w[i - 7] + gamma1) | 0;
      }

      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }

  return result;
}

/**
 * Safely resolves Node.js built-in modules in Node/Electron environments
 * without causing bundling failures in browser packagers.
 */
function getNodeModule<T = any>(name: string): T | null {
  try {
    if (typeof process !== "undefined" && process.versions?.node) {
      // Dynamic lookup avoids bundler static resolution
      const req =
        typeof (globalThis as any).require === "function"
          ? (globalThis as any).require
          : typeof require === "function"
          ? require
          : null;
      if (req) {
        return req(name);
      }
    }
  } catch {
    // Ignore environments where require is not available
  }
  return null;
}

/**
 * Collects hardware identification components in Node.js / Electron environments.
 */
function getNodeHardwareSeed(): string {
  const parts: string[] = [];

  const cp = getNodeModule<any>("child_process");
  const fs = getNodeModule<any>("fs");
  const os = getNodeModule<any>("os");

  const platform = process.platform;

  // 1. Windows: Query Registry for permanent MachineGuid
  if (platform === "win32") {
    let guidFound = false;
    if (cp?.execSync) {
      try {
        const regPath = process.env.SystemRoot
          ? `${process.env.SystemRoot}\\System32\\reg.exe`
          : "reg.exe";
        const out = cp.execSync(
          `"${regPath}" query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid`,
          { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 2000 }
        );
        const match = out.match(/REG_SZ\s+([a-fA-F0-9-]+)/i);
        if (match?.[1]) {
          parts.push(`win-machineguid:${match[1].trim()}`);
          guidFound = true;
        }
      } catch {
        // Fallback to powershell or wmic if reg query fails
      }

      if (!guidFound) {
        try {
          const psPath = process.env.SystemRoot
            ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
            : "powershell.exe";
          const out = cp.execSync(
            `"${psPath}" -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"`,
            { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 2500 }
          );
          const trimmed = out.trim();
          if (trimmed && trimmed.length >= 8) {
            parts.push(`win-uuid:${trimmed}`);
          }
        } catch {}
      }
    }
  }

  // 2. Linux: Read systemd machine-id or dbus machine-id
  if (platform === "linux" && fs) {
    try {
      if (fs.existsSync("/etc/machine-id")) {
        const id = fs.readFileSync("/etc/machine-id", "utf8").trim();
        if (id) parts.push(`linux-machineid:${id}`);
      } else if (fs.existsSync("/var/lib/dbus/machine-id")) {
        const id = fs.readFileSync("/var/lib/dbus/machine-id", "utf8").trim();
        if (id) parts.push(`linux-dbusid:${id}`);
      }
    } catch {}
  }

  // 3. macOS (Darwin): Query IOPlatformExpertDevice IOPlatformUUID
  if (platform === "darwin" && cp?.execSync) {
    try {
      const out = cp.execSync("ioreg -rd1 -c IOPlatformExpertDevice", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
        timeout: 2000,
      });
      const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/i);
      if (match?.[1]) {
        parts.push(`mac-uuid:${match[1].trim()}`);
      }
    } catch {
      try {
        const out = cp.execSync("sysctl -n kern.uuid", {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
          timeout: 2000,
        });
        const trimmed = out.trim();
        if (trimmed) parts.push(`mac-kernuuid:${trimmed}`);
      } catch {}
    }
  }

  // 4. Network Interfaces (MAC addresses)
  if (os?.networkInterfaces) {
    try {
      const nics = (os.networkInterfaces() || {}) as Record<string, any[]>;
      const macs: string[] = [];
      for (const [_, addrs] of Object.entries(nics)) {
        if (addrs) {
          for (const addr of addrs) {
            if (!addr.internal && addr.mac && addr.mac !== "00:00:00:00:00:00") {
              macs.push(addr.mac.toLowerCase());
            }
          }
        }
      }
      const uniqueMacs = Array.from(new Set(macs)).sort();
      if (uniqueMacs.length > 0) {
        parts.push(`macs:${uniqueMacs.join(",")}`);
      }
    } catch {}
  }

  // 5. Hardware Specifications & Platform Metadata
  if (os) {
    try {
      parts.push(`os-platform:${os.platform()}`);
      parts.push(`os-arch:${os.arch()}`);
      const cpu = os.cpus()?.[0]?.model;
      if (cpu) parts.push(`cpu-model:${cpu.trim()}`);
      parts.push(`hostname:${os.hostname()}`);
    } catch {}
  }

  return parts.length > 0 ? parts.join("|") : "fallback-node-machine-seed";
}

/**
 * Collects hardware identification components in Browser / Web environments.
 */
function getBrowserHardwareSeed(): string {
  // Check for persistent localStorage identifier first
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem("alsabase_hwid");
      if (stored) {
        return `stored-device-seed:${stored}`;
      }
    } catch {}
  }

  const parts: string[] = [];

  if (typeof navigator !== "undefined") {
    parts.push(`ua:${navigator.userAgent}`);
    parts.push(`lang:${navigator.language || (navigator as any).userLanguage || ""}`);
    parts.push(`platform:${navigator.platform || ""}`);
    parts.push(`cores:${navigator.hardwareConcurrency || 4}`);
  }

  if (typeof screen !== "undefined") {
    parts.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`);
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) parts.push(`tz:${tz}`);
  } catch {}

  // Canvas fingerprinting (deterministic 2D render signature)
  if (typeof document !== "undefined") {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 40;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial', 'sans-serif'";
        ctx.fillStyle = "#10e57a";
        ctx.fillRect(0, 0, 160, 40);
        ctx.fillStyle = "#18191c";
        ctx.fillText("AlsaBase HWID Fingerprint", 10, 10);
        parts.push(`canvas:${canvas.toDataURL()}`);
      }
    } catch {}
  }

  const seed = parts.join("|");

  // Save generated browser seed to localStorage for permanent consistency
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem("alsabase_hwid", seed);
    } catch {}
  }

  return seed || "fallback-browser-device-seed";
}

/**
 * Formats a 64-char hexadecimal hash according to requested HwidOptions.
 */
function formatHwid(hash: string, options?: HwidOptions): string {
  const format = options?.format || "hex";
  const prefix = options?.prefix || "";

  let formatted = hash;
  if (format === "uuid") {
    // 8-4-4-4-12 UUID format
    formatted = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  } else if (format === "short") {
    // 19-char uppercase format: XXXX-XXXX-XXXX-XXXX
    formatted = `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`.toUpperCase();
  }

  return prefix ? `${prefix}${formatted}` : formatted;
}

/**
 * Normalizes input arguments (accepts either appSlug string or HwidOptions).
 */
function normalizeOptions(optionsOrSlug?: string | HwidOptions): HwidOptions {
  if (typeof optionsOrSlug === "string") {
    return { appSlug: optionsOrSlug };
  }
  return optionsOrSlug || {};
}

/**
 * Synchronous internal generator.
 */
function generateHwidSync(opts: HwidOptions): string {
  const cacheKey = `${opts.appSlug || ""}:${opts.format || "hex"}:${opts.prefix || ""}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  const isNode = typeof process !== "undefined" && process.versions?.node;
  const rawSeed = isNode ? getNodeHardwareSeed() : getBrowserHardwareSeed();

  const finalSeed = opts.appSlug ? `${rawSeed}|app:${opts.appSlug}` : rawSeed;
  const rawHash = sha256(utf8Encode(finalSeed));
  const result = formatHwid(rawHash, opts);

  memoryCache.set(cacheKey, result);
  return result;
}

/**
 * Generates an always-consistent, persistent Hardware ID (HWID) / Device ID
 * for the current machine or client environment.
 *
 * Supported environments:
 * - Node.js / Electron (Windows MachineGuid, Linux machine-id, macOS IOPlatformUUID, MAC addresses, CPU/Hardware specs)
 * - Browser / PWA (localStorage persistent identifier, device & canvas fingerprinting)
 * - Tauri / Hybrid / Serverless
 *
 * @param optionsOrSlug Optional application slug (string) or HwidOptions configuration object
 *
 * @example
 * ```ts
 * import { getHwid } from "alsabase";
 *
 * // Standard 64-character persistent HWID
 * const hwid = await getHwid();
 *
 * // App-specific HWID with custom prefix
 * const appHwid = await getHwid({ appSlug: "pos-client", prefix: "HWID-", format: "short" });
 * // => "HWID-D3DC-4313-B282-B739"
 * ```
 */
export async function getHwid(optionsOrSlug?: string | HwidOptions): Promise<string> {
  const opts = normalizeOptions(optionsOrSlug);
  return generateHwidSync(opts);
}

/**
 * Synchronous version of getHwid().
 * Generates an always-consistent Hardware ID (HWID) immediately without awaiting promises.
 *
 * @param optionsOrSlug Optional application slug (string) or HwidOptions configuration object
 *
 * @example
 * ```ts
 * import { getHwidSync } from "alsabase";
 *
 * const hwid = getHwidSync();
 * ```
 */
export function getHwidSync(optionsOrSlug?: string | HwidOptions): string {
  const opts = normalizeOptions(optionsOrSlug);
  return generateHwidSync(opts);
}
