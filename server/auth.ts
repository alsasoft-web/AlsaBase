import { Request, Response, NextFunction, Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { db, hashPassword, verifyPassword } from "./db";
import {
  getAllSettings,
  getClientIp,
  isIpInAllowedList,
  renderEmailTemplate,
  sendEmail,
} from "./settings";

const JWT_SECRET =
  process.env.JWT_SECRET || "AlsaBase_super_secret_jwt_key_2026";

export interface AuthPayload {
  id: string;
  email: string;
  username?: string;
  isSuperuser: boolean;
  role: string;
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  if (req.query?.token && typeof req.query.token === "string") {
    return req.query.token;
  }
  return null;
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      (req as any).auth = payload;
    }
  }
  next();
}

export function requireSuperuser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const auth = (req as any).auth as AuthPayload | undefined;
  if (!auth || !auth.isSuperuser) {
    return res
      .status(403)
      .json({ error: "Superuser access required", code: 403 });
  }

  // Check Superuser IP whitelisting if enabled
  try {
    const settings = getAllSettings();
    if (
      settings.superuserIps.enabled &&
      Array.isArray(settings.superuserIps.allowedIps) &&
      settings.superuserIps.allowedIps.length > 0
    ) {
      const clientIp = getClientIp(req);
      if (!isIpInAllowedList(clientIp, settings.superuserIps.allowedIps)) {
        return res.status(403).json({
          error: `Superuser access is restricted from IP address: ${clientIp}`,
          code: 403,
        });
      }
    }
  } catch {
    // ignore if settings module not loaded yet
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = (req as any).auth as AuthPayload | undefined;
  if (!auth) {
    return res
      .status(401)
      .json({ error: "Authentication required", code: 401 });
  }
  next();
}

export const authRouter = Router();

// Check if initial superuser setup is required
authRouter.get('/superusers/has-initial', (_req: Request, res: Response) => {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM _superusers').get() as { count: number };
  res.json({ hasSuperuser: countRow.count > 0 });
});

// Setup first superuser (Only allowed when no superusers exist)
authRouter.post('/superusers/setup', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const countRow = db.prepare('SELECT COUNT(*) as count FROM _superusers').get() as { count: number };
  if (countRow.count > 0) {
    return res.status(400).json({ error: 'Initial superuser has already been created.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const password_hash = hashPassword(password);

  db.prepare(`
    INSERT INTO _superusers (id, email, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, email.trim().toLowerCase(), password_hash, now, now);

  const payload: AuthPayload = {
    id,
    email: email.trim().toLowerCase(),
    isSuperuser: true,
    role: 'admin'
  };

  const token = generateToken(payload);
  return res.status(201).json({
    token,
    user: payload
  });
});

// Superuser login
authRouter.post("/superusers/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const superuser = db
    .prepare("SELECT * FROM _superusers WHERE email = ?")
    .get(email) as any;
  if (!superuser || !verifyPassword(password, superuser.password_hash)) {
    return res.status(401).json({ error: "Invalid superuser credentials" });
  }

  const payload: AuthPayload = {
    id: superuser.id,
    email: superuser.email,
    isSuperuser: true,
    role: "admin",
  };

  const token = generateToken(payload);
  return res.json({
    token,
    user: {
      id: superuser.id,
      email: superuser.email,
      isSuperuser: true,
      role: "admin",
    },
  });
});

// Superuser info
authRouter.get(
  "/superusers/me",
  requireSuperuser,
  (req: Request, res: Response) => {
    const auth = (req as any).auth as AuthPayload;
    const superuser = db
      .prepare("SELECT id, email, created_at FROM _superusers WHERE id = ?")
      .get(auth.id) as any;
    if (!superuser) {
      return res.status(404).json({ error: "Superuser not found" });
    }
    return res.json({ ...superuser, isSuperuser: true, role: "admin" });
  },
);

// User registration
authRouter.post("/users/register", (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Username, email and password required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  const existing = db
    .prepare("SELECT id FROM _users WHERE email = ? OR username = ?")
    .get(email, username);
  if (existing) {
    return res
      .status(409)
      .json({ error: "User with this email or username already exists" });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const password_hash = hashPassword(password);

  db.prepare(
    `
    INSERT INTO _users (id, username, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'user', ?, ?)
  `,
  ).run(id, username, email, password_hash, now, now);

  try {
    const colExists = db.prepare("SELECT id FROM _collections WHERE name = 'users'").get();
    if (colExists) {
      db.prepare(`
        INSERT OR REPLACE INTO "users" (id, username, email, name, avatar, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'user', ?, ?)
      `).run(id, username, email, req.body.name || username, req.body.avatar || '', now, now);
    }
  } catch {}

  // Trigger verification email in background if email is enabled
  try {
    const settings = getAllSettings();
    if (settings.email.enabled) {
      const verifyToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.prepare(`
        INSERT INTO _auth_tokens (id, user_id, email, type, token, expires_at, created_at)
        VALUES (?, ?, ?, 'email_verification', ?, ?, ?)
      `).run(crypto.randomUUID(), id, email, verifyToken, expiresAt, now);

      const origin = req.get("origin") || req.get("host") || "http://localhost:8090";
      const actionUrl = `${origin.startsWith("http") ? origin : `http://${origin}`}/_/#/verify-email?token=${verifyToken}`;
      const { subject, body: emailBody } = renderEmailTemplate(settings.email.templates.verification, {
        ACTION_URL: actionUrl,
        TOKEN: verifyToken,
        USER_EMAIL: email,
      });

      sendEmail({ to: email, subject, html: emailBody }).catch((e: any) => {
        console.warn("[Auth] Failed to send welcome/verification email:", e.message);
      });
    }
  } catch {}

  const payload: AuthPayload = {
    id,
    email,
    username,
    isSuperuser: false,
    role: "user",
  };

  const token = generateToken(payload);
  return res.status(201).json({
    token,
    user: { id, username, email, role: "user", created_at: now },
  });
});

// User login
authRouter.post("/users/login", (req: Request, res: Response) => {
  const { identity, password } = req.body; // identity can be email or username
  if (!identity || !password) {
    return res
      .status(400)
      .json({ error: "Email/username and password required" });
  }

  const user = db
    .prepare("SELECT * FROM _users WHERE email = ? OR username = ?")
    .get(identity, identity) as any;
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid user credentials" });
  }

  const payload: AuthPayload = {
    id: user.id,
    email: user.email,
    username: user.username,
    isSuperuser: false,
    role: user.role || "user",
  };

  const token = generateToken(payload);
  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || "user",
      created_at: user.created_at,
    },
  });
});

// Current user profile
authRouter.get("/users/me", requireAuth, (req: Request, res: Response) => {
  const auth = (req as any).auth as AuthPayload;
  if (auth.isSuperuser) {
    return res.json({
      id: auth.id,
      email: auth.email,
      isSuperuser: true,
      role: "admin",
    });
  }

  const user = db
    .prepare(
      "SELECT id, username, email, role, created_at FROM _users WHERE id = ?",
    )
    .get(auth.id) as any;
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json(user);
});

// --- EMAIL AUTHENTICATION ENDPOINTS ---

// 1. Password Reset Request
authRouter.post(["/request-password-reset", "/users/request-password-reset"], async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare("SELECT id, email, username FROM _users WHERE email = ?").get(cleanEmail) as any;
    const superuser = !user ? (db.prepare("SELECT id, email FROM _superusers WHERE email = ?").get(cleanEmail) as any) : null;

    if (!user && !superuser) {
      return res.json({ success: true, message: "If this email is registered, a password reset email has been sent." });
    }

    const targetUser = user || superuser;
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO _auth_tokens (id, user_id, email, type, token, expires_at, created_at)
      VALUES (?, ?, ?, 'password_reset', ?, ?, ?)
    `).run(crypto.randomUUID(), targetUser.id, cleanEmail, resetToken, expiresAt, now);

    const settings = getAllSettings();
    if (settings.email.enabled) {
      const origin = req.get("origin") || req.get("host") || "http://localhost:8090";
      const actionUrl = `${origin.startsWith("http") ? origin : `http://${origin}`}/_/#/reset-password?token=${resetToken}`;

      const { subject, body } = renderEmailTemplate(settings.email.templates.passwordReset, {
        ACTION_URL: actionUrl,
        TOKEN: resetToken,
        USER_EMAIL: cleanEmail,
      });

      await sendEmail({
        to: cleanEmail,
        subject,
        html: body,
      });

      return res.json({ success: true, message: "Password reset instructions sent to your email." });
    } else {
      return res.json({
        success: true,
        message: "Password reset token created (Email delivery disabled in settings).",
        token: resetToken,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Confirm Password Reset
authRouter.post(["/confirm-password-reset", "/users/confirm-password-reset", "/reset-password"], (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: "Token and new password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const now = new Date().toISOString();
  const authRow = db.prepare("SELECT * FROM _auth_tokens WHERE token = ? AND type = 'password_reset' AND expires_at > ?").get(token, now) as any;
  if (!authRow) {
    return res.status(400).json({ error: "Invalid or expired password reset token" });
  }

  const newHash = hashPassword(password);
  db.prepare("UPDATE _users SET password_hash = ?, updated_at = ? WHERE id = ?").run(newHash, now, authRow.user_id);
  db.prepare("UPDATE _superusers SET password_hash = ?, updated_at = ? WHERE id = ?").run(newHash, now, authRow.user_id);
  db.prepare("DELETE FROM _auth_tokens WHERE id = ?").run(authRow.id);

  return res.json({ success: true, message: "Password has been successfully reset. You can now log in." });
});

// 3. Email Verification Request
authRouter.post(["/request-verification", "/users/request-verification"], async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare("SELECT id, email FROM _users WHERE email = ?").get(cleanEmail) as any;
    if (!user) {
      return res.json({ success: true, message: "If this email is registered, a verification link has been sent." });
    }

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO _auth_tokens (id, user_id, email, type, token, expires_at, created_at)
      VALUES (?, ?, ?, 'email_verification', ?, ?, ?)
    `).run(crypto.randomUUID(), user.id, cleanEmail, verifyToken, expiresAt, now);

    const settings = getAllSettings();
    if (settings.email.enabled) {
      const origin = req.get("origin") || req.get("host") || "http://localhost:8090";
      const actionUrl = `${origin.startsWith("http") ? origin : `http://${origin}`}/_/#/verify-email?token=${verifyToken}`;

      const { subject, body } = renderEmailTemplate(settings.email.templates.verification, {
        ACTION_URL: actionUrl,
        TOKEN: verifyToken,
        USER_EMAIL: cleanEmail,
      });

      await sendEmail({
        to: cleanEmail,
        subject,
        html: body,
      });

      return res.json({ success: true, message: "Verification link sent to your email." });
    } else {
      return res.json({
        success: true,
        message: "Verification token generated (Email delivery disabled in settings).",
        token: verifyToken,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Confirm Email Verification
authRouter.post(["/confirm-verification", "/users/confirm-verification"], (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "Verification token is required" });
  }

  const now = new Date().toISOString();
  const authRow = db.prepare("SELECT * FROM _auth_tokens WHERE token = ? AND type = 'email_verification' AND expires_at > ?").get(token, now) as any;
  if (!authRow) {
    return res.status(400).json({ error: "Invalid or expired verification token" });
  }

  try {
    db.prepare("UPDATE _users SET verified = 1, updated_at = ? WHERE id = ?").run(now, authRow.user_id);
    db.prepare("UPDATE users SET verified = 1, updated_at = ? WHERE id = ?").run(now, authRow.user_id);
  } catch {}

  db.prepare("DELETE FROM _auth_tokens WHERE id = ?").run(authRow.id);
  return res.json({ success: true, message: "Email address verified successfully." });
});

// 5. Email Change Request
authRouter.post(["/request-email-change", "/users/request-email-change"], requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth as AuthPayload;
    const { newEmail } = req.body;
    if (!newEmail) {
      return res.status(400).json({ error: "New email address is required" });
    }

    const cleanNewEmail = newEmail.trim().toLowerCase();
    const existing = db.prepare("SELECT id FROM _users WHERE email = ? AND id != ?").get(cleanNewEmail, auth.id);
    if (existing) {
      return res.status(409).json({ error: "This email address is already in use." });
    }

    const changeToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO _auth_tokens (id, user_id, email, type, token, new_email, expires_at, created_at)
      VALUES (?, ?, ?, 'email_change', ?, ?, ?, ?)
    `).run(crypto.randomUUID(), auth.id, auth.email, changeToken, cleanNewEmail, expiresAt, now);

    const settings = getAllSettings();
    if (settings.email.enabled) {
      const origin = req.get("origin") || req.get("host") || "http://localhost:8090";
      const actionUrl = `${origin.startsWith("http") ? origin : `http://${origin}`}/_/#/confirm-email-change?token=${changeToken}`;

      const { subject, body } = renderEmailTemplate(settings.email.templates.confirmEmailChange, {
        ACTION_URL: actionUrl,
        TOKEN: changeToken,
        USER_EMAIL: cleanNewEmail,
      });

      await sendEmail({
        to: cleanNewEmail,
        subject,
        html: body,
      });

      return res.json({ success: true, message: "Confirmation email sent to new address." });
    } else {
      return res.json({
        success: true,
        message: "Email change token generated (Email delivery disabled in settings).",
        token: changeToken,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Confirm Email Change
authRouter.post(["/confirm-email-change", "/users/confirm-email-change"], (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  const now = new Date().toISOString();
  const authRow = db.prepare("SELECT * FROM _auth_tokens WHERE token = ? AND type = 'email_change' AND expires_at > ?").get(token, now) as any;
  if (!authRow || !authRow.new_email) {
    return res.status(400).json({ error: "Invalid or expired email change token" });
  }

  if (password) {
    const user = db.prepare("SELECT password_hash FROM _users WHERE id = ?").get(authRow.user_id) as any;
    if (user && !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid password confirmation" });
    }
  }

  db.prepare("UPDATE _users SET email = ?, updated_at = ? WHERE id = ?").run(authRow.new_email, now, authRow.user_id);
  try {
    db.prepare("UPDATE users SET email = ?, updated_at = ? WHERE id = ?").run(authRow.new_email, now, authRow.user_id);
  } catch {}

  db.prepare("DELETE FROM _auth_tokens WHERE id = ?").run(authRow.id);
  return res.json({ success: true, message: "Email address updated successfully.", email: authRow.new_email });
});

// 7. OTP Request (One-Time Password)
authRouter.post(["/request-otp", "/users/request-otp"], async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare("SELECT id, email, username FROM _users WHERE email = ?").get(cleanEmail) as any;
    if (!user) {
      return res.status(404).json({ error: "No account found with this email" });
    }

    const otpCode = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO _auth_tokens (id, user_id, email, type, token, expires_at, created_at)
      VALUES (?, ?, ?, 'otp', ?, ?, ?)
    `).run(crypto.randomUUID(), user.id, cleanEmail, otpCode, expiresAt, now);

    const settings = getAllSettings();
    if (settings.email.enabled) {
      const { subject, body } = renderEmailTemplate(settings.email.templates.otp, {
        OTP: otpCode,
        OTP_CODE: otpCode,
        USER_EMAIL: cleanEmail,
      });

      await sendEmail({
        to: cleanEmail,
        subject,
        html: body,
      });

      return res.json({ success: true, message: "OTP verification code sent to your email." });
    } else {
      return res.json({
        success: true,
        message: "OTP generated (Email delivery disabled in settings).",
        otp: otpCode,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 8. Verify OTP & Login
authRouter.post(["/verify-otp", "/users/verify-otp"], (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP code are required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const authRow = db.prepare("SELECT * FROM _auth_tokens WHERE email = ? AND token = ? AND type = 'otp' AND expires_at > ?").get(cleanEmail, otp.trim(), now) as any;

  if (!authRow) {
    return res.status(400).json({ error: "Invalid or expired OTP verification code" });
  }

  const user = db.prepare("SELECT id, username, email, role, created_at FROM _users WHERE id = ?").get(authRow.user_id) as any;
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  db.prepare("DELETE FROM _auth_tokens WHERE id = ?").run(authRow.id);

  const payload: AuthPayload = {
    id: user.id,
    email: user.email,
    username: user.username,
    isSuperuser: false,
    role: user.role || "user",
  };

  const token = generateToken(payload);
  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || "user",
      created_at: user.created_at,
    },
  });
});
