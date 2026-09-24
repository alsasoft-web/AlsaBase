import crypto from 'node:crypto';
import { db } from './db';

export type FieldType =
  | 'text'
  | 'number'
  | 'bool'
  | 'json'
  | 'date'
  | 'autodate'
  | 'file'
  | 'email'
  | 'url'
  | 'select'
  | 'relation';

export interface FieldDef {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
  presentable?: boolean;
  hidden?: boolean;
  helpText?: string;
  defaultValue?: any;
  min?: number;
  max?: number;
  noDecimal?: boolean;
  pattern?: string;
  autogeneratePattern?: string;
  maxSize?: number;
  maxSelect?: number;
  mimeTypes?: string[];
  thumbs?: string[];
  protected?: boolean;
  values?: string[];
  relationCollection?: string;
  onCreate?: boolean;
  onUpdate?: boolean;
}

export interface TableIndexInfo {
  name: string;
  tableName: string;
  unique: boolean;
  columns: string[];
  sql?: string;
  primaryKey?: boolean;
}

export interface CollectionRule {
  list?: 'public' | 'auth' | 'admin' | string;
  view?: 'public' | 'auth' | 'admin' | string;
  create?: 'public' | 'auth' | 'admin' | string;
  update?: 'public' | 'auth' | 'admin' | string;
  delete?: 'public' | 'auth' | 'admin' | string;
  authWithPassword?: string;
  authRule?: string;
  manageRule?: string;
}

export interface CollectionDef {
  id: string;
  name: string;
  type?: 'base' | 'auth' | 'view';
  fields: FieldDef[];
  rules: CollectionRule;
  indexes?: string[];
  options?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

function fieldToSqlType(field: FieldDef): string {
  let sqlType = 'TEXT';
  if (field.type === 'number') {
    sqlType = field.noDecimal ? 'INTEGER' : 'NUMERIC';
  } else if (field.type === 'bool') {
    sqlType = 'INTEGER';
  }

  let constraints = '';
  if (field.required) constraints += ' NOT NULL';
  if (field.unique) constraints += ' UNIQUE';
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    if (typeof field.defaultValue === 'string') {
      constraints += ` DEFAULT '${field.defaultValue.replace(/'/g, "''")}'`;
    } else {
      constraints += ` DEFAULT ${field.defaultValue}`;
    }
  }
  return `${sqlType}${constraints}`;
}

export function sanitizeIdentifier(name: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}. Must contain only alphanumeric characters and underscores.`);
  }
  return name;
}

export function listCollections(): CollectionDef[] {
  const rows = db.prepare('SELECT * FROM _collections ORDER BY created_at ASC').all() as any[];
  return rows.map((r) => {
    const rulesObj = JSON.parse(r.rules_json || '{}');
    const isAuth = r.name === 'users' || r.name === '_superusers' || rulesObj.type === 'auth';
    const fields = (JSON.parse(r.schema_json || '[]') as FieldDef[]).filter(
      (f) => f.name !== 'tokenKey'
    );
    const indexes = (rulesObj.indexes || [
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_${r.name}_email ON ${r.name} (email)`
    ]).filter((idxStr: string) => !idxStr.includes('tokenKey'));

    return {
      id: r.id,
      name: r.name,
      type: (isAuth ? 'auth' : 'base') as 'auth' | 'base',
      fields,
      rules: rulesObj.rules || rulesObj,
      indexes,
      options: rulesObj.options || {
        allowEmailAuth: true,
        allowOAuth2Auth: false,
        allowUsernameAuth: true,
        sendEmailAlert: true
      },
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  });
}

export function getCollection(nameOrId: string): CollectionDef | null {
  const row = db.prepare('SELECT * FROM _collections WHERE id = ? OR name = ?').get(nameOrId, nameOrId) as any;
  if (!row) return null;
  const rulesObj = JSON.parse(row.rules_json || '{}');
  const isAuth = row.name === 'users' || row.name === '_superusers' || rulesObj.type === 'auth';
  const fields = (JSON.parse(row.schema_json || '[]') as FieldDef[]).filter(
    (f) => f.name !== 'tokenKey'
  );
  const indexes = (rulesObj.indexes || []).filter(
    (idxStr: string) => !idxStr.includes('tokenKey')
  );

  return {
    id: row.id,
    name: row.name,
    type: (isAuth ? 'auth' : 'base') as 'auth' | 'base',
    fields,
    rules: rulesObj.rules || rulesObj,
    indexes,
    options: rulesObj.options || {},
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function getTableIndexes(tableName: string): TableIndexInfo[] {
  const safeName = sanitizeIdentifier(tableName);
  try {
    const list = db.prepare(`PRAGMA index_list("${safeName}")`).all() as Array<{
      seq: number;
      name: string;
      unique: number;
      origin: string;
      partial: number;
    }>;

    return list.map((item) => {
      const infoRows = db.prepare(`PRAGMA index_info("${item.name}")`).all() as Array<{
        seqno: number;
        cid: number;
        name: string;
      }>;
      const columns = infoRows.map((r) => r.name).filter(Boolean);
      const masterRow = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?`).get(item.name) as { sql: string } | undefined;

      return {
        name: item.name,
        tableName: safeName,
        unique: Boolean(item.unique),
        columns,
        sql: masterRow?.sql || undefined,
        primaryKey: item.origin === 'pk' || item.name.startsWith('sqlite_autoindex_')
      };
    });
  } catch (err) {
    console.error(`[Schema] Error fetching indexes for table ${tableName}:`, err);
    return [];
  }
}

export function normalizeCreateIndexSql(sql: string): string {
  let s = sql.trim();
  // Ensure IF NOT EXISTS is inserted if not present
  if (/^CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(s)) {
    s = s.replace(/^CREATE\s+UNIQUE\s+INDEX\s+/i, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
  } else if (/^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(s)) {
    s = s.replace(/^CREATE\s+INDEX\s+/i, 'CREATE INDEX IF NOT EXISTS ');
  }
  return s;
}

export function createTableIndex(
  tableName: string,
  indexDef: { name?: string; columns?: string[]; unique?: boolean; rawSql?: string }
): { name: string; sql: string } {
  const safeTable = sanitizeIdentifier(tableName);
  let sql = '';
  let finalIndexName = '';

  if (indexDef.rawSql && indexDef.rawSql.trim()) {
    sql = normalizeCreateIndexSql(indexDef.rawSql.trim());
    if (!sql.endsWith(';')) sql += ';';
    const match = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?/i);
    finalIndexName = match ? match[1] : `idx_${safeTable}_custom_${Date.now()}`;
  } else {
    if (!indexDef.columns || indexDef.columns.length === 0) {
      throw new Error('At least one column is required to create an index.');
    }
    const cols = indexDef.columns.map((c) => `"${sanitizeIdentifier(c)}"`).join(', ');
    const colsClean = indexDef.columns.map((c) => sanitizeIdentifier(c)).join('_');
    finalIndexName = indexDef.name ? sanitizeIdentifier(indexDef.name) : `idx_${safeTable}_${colsClean}`;
    const uniqueClause = indexDef.unique ? 'UNIQUE ' : '';
    sql = `CREATE ${uniqueClause}INDEX IF NOT EXISTS "${finalIndexName}" ON "${safeTable}" (${cols});`;
  }

  try {
    db.exec(sql);
  } catch (err: any) {
    if (!err?.message?.includes('already exists')) {
      throw err;
    }
  }

  // Update collection rules_json indexes if it's a collection
  const collection = getCollection(safeTable);
  if (collection) {
    const existingIndexes = collection.indexes || [];
    if (!existingIndexes.includes(sql)) {
      updateCollection(collection.id, {
        indexes: [...existingIndexes, sql]
      });
    }
  }

  return { name: finalIndexName, sql };
}

export function dropTableIndex(tableName: string, indexName: string): boolean {
  const safeTable = sanitizeIdentifier(tableName);
  const safeIndex = sanitizeIdentifier(indexName);

  db.exec(`DROP INDEX IF EXISTS "${safeIndex}";`);

  // Update collection rules_json indexes if present
  const collection = getCollection(safeTable);
  if (collection && collection.indexes) {
    const newIndexes = collection.indexes.filter((idxStr) => {
      return !idxStr.includes(`"${safeIndex}"`) && !idxStr.includes(` ${safeIndex} `) && !idxStr.includes(` ${safeIndex}(`) && !idxStr.includes(` ${safeIndex}\n`);
    });
    if (newIndexes.length !== collection.indexes.length) {
      updateCollection(collection.id, {
        indexes: newIndexes
      });
    }
  }

  return true;
}

export function createCollection(payload: {
  name: string;
  type?: 'base' | 'auth' | 'view';
  fields?: FieldDef[];
  rules?: CollectionRule;
  indexes?: string[];
  options?: Record<string, any>;
}): CollectionDef {
  const name = sanitizeIdentifier(payload.name.trim().toLowerCase());
  if (name.startsWith('_')) {
    throw new Error('Collection names starting with underscore are reserved for system tables.');
  }

  const existing = db.prepare('SELECT id FROM _collections WHERE name = ?').get(name);
  if (existing) {
    throw new Error(`Collection with name "${name}" already exists.`);
  }

  const fields = (payload.fields || []).filter((f) => f.name !== 'tokenKey');
  const rules = payload.rules || { list: 'public', view: 'public', create: 'auth', update: 'auth', delete: 'admin' };
  const type = payload.type || (name === 'users' ? 'auth' : 'base');
  const indexes = (payload.indexes || []).filter((idx) => !idx.includes('tokenKey'));
  const options = payload.options || {};
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Construct SQL CREATE TABLE statement
  const fieldDefsSql = fields.map((f) => {
    const colName = sanitizeIdentifier(f.name.trim().toLowerCase());
    return `"${colName}" ${fieldToSqlType(f)}`;
  });

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS "${name}" (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL${fieldDefsSql.length > 0 ? ', ' + fieldDefsSql.join(', ') : ''}
    );
  `;

  db.exec(createTableSql);

  // Ensure unique indexes for fields marked unique or indexed
  for (const field of fields) {
    const colName = sanitizeIdentifier(field.name.trim().toLowerCase());
    if (field.unique) {
      try {
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${name}_${colName}" ON "${name}" ("${colName}");`);
      } catch (err) {
        console.warn(`[Schema] Warning creating unique index for ${name}.${colName}:`, err);
      }
    } else if (field.indexed) {
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS "idx_${name}_${colName}" ON "${name}" ("${colName}");`);
      } catch (err) {
        console.warn(`[Schema] Warning creating index for ${name}.${colName}:`, err);
      }
    }
  }

  // Execute custom indexes defined in payload.indexes
  for (const idxSql of indexes) {
    if (idxSql && idxSql.trim()) {
      try {
        const safeSql = normalizeCreateIndexSql(idxSql);
        db.exec(safeSql);
      } catch (err: any) {
        if (!err?.message?.includes('already exists')) {
          console.warn(`[Schema] Warning executing custom index on ${name}:`, err?.message || err);
        }
      }
    }
  }

  const storedRules = {
    type,
    rules,
    indexes,
    options
  };

  db.prepare(`
    INSERT INTO _collections (id, name, schema_json, rules_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, JSON.stringify(fields), JSON.stringify(storedRules), now, now);

  return { id, name, type, fields, rules, indexes, options, created_at: now, updated_at: now };
}

// Automatically create default 'users' auth collection if not present and clean tokenKey
export function initDefaultCollections() {
  try {
    // Strip tokenKey from existing collections schema if present
    const existingRows = db.prepare('SELECT id, schema_json, rules_json FROM _collections').all() as any[];
    for (const r of existingRows) {
      if (r.schema_json && r.schema_json.includes('tokenKey')) {
        const rawFields = JSON.parse(r.schema_json || '[]');
        const cleanFields = rawFields.filter((f: any) => f.name !== 'tokenKey');
        db.prepare('UPDATE _collections SET schema_json = ? WHERE id = ?').run(
          JSON.stringify(cleanFields),
          r.id
        );
      }
    }

    const existing = db.prepare("SELECT id FROM _collections WHERE name = 'users'").get();
    if (!existing) {
      createCollection({
        name: 'users',
        type: 'auth',
        fields: [
          { name: 'password', type: 'text', required: true, hidden: true },
          { name: 'email', type: 'email', required: true, unique: true },
          { name: 'emailVisibility', type: 'bool' },
          { name: 'verified', type: 'bool' },
          { name: 'name', type: 'text' },
          {
            name: 'avatar',
            type: 'file',
            maxSelect: 1,
            maxSize: 5242880,
            mimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp']
          }
        ],
        rules: {
          list: 'id = @request.auth.id',
          view: 'id = @request.auth.id',
          create: '',
          update: 'id = @request.auth.id',
          delete: 'id = @request.auth.id'
        },
        indexes: [
          'CREATE UNIQUE INDEX idx_users_email ON users (email)'
        ],
        options: {
          allowEmailAuth: true,
          allowOAuth2Auth: false,
          allowUsernameAuth: true,
          sendEmailAlert: true
        }
      });
      console.log('[Schema] Initialized default "users" auth collection.');
    }

    const existingSuperusers = db.prepare("SELECT id FROM _collections WHERE name = '_superusers'").get();
    if (!existingSuperusers) {
      const colId = '_system_superusers';
      const now = new Date().toISOString();
      const schema: FieldDef[] = [
        { name: 'email', type: 'email', required: true, unique: true },
        { name: 'password', type: 'text', required: true, hidden: true }
      ];
      const rulesObj = {
        list: 'admin',
        view: 'admin',
        create: 'admin',
        update: 'admin',
        delete: 'admin',
        type: 'auth',
        options: {
          allowEmailAuth: true,
          allowOAuth2Auth: false,
          allowUsernameAuth: false,
          sendEmailAlert: false
        }
      };
      db.prepare(`
        INSERT OR IGNORE INTO _collections (id, name, type, schema_json, rules_json, created_at, updated_at)
        VALUES (?, ?, 'auth', ?, ?, ?, ?)
      `).run(colId, '_superusers', JSON.stringify(schema), JSON.stringify(rulesObj), now, now);
      console.log('[Schema] Initialized system "_superusers" auth collection.');
    }
  } catch (err: any) {
    console.error('[Schema] Error initializing default collections:', err?.message || err);
  }
}

export function updateCollection(
  idOrName: string,
  payload: {
    name?: string;
    type?: 'base' | 'auth' | 'view';
    fields?: FieldDef[];
    rules?: CollectionRule;
    indexes?: string[];
    options?: Record<string, any>;
  }
): CollectionDef {
  const current = getCollection(idOrName);
  if (!current) {
    throw new Error(`Collection not found.`);
  }

  const now = new Date().toISOString();
  let finalName = current.name;

  if (payload.name && payload.name !== current.name) {
    const newName = sanitizeIdentifier(payload.name.trim().toLowerCase());
    if (newName.startsWith('_')) {
      throw new Error('Collection names starting with underscore are reserved.');
    }
    db.exec(`ALTER TABLE "${current.name}" RENAME TO "${newName}";`);
    finalName = newName;
  }

  // Handle new fields to add via ALTER TABLE
  const currentFieldNames = new Set(current.fields.map((f) => f.name.toLowerCase()));
  const newFields = payload.fields || current.fields;

  for (const field of newFields) {
    const colName = sanitizeIdentifier(field.name.trim().toLowerCase());
    if (!currentFieldNames.has(colName) && colName !== 'id' && colName !== 'created_at' && colName !== 'updated_at') {
      try {
        const fieldWithoutUnique = { ...field, unique: false };
        db.exec(`ALTER TABLE "${finalName}" ADD COLUMN "${colName}" ${fieldToSqlType(fieldWithoutUnique)};`);
      } catch (err) {
        console.warn(`[Schema] Warning altering table ${finalName} for column ${colName}:`, err);
      }
    }

    // Sync unique / normal index for the field
    if (field.unique) {
      try {
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${finalName}_${colName}" ON "${finalName}" ("${colName}");`);
      } catch (err) {
        console.warn(`[Schema] Warning creating unique index for ${finalName}.${colName}:`, err);
      }
    } else if (field.indexed) {
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS "idx_${finalName}_${colName}" ON "${finalName}" ("${colName}");`);
      } catch (err) {
        console.warn(`[Schema] Warning creating index for ${finalName}.${colName}:`, err);
      }
    } else {
      if (current.fields.some((f) => f.name.toLowerCase() === colName && (f.unique || f.indexed))) {
        try {
          db.exec(`DROP INDEX IF EXISTS "idx_${finalName}_${colName}";`);
        } catch {}
      }
    }
  }

  // If new custom indexes provided, execute them
  if (payload.indexes) {
    for (const idxSql of payload.indexes) {
      if (idxSql && idxSql.trim()) {
        try {
          const safeSql = normalizeCreateIndexSql(idxSql);
          db.exec(safeSql);
        } catch (err: any) {
          if (!err?.message?.includes('already exists')) {
            console.warn(`[Schema] Warning executing custom index on ${finalName}:`, err?.message || err);
          }
        }
      }
    }
  }

  const finalType = payload.type || current.type || (finalName === 'users' ? 'auth' : 'base');
  const finalRules = payload.rules || current.rules;
  const finalIndexes = payload.indexes !== undefined ? payload.indexes : current.indexes || [];
  const finalOptions = payload.options !== undefined ? payload.options : current.options || {};

  const storedRules = {
    type: finalType,
    rules: finalRules,
    indexes: finalIndexes,
    options: finalOptions
  };

  db.prepare(`
    UPDATE _collections
    SET name = ?, schema_json = ?, rules_json = ?, updated_at = ?
    WHERE id = ?
  `).run(finalName, JSON.stringify(newFields), JSON.stringify(storedRules), now, current.id);

  return {
    id: current.id,
    name: finalName,
    type: finalType,
    fields: newFields,
    rules: finalRules,
    indexes: finalIndexes,
    options: finalOptions,
    created_at: current.created_at,
    updated_at: now
  };
}

export function deleteCollection(idOrName: string): boolean {
  const current = getCollection(idOrName);
  if (!current) return false;

  db.exec(`DROP TABLE IF EXISTS "${current.name}";`);
  db.prepare('DELETE FROM _collections WHERE id = ?').run(current.id);
  return true;
}
