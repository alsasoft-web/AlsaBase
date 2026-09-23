import { Request, Response, NextFunction } from "express";
import nodemailer from "nodemailer";
import { db } from "./db";

export interface BatchSettings {
  enabled: boolean;
  maxRequests: number;
  timeout: number;
  maxBodySize: number;
}

export interface IpProxySettings {
  enabled: boolean;
  headers: string[];
  priority: "rightmost" | "leftmost";
}

export interface SuperuserIpsSettings {
  enabled: boolean;
  allowedIps: string[];
}

export interface RateLimitRule {
  id: string;
  label: string;
  maxRequests: number;
  interval: number;
  target: "all" | "guests" | "auth";
}

export interface RateLimitSettings {
  enabled: boolean;
  rules: RateLimitRule[];
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailSettings {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    username: string;
    password: string;
    tls: boolean;
    fromName: string;
    fromAddress: string;
  };
  templates: {
    passwordReset: EmailTemplate;
    verification: EmailTemplate;
    confirmEmailChange: EmailTemplate;
    otp: EmailTemplate;
  };
}

export interface BackupsSettings {
  autoBackupEnabled: boolean;
  cronSchedule: string;
  maxRetention: number;
  includePublic: boolean;
  includeHooks: boolean;
}

export interface AppSettings {
  batch: BatchSettings;
  ipProxy: IpProxySettings;
  superuserIps: SuperuserIpsSettings;
  rateLimit: RateLimitSettings;
  email: EmailSettings;
  backups: BackupsSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
  batch: {
    enabled: false,
    maxRequests: 50,
    timeout: 30,
    maxBodySize: 15,
  },
  ipProxy: {
    enabled: false,
    headers: ["X-Forwarded-For", "Fly-Client-IP", "CF-Connecting-IP"],
    priority: "rightmost",
  },
  superuserIps: {
    enabled: false,
    allowedIps: [],
  },
  rateLimit: {
    enabled: false,
    rules: [
      { id: "1", label: "*:auth", maxRequests: 2, interval: 3, target: "all" },
      { id: "2", label: "*:create", maxRequests: 20, interval: 5, target: "all" },
      { id: "3", label: "/api/batch", maxRequests: 3, interval: 1, target: "all" },
      { id: "4", label: "/api/", maxRequests: 300, interval: 10, target: "all" },
    ],
  },
  email: {
    enabled: false,
    smtp: {
      host: "",
      port: 587,
      username: "",
      password: "",
      tls: true,
      fromName: "AlsaBase",
      fromAddress: "noreply@example.com",
    },
    templates: {
      passwordReset: {
        subject: "Reset your AlsaBase password",
        body: `<p>Hello,</p><p>We received a request to reset your password. Click the link below to set a new password:</p><p><a href="{ACTION_URL}">Reset Password</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
      },
      verification: {
        subject: "Verify your email address",
        body: `<p>Hello,</p><p>Please verify your email address by clicking the link below:</p><p><a href="{ACTION_URL}">Verify Email</a></p>`,
      },
      confirmEmailChange: {
        subject: "Confirm your new email address",
        body: `<p>Hello,</p><p>Click the link below to confirm your new email address:</p><p><a href="{ACTION_URL}">Confirm Email Change</a></p>`,
      },
      otp: {
        subject: "Your login verification code",
        body: `<p>Hello,</p><p>Your one-time verification code is: <strong>{OTP}</strong></p><p>This code expires in 10 minutes.</p>`,
      },
    },
  },
  backups: {
    autoBackupEnabled: false,
    cronSchedule: "0 0 * * *",
    maxRetention: 5,
    includePublic: true,
    includeHooks: true,
  },
};

// Initialize SQLite _settings table
export function initSettingsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

initSettingsTable();

export function getAllSettings(): AppSettings {
  try {
    const rows = db.prepare("SELECT key, value_json FROM _settings").all() as {
      key: string;
      value_json: string;
    }[];

    const result: any = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      if (row.key in DEFAULT_SETTINGS) {
        try {
          const parsed = JSON.parse(row.value_json);
          result[row.key] = {
            ...(DEFAULT_SETTINGS as any)[row.key],
            ...parsed,
          };
        } catch {
          // ignore corrupted row
        }
      }
    }

    return result as AppSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateSettingsSection<K extends keyof AppSettings>(
  section: K,
  data: Partial<AppSettings[K]>,
): AppSettings[K] {
  const current = getAllSettings();
  const merged = { ...current[section], ...data };

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO _settings (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `).run(section, JSON.stringify(merged), now);

  return getAllSettings()[section];
}

export function updateAllSettings(partialSettings: Partial<AppSettings>): AppSettings {
  for (const [key, val] of Object.entries(partialSettings)) {
    if (key in DEFAULT_SETTINGS && val) {
      updateSettingsSection(key as keyof AppSettings, val as any);
    }
  }
  return getAllSettings();
}

// Extract real client IP based on configured IP proxy headers
export function getClientIp(req: Request): string {
  const settings = getAllSettings();
  const proxy = settings.ipProxy;

  if (proxy.enabled && Array.isArray(proxy.headers) && proxy.headers.length > 0) {
    for (const headerName of proxy.headers) {
      const headerVal = req.headers[headerName.toLowerCase()];
      if (headerVal && typeof headerVal === "string") {
        const ips = headerVal
          .split(",")
          .map((ip) => ip.trim())
          .filter(Boolean);

        if (ips.length > 0) {
          if (proxy.priority === "leftmost") {
            return ips[0];
          } else {
            return ips[ips.length - 1];
          }
        }
      }
    }
  }

  const rawIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
  return rawIp.replace(/^::ffff:/, "");
}

// IP Matcher for whitelisting (exact IP or subnet / wildcard)
export function isIpInAllowedList(clientIp: string, allowedList: string[]): boolean {
  if (!allowedList || allowedList.length === 0) return true;
  const cleanClient = clientIp.trim();

  for (const allowed of allowedList) {
    const cleanAllowed = allowed.trim();
    if (!cleanAllowed) continue;

    if (cleanAllowed === "*" || cleanAllowed === cleanClient) {
      return true;
    }

    // Subnet prefix check (e.g. 10.0.3. or 192.168.1.)
    if (cleanAllowed.endsWith(".*") || cleanAllowed.endsWith(".")) {
      const prefix = cleanAllowed.replace(/\*$/, "");
      if (cleanClient.startsWith(prefix)) return true;
    }

    // Standard CIDR /24 check
    if (cleanAllowed.includes("/24")) {
      const base = cleanAllowed.split("/")[0].split(".").slice(0, 3).join(".");
      if (cleanClient.startsWith(base + ".")) return true;
    }
    // Standard CIDR /16 check
    if (cleanAllowed.includes("/16")) {
      const base = cleanAllowed.split("/")[0].split(".").slice(0, 2).join(".");
      if (cleanClient.startsWith(base + ".")) return true;
    }
  }

  return false;
}

// --- RATE LIMITING MIDDLEWARE ENGINE ---
interface RateLimitTracker {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitTracker>();

// Cleanup stale rate limit buckets every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, tracker] of rateLimitBuckets.entries()) {
    if (tracker.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}, 60000);

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const settings = getAllSettings();
  if (!settings.rateLimit.enabled || !settings.rateLimit.rules || settings.rateLimit.rules.length === 0) {
    return next();
  }

  const clientIp = getClientIp(req);
  const isAuth = !!(req as any).auth;
  const fullPath = (req.originalUrl || req.url || req.path || "").split("?")[0];
  const method = req.method.toUpperCase();
  const now = Date.now();

  for (const rule of settings.rateLimit.rules) {
    // 1. Check target filter
    if (rule.target === "guests" && isAuth) continue;
    if (rule.target === "auth" && !isAuth) continue;

    // 2. Check label pattern matching
    let matches = false;
    const label = rule.label.trim();

    if (label === "*:auth") {
      matches = fullPath.startsWith("/api/auth") || fullPath.includes("/auth-with-password") || fullPath.includes("/request-password-reset") || fullPath.includes("/request-otp");
    } else if (label === "*:create") {
      matches = method === "POST" && (fullPath.includes("/records") || fullPath === "/api/collections");
    } else if (label.startsWith("/")) {
      matches = fullPath.startsWith(label);
    } else {
      matches = fullPath.includes(label);
    }

    if (!matches) continue;

    // 3. Track request in bucket
    const bucketKey = `${rule.id}:${clientIp}`;
    const tracker = rateLimitBuckets.get(bucketKey);

    if (!tracker || tracker.resetAt <= now) {
      rateLimitBuckets.set(bucketKey, {
        count: 1,
        resetAt: now + rule.interval * 1000,
      });
      res.setHeader("X-RateLimit-Limit", String(rule.maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(rule.maxRequests - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + rule.interval * 1000) / 1000)));
    } else {
      tracker.count++;
      const remaining = Math.max(0, rule.maxRequests - tracker.count);
      res.setHeader("X-RateLimit-Limit", String(rule.maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(tracker.resetAt / 1000)));

      if (tracker.count > rule.maxRequests) {
        const retryAfterSec = Math.ceil((tracker.resetAt - now) / 1000);
        res.setHeader("Retry-After", String(retryAfterSec));
        return res.status(429).json({
          error: `Too Many Requests. Rate limit exceeded for rule "${rule.label}".`,
          code: 429,
          retryAfter: retryAfterSec,
        });
      }
    }
  }

  next();
}

// --- EMAIL TEMPLATE INTERPOLATION HELPER ---
export function renderEmailTemplate(
  template: EmailTemplate,
  params: Record<string, string>,
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  const defaultParams = {
    APP_NAME: "AlsaBase",
    APP_URL: "http://localhost:8090",
    ...params,
  };

  for (const [k, v] of Object.entries(defaultParams)) {
    const reg = new RegExp(`\\{${k}\\}`, "g");
    subject = subject.replace(reg, v);
    body = body.replace(reg, v);
  }

  return { subject, body };
}

// --- EMAIL SENDER (Nodemailer) ---
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string }> {
  const settings = getAllSettings();
  const emailCfg = settings.email;

  if (!emailCfg.enabled || !emailCfg.smtp.host) {
    throw new Error("Email sending is disabled or SMTP host is not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: emailCfg.smtp.host,
    port: emailCfg.smtp.port || 587,
    secure: emailCfg.smtp.port === 465,
    auth:
      emailCfg.smtp.username || emailCfg.smtp.password
        ? {
            user: emailCfg.smtp.username,
            pass: emailCfg.smtp.password,
          }
        : undefined,
    tls: {
      rejectUnauthorized: false,
    },
  });

  const from = emailCfg.smtp.fromName
    ? `"${emailCfg.smtp.fromName}" <${emailCfg.smtp.fromAddress}>`
    : emailCfg.smtp.fromAddress;

  const info = await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]+>/g, ""),
  });

  return { success: true, messageId: info.messageId };
}
