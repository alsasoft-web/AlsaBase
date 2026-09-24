import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db, hashPassword, verifyPassword } from './db';
import { getCollection, listCollections, createCollection, updateCollection, deleteCollection, sanitizeIdentifier, FieldDef, getTableIndexes, createTableIndex, dropTableIndex } from './schema';
import { AuthPayload, requireSuperuser, generateToken, requireAuth } from './auth';
import { broadcastRecordEvent } from './events';
import { saveRecordFile, deleteRecordFiles } from './files';
import { getAllSettings, renderEmailTemplate, sendEmail } from './settings';

export const collectionsRouter = Router();

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

// Helper to evaluate single-record access rule
export function evaluateRule(
  rule: string | null | undefined,
  auth: AuthPayload | undefined,
  record?: any
): boolean {
  // Superusers / Admins always bypass all collection rules
  if (auth && auth.isSuperuser) return true;

  // null or undefined means "Locked" (Admin / Superuser only)
  if (rule === null || rule === undefined) return false;

  const trimmed = rule.trim();

  // Empty string or 'public' means open to everyone
  if (trimmed === '' || trimmed.toLowerCase() === 'public') return true;

  // Explicit 'admin' keyword means admin/superuser only
  if (trimmed.toLowerCase() === 'admin') return !!(auth && auth.isSuperuser);

  // 'auth' keyword
  if (trimmed.toLowerCase() === 'auth') return !!auth;

  // Simple token / id check: @request.auth.id != "" or @request.auth.id != ''
  if (
    trimmed.includes('@request.auth.id') &&
    (trimmed.includes('!= ""') || trimmed.includes("!= ''") || trimmed.includes('!= null'))
  ) {
    if (!auth || !auth.id) return false;
    if (
      trimmed === '@request.auth.id != ""' ||
      trimmed === "@request.auth.id != ''" ||
      trimmed === '@request.auth.id != null'
    ) {
      return true;
    }
  }

  // If unauthenticated guest check: @request.auth.id = "" or @request.auth.id = ''
  if (
    trimmed === '@request.auth.id = ""' ||
    trimmed === "@request.auth.id = ''" ||
    trimmed === '@request.auth.id = null'
  ) {
    return !auth || !auth.id;
  }

  // If no auth but the rule explicitly requires @request.auth
  if (!auth && trimmed.includes('@request.auth')) {
    return false;
  }

  // If record is provided, evaluate field expressions e.g. "id = @request.auth.id" or "user = @request.auth.id"
  if (record) {
    // Handle standard ownership checks
    if (trimmed === 'id = @request.auth.id' || trimmed === 'id == @request.auth.id') {
      return !!(auth && auth.id && String(record.id) === String(auth.id));
    }
    if (trimmed === 'user = @request.auth.id' || trimmed === 'user == @request.auth.id') {
      return !!(auth && auth.id && String(record.user) === String(auth.id));
    }
    if (trimmed === 'userId = @request.auth.id' || trimmed === 'userId == @request.auth.id') {
      return !!(auth && auth.id && String(record.userId) === String(auth.id));
    }
    if (trimmed === 'author = @request.auth.id' || trimmed === 'author == @request.auth.id') {
      return !!(auth && auth.id && String(record.author) === String(auth.id));
    }

    // Dynamic evaluation for collection rule syntax
    try {
      let expr = trimmed
        .replace(/@request\.auth\.id/g, JSON.stringify(auth?.id || ''))
        .replace(/@request\.auth\.email/g, JSON.stringify(auth?.email || ''))
        .replace(/@request\.auth\.username/g, JSON.stringify(auth?.username || ''))
        .replace(/@request\.auth\.role/g, JSON.stringify(auth?.role || ''))
        .replace(/&&/g, '&&')
        .replace(/\|\|/g, '||')
        .replace(/=/g, '===')
        .replace(/======/g, '===')
        .replace(/====/g, '===')
        .replace(/!==/g, '!==')
        .replace(/!=/g, '!==');

      const recordContext = { ...record };
      const keys = Object.keys(recordContext);
      const values = Object.values(recordContext);
      const func = new Function(...keys, `try { return Boolean(${expr}); } catch(e) { return false; }`);
      return Boolean(func(...values));
    } catch {
      return false;
    }
  }

  return !!auth;
}

// Translates a collection listRule into a SQL WHERE clause fragment and parameters
export function ruleToSqlWhere(
  rule: string | null | undefined,
  auth?: AuthPayload
): { sql?: string; params?: any[]; allowed: boolean } {
  // Superusers bypass all rules
  if (auth && auth.isSuperuser) {
    return { allowed: true };
  }

  // null / undefined means Locked (Admin only)
  if (rule === null || rule === undefined) {
    return { allowed: false };
  }

  const trimmed = rule.trim();

  // Public access
  if (trimmed === '' || trimmed.toLowerCase() === 'public') {
    return { allowed: true };
  }

  // Admin only
  if (trimmed.toLowerCase() === 'admin') {
    return { allowed: !!(auth && auth.isSuperuser) };
  }

  // Authenticated users only
  if (
    trimmed.toLowerCase() === 'auth' ||
    trimmed === '@request.auth.id != ""' ||
    trimmed === "@request.auth.id != ''" ||
    trimmed === '@request.auth.id != null'
  ) {
    if (!auth || !auth.id) return { allowed: false };
    return { allowed: true };
  }

  // If rule requires @request.auth but user is not logged in
  if (!auth && trimmed.includes('@request.auth')) {
    return { allowed: false };
  }

  // Owner filter: id = @request.auth.id
  if (trimmed === 'id = @request.auth.id' || trimmed === 'id == @request.auth.id') {
    if (!auth || !auth.id) return { allowed: false };
    return { sql: `"id" = ?`, params: [auth.id], allowed: true };
  }

  // Field filter: user = @request.auth.id
  if (trimmed === 'user = @request.auth.id' || trimmed === 'user == @request.auth.id') {
    if (!auth || !auth.id) return { allowed: false };
    return { sql: `"user" = ?`, params: [auth.id], allowed: true };
  }

  // Field filter: userId = @request.auth.id
  if (trimmed === 'userId = @request.auth.id' || trimmed === 'userId == @request.auth.id') {
    if (!auth || !auth.id) return { allowed: false };
    return { sql: `"userId" = ?`, params: [auth.id], allowed: true };
  }

  // Field filter: author = @request.auth.id
  if (trimmed === 'author = @request.auth.id' || trimmed === 'author == @request.auth.id') {
    if (!auth || !auth.id) return { allowed: false };
    return { sql: `"author" = ?`, params: [auth.id], allowed: true };
  }

  // General SQL conversion for expressions
  try {
    let sqlExpr = trimmed;
    const params: any[] = [];

    if (auth && auth.id) {
      sqlExpr = sqlExpr.replace(/@request\.auth\.id/g, `'${auth.id.replace(/'/g, "''")}'`);
      sqlExpr = sqlExpr.replace(/@request\.auth\.email/g, `'${(auth.email || '').replace(/'/g, "''")}'`);
      sqlExpr = sqlExpr.replace(/@request\.auth\.username/g, `'${(auth.username || '').replace(/'/g, "''")}'`);
    } else {
      sqlExpr = sqlExpr.replace(/@request\.auth\.id/g, `''`);
      sqlExpr = sqlExpr.replace(/@request\.auth\.email/g, `''`);
      sqlExpr = sqlExpr.replace(/@request\.auth\.username/g, `''`);
    }

    sqlExpr = sqlExpr.replace(/&&/g, 'AND').replace(/\|\|/g, 'OR').replace(/==/g, '=').replace(/!=/g, '<>');

    return { sql: `(${sqlExpr})`, params, allowed: true };
  } catch {
    return { allowed: !!auth };
  }
}

// Convert input values according to field definition
function formatFieldValue(field: FieldDef, value: any): any {
  if (value === undefined || value === null) return null;
  if (field.type === 'number') return Number(value);
  if (field.type === 'bool') return value === true || value === 1 || value === 'true' ? 1 : 0;
  if (field.type === 'json') return typeof value === 'string' ? value : JSON.stringify(value);
  if (field.type === 'file') return typeof value === 'string' ? value : (value?.name || String(value));
  if (field.type === 'date') return new Date(value).toISOString();
  return String(value);
}

// Format retrieved database row with privacy and serialization checks
export function formatRecordOutput(
  fields: FieldDef[],
  row: any,
  auth?: AuthPayload,
  isAuthCollection?: boolean
): any {
  if (!row) return null;
  const formatted: any = { ...row };

  for (const field of fields) {
    if (field.name === 'password' || field.name === 'tokenKey') {
      delete formatted[field.name];
    }
    const val = row[field.name];
    if (val !== null && val !== undefined) {
      if (field.type === 'bool') {
        formatted[field.name] = val === 1 || val === true;
      } else if (field.type === 'json' || field.type === 'file') {
        try {
          formatted[field.name] = typeof val === 'string' ? JSON.parse(val) : val;
        } catch {
          formatted[field.name] = val;
        }
      }
    }
  }

  // Enforce emailVisibility for auth collections or records containing email
  const isAuth = isAuthCollection || fields.some((f) => f.name === 'emailVisibility');
  if (isAuth && ('email' in formatted || 'email' in row)) {
    const isSuperuser = !!(auth && auth.isSuperuser);
    const isOwner = !!(auth && auth.id === row.id);
    const isEmailVisible =
      row.emailVisibility === 1 ||
      row.emailVisibility === true ||
      row.emailVisibility === 'true';

    // If not superuser, not owner, and emailVisibility is false -> sanitize to empty string
    if (!isSuperuser && !isOwner && !isEmailVisible) {
      formatted.email = '';
    }
  }

  return formatted;
}

// --- SCHEMA MANAGEMENT (Superuser Only) ---

collectionsRouter.get('/', requireSuperuser, (_req: Request, res: Response) => {
  const collections = listCollections();
  res.json({ items: collections, total: collections.length });
});

collectionsRouter.get('/:name/schema', requireSuperuser, (req: Request, res: Response) => {
  const name = getParam(req.params.name);
  const col = getCollection(name);
  if (!col) return res.status(404).json({ error: 'Collection not found' });
  res.json(col);
});

collectionsRouter.get('/:name', requireSuperuser, (req: Request, res: Response) => {
  const name = getParam(req.params.name);
  const col = getCollection(name);
  if (!col) return res.status(404).json({ error: 'Collection not found' });
  res.json(col);
});

collectionsRouter.post('/', requireSuperuser, (req: Request, res: Response) => {
  try {
    const created = createCollection(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

collectionsRouter.patch('/:name', requireSuperuser, (req: Request, res: Response) => {
  try {
    const name = getParam(req.params.name);
    const updated = updateCollection(name, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

collectionsRouter.delete('/:name/truncate', requireSuperuser, (req: Request, res: Response) => {
  const name = getParam(req.params.name);
  const col = getCollection(name);
  if (!col) return res.status(404).json({ error: 'Collection not found' });

  try {
    const resRun = db.prepare(`DELETE FROM "${col.name}"`).run();
    res.json({ success: true, changes: resRun.changes });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

collectionsRouter.delete('/:name', requireSuperuser, (req: Request, res: Response) => {
  const name = getParam(req.params.name);
  if (name === 'users') {
    return res.status(400).json({ error: 'Cannot delete core system collection users' });
  }
  const deleted = deleteCollection(name);
  if (!deleted) return res.status(404).json({ error: 'Collection not found' });
  res.json({ success: true });
});

// --- INDEX MANAGEMENT (Superuser Only) ---

// Get all active SQLite indexes for a collection/table
collectionsRouter.get('/:name/indexes', requireSuperuser, (req: Request, res: Response) => {
  try {
    const name = getParam(req.params.name);
    const indexes = getTableIndexes(name);
    res.json({ items: indexes, total: indexes.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Create an index for a collection/table
collectionsRouter.post('/:name/indexes', requireSuperuser, (req: Request, res: Response) => {
  try {
    const name = getParam(req.params.name);
    const result = createTableIndex(name, req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Drop an index from a collection/table
collectionsRouter.delete('/:name/indexes/:indexName', requireSuperuser, (req: Request, res: Response) => {
  try {
    const name = getParam(req.params.name);
    const indexName = getParam(req.params.indexName);
    const result = dropTableIndex(name, indexName);
    res.json({ success: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- RECORD CRUD ---

// List records with pagination, search, sort, and filter
collectionsRouter.get('/:collection/records', (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: `Collection '${collectionName}' not found` });

  const auth = (req as any).auth as AuthPayload | undefined;
  const ruleCheck = ruleToSqlWhere(col.rules?.list, auth);
  if (!ruleCheck.allowed) {
    return res.status(403).json({ error: 'Access denied to list records', code: 403 });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 30));
  const offset = (page - 1) * limit;

  // Sorting
  const sortParam = (req.query.sort as string) || '-created_at';
  const isDesc = sortParam.startsWith('-');
  const sortField = sanitizeIdentifier(sortParam.replace(/^[-+]/, ''));
  const sortOrder = isDesc ? 'DESC' : 'ASC';

  // Search & Filter
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (ruleCheck.sql) {
    whereClauses.push(ruleCheck.sql);
    if (ruleCheck.params && ruleCheck.params.length > 0) {
      params.push(...ruleCheck.params);
    }
  }

  const searchQuery = req.query.search as string;
  if (searchQuery && col.fields.length > 0) {
    const textFields = col.fields.filter((f: FieldDef) => f.type === 'text');
    if (textFields.length > 0) {
      const searchTerms = textFields.map((f: FieldDef) => `"${f.name}" LIKE ?`).join(' OR ');
      whereClauses.push(`(${searchTerms})`);
      for (let i = 0; i < textFields.length; i++) {
        params.push(`%${searchQuery}%`);
      }
    }
  }

  // Exact match filters for field query params
  for (const field of col.fields) {
    if (req.query[field.name] !== undefined) {
      whereClauses.push(`"${field.name}" = ?`);
      params.push(formatFieldValue(field, req.query[field.name]));
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM "${col.name}" ${whereSql}`).get(...params) as { total: number };
  const total = countRow ? countRow.total : 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const rows = db.prepare(`
    SELECT * FROM "${col.name}"
    ${whereSql}
    ORDER BY "${sortField}" ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  const isAuth = col.type === 'auth' || col.name === 'users';
  const formattedItems = rows.map((r) => formatRecordOutput(col.fields, r, auth, isAuth));

  res.json({
    page,
    limit,
    total,
    totalPages,
    items: formattedItems
  });
});

// Get single record
collectionsRouter.get('/:collection/records/:id', (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const recordId = getParam(req.params.id);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: 'Collection not found' });

  const auth = (req as any).auth as AuthPayload | undefined;
  const row = db.prepare(`SELECT * FROM "${col.name}" WHERE id = ?`).get(recordId) as any;
  if (!row) return res.status(404).json({ error: 'Record not found' });

  if (!evaluateRule(col.rules?.view, auth, row)) {
    return res.status(403).json({ error: 'Access denied to view record', code: 403 });
  }

  const isAuth = col.type === 'auth' || col.name === 'users';
  res.json(formatRecordOutput(col.fields, row, auth, isAuth));
});

// Create record
collectionsRouter.post('/:collection/records', (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: 'Collection not found' });

  const auth = (req as any).auth as AuthPayload | undefined;
  if (!evaluateRule(col.rules?.create, auth, req.body)) {
    return res.status(403).json({ error: 'Access denied to create record', code: 403 });
  }

  const id = req.body.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const isAuth = col.type === 'auth' || col.name === 'users';
  const bodyData = { ...req.body };
  delete bodyData.tokenKey;

  // Auto-hash password for auth collections or password fields
  if (bodyData.password && typeof bodyData.password === 'string' && bodyData.password.trim() !== '') {
    bodyData.password = hashPassword(bodyData.password);
  } else if (isAuth) {
    // Generate a secure default random hash if password omitted
    bodyData.password = hashPassword(crypto.randomBytes(16).toString('hex'));
  }

  // Save physical files to data/files/<collection>/<recordId>/<filename>
  for (const field of col.fields) {
    if (field.type === 'file' || field.name === 'avatar') {
      if (bodyData[field.name]) {
        bodyData[field.name] = saveRecordFile(col.name, id, bodyData[field.name]);
      }
    }
  }

  const fieldNames = ['id', 'created_at', 'updated_at'];
  const placeholders = ['?', '?', '?'];
  const values: any[] = [id, now, now];

  for (const field of col.fields) {
    if (field.required && (bodyData[field.name] === undefined || bodyData[field.name] === null || bodyData[field.name] === '')) {
      return res.status(400).json({ error: `Field '${field.name}' is required` });
    }
    if (bodyData[field.name] !== undefined) {
      fieldNames.push(`"${field.name}"`);
      placeholders.push('?');
      values.push(formatFieldValue(field, bodyData[field.name]));
    }
  }

  try {
    const insertSql = `INSERT INTO "${col.name}" (${fieldNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
    db.prepare(insertSql).run(...values);

    // Keep _users sync for users / auth collection
    if (col.name === 'users' || col.type === 'auth') {
      try {
        const username = bodyData.username || bodyData.name || (bodyData.email ? bodyData.email.split('@')[0] : id);
        const email = bodyData.email || '';
        const passwordHash = bodyData.password || hashPassword(crypto.randomUUID());
        db.prepare(`
          INSERT OR REPLACE INTO _users (id, username, email, password_hash, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'user', ?, ?)
        `).run(id, username, email, passwordHash, now, now);
      } catch {}
    }

    const inserted = db.prepare(`SELECT * FROM "${col.name}" WHERE id = ?`).get(id) as any;
    const formatted = formatRecordOutput(col.fields, inserted, auth, isAuth);
    broadcastRecordEvent('create', col.name, formatted);
    res.status(201).json(formatted);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update record
collectionsRouter.patch('/:collection/records/:id', (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const recordId = getParam(req.params.id);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: 'Collection not found' });

  const auth = (req as any).auth as AuthPayload | undefined;
  const existing = db.prepare(`SELECT * FROM "${col.name}" WHERE id = ?`).get(recordId);
  if (!existing) return res.status(404).json({ error: 'Record not found' });

  if (!evaluateRule(col.rules?.update, auth, existing)) {
    return res.status(403).json({ error: 'Access denied to update record', code: 403 });
  }

  const isAuth = col.type === 'auth' || col.name === 'users';
  const bodyData = { ...req.body };
  const now = new Date().toISOString();

  // If password is being updated, hash it; if empty/omitted, don't overwrite
  if (bodyData.password !== undefined) {
    if (bodyData.password && typeof bodyData.password === 'string' && bodyData.password.trim() !== '') {
      bodyData.password = hashPassword(bodyData.password);
    } else {
      delete bodyData.password;
    }
  }

  // Save physical files to data/files/<collection>/<recordId>/<filename>
  for (const field of col.fields) {
    if (field.type === 'file' || field.name === 'avatar') {
      if (bodyData[field.name] !== undefined) {
        bodyData[field.name] = saveRecordFile(col.name, recordId, bodyData[field.name]);
      }
    }
  }

  const updates: string[] = ['"updated_at" = ?'];
  const values: any[] = [now];

  for (const field of col.fields) {
    if (bodyData[field.name] !== undefined) {
      updates.push(`"${field.name}" = ?`);
      values.push(formatFieldValue(field, bodyData[field.name]));
    }
  }

  values.push(recordId);

  try {
    db.prepare(`UPDATE "${col.name}" SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Keep _users sync for users / auth collection
    if (isAuth) {
      try {
        const username = bodyData.username || bodyData.name;
        const email = bodyData.email;
        if (email || username || bodyData.password) {
          const userUpdates: string[] = ['updated_at = ?'];
          const userVals: any[] = [now];
          if (email) {
            userUpdates.push('email = ?');
            userVals.push(email);
          }
          if (username) {
            userUpdates.push('username = ?');
            userVals.push(username);
          }
          if (bodyData.password) {
            userUpdates.push('password_hash = ?');
            userVals.push(bodyData.password);
          }
          userVals.push(recordId);
          db.prepare(`UPDATE _users SET ${userUpdates.join(', ')} WHERE id = ?`).run(...userVals);
        }
      } catch {}
    }

    const updated = db.prepare(`SELECT * FROM "${col.name}" WHERE id = ?`).get(recordId) as any;
    const formatted = formatRecordOutput(col.fields, updated, auth, isAuth);
    broadcastRecordEvent('update', col.name, formatted);
    res.json(formatted);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete record
collectionsRouter.delete('/:collection/records/:id', (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const recordId = getParam(req.params.id);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: 'Collection not found' });

  const auth = (req as any).auth as AuthPayload | undefined;
  const existing = db.prepare(`SELECT * FROM "${col.name}" WHERE id = ?`).get(recordId);
  if (!existing) return res.status(404).json({ error: 'Record not found' });

  if (!evaluateRule(col.rules?.delete, auth, existing)) {
    return res.status(403).json({ error: 'Access denied to delete record', code: 403 });
  }

  const isAuth = col.type === 'auth' || col.name === 'users';
  const formattedExisting = formatRecordOutput(col.fields, existing, auth, isAuth);
  db.prepare(`DELETE FROM "${col.name}" WHERE id = ?`).run(recordId);
  deleteRecordFiles(col.name, recordId);
  broadcastRecordEvent('delete', col.name, formattedExisting || { id: recordId });
  res.json({ success: true, id: recordId });
});

// --- AUTH COLLECTION METHODS ---

// 1. List available auth methods for the collection (OAuth2 providers, Password, MFA, OTP)
collectionsRouter.get('/:collection/auth-methods', (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: 'Collection not found' });
  if (col.type !== 'auth' && col.name !== 'users') {
    return res.status(400).json({ error: `Collection '${collectionName}' is not an auth collection` });
  }

  const options = col.options || {};
  const allowPassword = options.allowEmailAuth !== false;
  const allowUsername = options.allowUsernameAuth !== false;
  const allowOAuth2 = Boolean(options.allowOAuth2Auth);
  const allowMfa = Boolean(options.allowMfa);
  const allowOtp = Boolean(options.allowOtpAuth);

  const configuredProviders = options.oauth2?.providers || [
    { name: 'google', displayName: 'Google', enabled: true },
    { name: 'github', displayName: 'GitHub', enabled: true },
    { name: 'discord', displayName: 'Discord', enabled: false },
    { name: 'microsoft', displayName: 'Microsoft', enabled: false }
  ];

  const origin = req.get('origin') || req.get('host') || 'http://localhost:8090';
  const baseUrl = origin.startsWith('http') ? origin : `http://${origin}`;

  const authProviders = allowOAuth2
    ? configuredProviders
        .filter((p: any) => p.enabled !== false)
        .map((p: any) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          state: crypto.randomBytes(16).toString('hex'),
          codeVerifier: crypto.randomBytes(32).toString('hex'),
          codeChallenge: crypto.randomBytes(32).toString('hex'),
          codeChallengeMethod: 'S256',
          authUrl: p.authUrl || `${baseUrl}/api/collections/${col.name}/auth-with-oauth2?provider=${p.name}`,
          clientId: p.clientId || ''
        }))
    : [];

  res.json({
    mfa: {
      enabled: allowMfa,
      duration: options.mfa?.duration || 600
    },
    otp: {
      enabled: allowOtp,
      duration: 600
    },
    password: {
      enabled: allowPassword,
      identityFields: [
        'email',
        ...(allowUsername ? ['username', 'name'] : [])
      ]
    },
    oauth2: {
      enabled: allowOAuth2,
      providers: authProviders
    },
    authProviders
  });
});

// 2. Authenticate with OAuth2 provider
collectionsRouter.post('/:collection/auth-with-oauth2', async (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: 'Collection not found' });
  if (col.type !== 'auth' && col.name !== 'users') {
    return res.status(400).json({ error: `Collection '${collectionName}' is not an auth collection` });
  }

  const { provider, code, token: clientToken, createData } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'OAuth2 provider name is required' });
  }

  // Resolve user info from code, client token, or payload
  let oauthUser: { id?: string; email: string; name?: string; avatarUrl?: string; raw?: any } | null = null;

  try {
    if (clientToken && typeof clientToken === 'string') {
      // Exchange token with provider APIs
      if (provider === 'google') {
        const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${clientToken}` }
        });
        if (resp.ok) {
          const info: any = await resp.json();
          oauthUser = { id: info.sub, email: info.email, name: info.name, avatarUrl: info.picture, raw: info };
        }
      } else if (provider === 'github') {
        const resp = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${clientToken}`, 'User-Agent': 'AlsaBase' }
        });
        if (resp.ok) {
          const info: any = await resp.json();
          let email = info.email;
          if (!email) {
            const emailResp = await fetch('https://api.github.com/user/emails', {
              headers: { Authorization: `Bearer ${clientToken}`, 'User-Agent': 'AlsaBase' }
            });
            if (emailResp.ok) {
              const emails: any = await emailResp.json();
              const primary = emails.find((e: any) => e.primary && e.verified) || emails[0];
              if (primary) email = primary.email;
            }
          }
          oauthUser = { id: String(info.id), email: email || `${info.login}@github.oauth`, name: info.name || info.login, avatarUrl: info.avatar_url, raw: info };
        }
      } else if (provider === 'discord') {
        const resp = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${clientToken}` }
        });
        if (resp.ok) {
          const info: any = await resp.json();
          oauthUser = { id: info.id, email: info.email || `${info.username}@discord.oauth`, name: info.global_name || info.username, avatarUrl: info.avatar ? `https://cdn.discordapp.com/avatars/${info.id}/${info.avatar}.png` : undefined, raw: info };
        }
      }
    }

    // Fallback: parse direct user profile from body if passed by SDK or mock
    if (!oauthUser) {
      const email = req.body.email || req.body.user?.email || `${provider}_${code || crypto.randomUUID().slice(0, 8)}@${provider}.oauth`;
      const name = req.body.name || req.body.user?.name || `${provider}_user`;
      oauthUser = {
        id: req.body.id || req.body.user?.id || crypto.randomUUID(),
        email: email.trim().toLowerCase(),
        name,
        avatarUrl: req.body.avatarUrl || req.body.avatar,
        raw: req.body
      };
    }
  } catch (err: any) {
    return res.status(400).json({ error: `Failed to exchange OAuth2 token: ${err.message}` });
  }

  if (!oauthUser || !oauthUser.email) {
    return res.status(400).json({ error: 'Failed to retrieve email address from OAuth2 provider' });
  }

  const cleanEmail = oauthUser.email.trim().toLowerCase();
  const now = new Date().toISOString();

  // Find existing record by email
  let existing = db.prepare(`SELECT * FROM "${col.name}" WHERE email = ?`).get(cleanEmail) as any;
  let isNew = false;

  if (!existing) {
    isNew = true;
    const newId = crypto.randomUUID();
    const defaultPassword = hashPassword(crypto.randomBytes(24).toString('hex'));
    const userName = oauthUser.name || cleanEmail.split('@')[0];

    const fieldsToInsert = ['id', 'email', 'name', 'password', 'verified', 'emailVisibility', 'created_at', 'updated_at'];
    const placeholders = ['?', '?', '?', '?', 1, 0, '?', '?'];
    const values: any[] = [newId, cleanEmail, userName, defaultPassword, now, now];

    // Merge any optional custom createData fields
    if (createData && typeof createData === 'object') {
      for (const field of col.fields) {
        if (!['id', 'email', 'name', 'password', 'verified', 'emailVisibility', 'created_at', 'updated_at'].includes(field.name) && createData[field.name] !== undefined) {
          fieldsToInsert.push(`"${field.name}"`);
          placeholders.push('?');
          values.push(formatFieldValue(field, createData[field.name]));
        }
      }
    }

    try {
      db.prepare(`INSERT INTO "${col.name}" (${fieldsToInsert.join(', ')}) VALUES (${placeholders.join(', ')})`).run(...values);
      existing = db.prepare(`SELECT * FROM "${col.name}" WHERE id = ?`).get(newId) as any;

      // Keep _users in sync
      try {
        db.prepare(`
          INSERT OR REPLACE INTO _users (id, username, email, password_hash, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'user', ?, ?)
        `).run(newId, userName, cleanEmail, defaultPassword, now, now);
      } catch {}
    } catch (insertErr: any) {
      return res.status(400).json({ error: `Failed to create auth record: ${insertErr.message}` });
    }
  }

  // Check MFA
  if (col.options?.allowMfa) {
    const mfaId = crypto.randomUUID();
    const mfaOtp = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO _auth_tokens (id, user_id, email, type, token, expires_at, created_at)
      VALUES (?, ?, ?, 'mfa', ?, ?, ?)
    `).run(mfaId, existing.id, cleanEmail, mfaOtp, expiresAt, now);

    // Send email if configured
    try {
      const settings = getAllSettings();
      if (settings.email.enabled) {
        const { subject, body } = renderEmailTemplate(settings.email.templates.otp || { subject: 'Verification Code', body: 'Your code is {OTP}' }, {
          OTP: mfaOtp,
          OTP_CODE: mfaOtp,
          USER_EMAIL: cleanEmail
        });
        sendEmail({ to: cleanEmail, subject, html: body }).catch(() => {});
      }
    } catch {}

    return res.json({
      mfaId,
      mfaRequired: true,
      duration: 600,
      message: 'Multi-factor authentication code required'
    });
  }

  const authPayload: AuthPayload = {
    id: existing.id,
    email: existing.email || cleanEmail,
    username: existing.username || existing.name || cleanEmail.split('@')[0],
    isSuperuser: false,
    role: existing.role || 'user'
  };

  const token = generateToken(authPayload);
  const formatted = formatRecordOutput(col.fields, existing, authPayload, true);

  return res.json({
    token,
    record: formatted,
    meta: {
      isNew,
      provider,
      rawUser: oauthUser.raw || oauthUser
    }
  });
});

// 3. Authenticate record with password
collectionsRouter.post('/:collection/auth-with-password', async (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: 'Collection not found' });
  if (col.type !== 'auth' && col.name !== 'users') {
    return res.status(400).json({ error: `Collection '${collectionName}' is not an auth collection` });
  }

  const { identity, password } = req.body;
  if (!identity || !password) {
    return res.status(400).json({ error: 'Identity (email, username, or name) and password are required' });
  }

  const cleanIdentity = identity.trim();
  const hasUsernameCol = col.fields.some((f) => f.name === 'username');
  const hasNameCol = col.fields.some((f) => f.name === 'name');

  let query = `SELECT * FROM "${col.name}" WHERE email = ?`;
  const params: any[] = [cleanIdentity.toLowerCase()];

  if (hasUsernameCol) {
    query += ` OR username = ?`;
    params.push(cleanIdentity);
  }
  if (hasNameCol) {
    query += ` OR name = ?`;
    params.push(cleanIdentity);
  }

  // Query internal user as fallback
  const userInInternal = db.prepare('SELECT * FROM _users WHERE email = ? OR username = ?').get(cleanIdentity.toLowerCase(), cleanIdentity) as any;

  let record = db.prepare(query).get(...params) as any;
  if (!record && userInInternal && (col.name === 'users' || col.type === 'auth')) {
    record = db.prepare(`SELECT * FROM "${col.name}" WHERE id = ?`).get(userInInternal.id) as any;
  }

  const passwordHash = record?.password || userInInternal?.password_hash;

  if (!record || !passwordHash || !verifyPassword(password, passwordHash)) {
    return res.status(400).json({ error: 'Failed to authenticate: Invalid identity or password' });
  }

  const cleanEmail = record.email || userInInternal?.email || '';

  // Check MFA requirement
  if (col.options?.allowMfa) {
    const mfaId = crypto.randomUUID();
    const mfaOtp = String(crypto.randomInt(100000, 999999));
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO _auth_tokens (id, user_id, email, type, token, expires_at, created_at)
      VALUES (?, ?, ?, 'mfa', ?, ?, ?)
    `).run(mfaId, record.id, cleanEmail, mfaOtp, expiresAt, now);

    try {
      const settings = getAllSettings();
      if (settings.email.enabled && cleanEmail) {
        const { subject, body } = renderEmailTemplate(settings.email.templates.otp || { subject: 'Verification Code', body: 'Your code is {OTP}' }, {
          OTP: mfaOtp,
          OTP_CODE: mfaOtp,
          USER_EMAIL: cleanEmail
        });
        sendEmail({ to: cleanEmail, subject, html: body }).catch(() => {});
      }
    } catch {}

    return res.json({
      mfaId,
      mfaRequired: true,
      duration: 600,
      message: 'A multi-factor authentication verification code has been sent to your email.'
    });
  }

  const authPayload: AuthPayload = {
    id: record.id,
    email: cleanEmail,
    username: record.username || record.name || userInInternal?.username || cleanEmail.split('@')[0] || record.id,
    isSuperuser: false,
    role: record.role || userInInternal?.role || 'user'
  };

  const token = generateToken(authPayload);
  const formatted = formatRecordOutput(col.fields, record, authPayload, true);

  return res.json({
    token,
    record: formatted
  });
});

// 4. Verify MFA / OTP code to complete login
collectionsRouter.post(['/:collection/auth-with-mfa', '/:collection/auth-with-otp'], (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: 'Collection not found' });

  const { mfaId, otp, email } = req.body;
  if (!otp) {
    return res.status(400).json({ error: 'Verification code (otp) is required' });
  }

  const cleanOtp = String(otp).trim();
  const now = new Date().toISOString();

  let authRow: any = null;
  if (mfaId) {
    authRow = db.prepare("SELECT * FROM _auth_tokens WHERE id = ? AND token = ? AND expires_at > ?").get(mfaId, cleanOtp, now) as any;
  }
  if (!authRow && email) {
    authRow = db.prepare("SELECT * FROM _auth_tokens WHERE email = ? AND token = ? AND expires_at > ?").get(email.trim().toLowerCase(), cleanOtp, now) as any;
  }

  if (!authRow) {
    return res.status(400).json({ error: 'Invalid or expired verification code' });
  }

  const record = db.prepare(`SELECT * FROM "${col.name}" WHERE id = ?`).get(authRow.user_id) as any;
  if (!record) {
    return res.status(404).json({ error: 'User record not found' });
  }

  db.prepare("DELETE FROM _auth_tokens WHERE id = ?").run(authRow.id);

  const authPayload: AuthPayload = {
    id: record.id,
    email: record.email || authRow.email || '',
    username: record.username || record.name || record.email?.split('@')[0] || record.id,
    isSuperuser: false,
    role: record.role || 'user'
  };

  const token = generateToken(authPayload);
  const formatted = formatRecordOutput(col.fields, record, authPayload, true);

  return res.json({
    token,
    record: formatted
  });
});

// 5. Request / Resend MFA OTP Code
collectionsRouter.post('/:collection/request-mfa-otp', async (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: 'Collection not found' });

  const { email, mfaId } = req.body;
  if (!email && !mfaId) {
    return res.status(400).json({ error: 'Email or mfaId is required' });
  }

  let userRecord: any = null;
  if (email) {
    userRecord = db.prepare(`SELECT * FROM "${col.name}" WHERE email = ?`).get(email.trim().toLowerCase()) as any;
  } else if (mfaId) {
    const existingToken = db.prepare("SELECT * FROM _auth_tokens WHERE id = ?").get(mfaId) as any;
    if (existingToken) {
      userRecord = db.prepare(`SELECT * FROM "${col.name}" WHERE id = ?`).get(existingToken.user_id) as any;
    }
  }

  if (!userRecord) {
    return res.status(404).json({ error: 'User not found' });
  }

  const cleanEmail = userRecord.email;
  const newMfaId = crypto.randomUUID();
  const otpCode = String(crypto.randomInt(100000, 999999));
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO _auth_tokens (id, user_id, email, type, token, expires_at, created_at)
    VALUES (?, ?, ?, 'mfa', ?, ?, ?)
  `).run(newMfaId, userRecord.id, cleanEmail, otpCode, expiresAt, now);

  try {
    const settings = getAllSettings();
    if (settings.email.enabled) {
      const { subject, body } = renderEmailTemplate(settings.email.templates.otp || { subject: 'Verification Code', body: 'Your code is {OTP}' }, {
        OTP: otpCode,
        OTP_CODE: otpCode,
        USER_EMAIL: cleanEmail
      });
      await sendEmail({ to: cleanEmail, subject, html: body });
    }
  } catch {}

  return res.json({
    mfaId: newMfaId,
    message: 'Verification code sent to your email.'
  });
});

// 6. Refresh auth token
collectionsRouter.post('/:collection/auth-refresh', requireAuth, (req: Request, res: Response) => {
  const collectionName = getParam(req.params.collection);
  const col = getCollection(collectionName);
  if (!col) return res.status(404).json({ error: 'Collection not found' });

  const auth = (req as any).auth as AuthPayload;
  const record = db.prepare(`SELECT * FROM "${col.name}" WHERE id = ?`).get(auth.id) as any;
  if (!record) return res.status(404).json({ error: 'Record not found' });

  const token = generateToken(auth);
  const formatted = formatRecordOutput(col.fields, record, auth, true);

  return res.json({
    token,
    record: formatted
  });
});
