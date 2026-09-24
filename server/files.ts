import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { FieldDef, getCollection } from './schema';
import { AuthPayload } from './auth';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
export const FILES_DIR = path.join(DATA_DIR, 'files');

if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// MIME type map for standard file serving and extension mapping
export const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip'
};

function checkPermission(rule: string | undefined | null, auth?: AuthPayload): boolean {
  if (auth && auth.isSuperuser) return true;
  if (!rule || rule === 'public' || rule === '') return true;
  if (rule === 'admin') return !!(auth && auth.isSuperuser);
  if (rule === 'auth' || typeof rule === 'string') return !!auth;
  return false;
}

/**
 * Save an uploaded file / image object directly into data/files/<collection>/<recordId>/<filename>
 * and validate against allowed MIME types and max size limits.
 */
export function saveRecordFile(
  collectionName: string,
  recordId: string,
  filePayload: any,
  fieldDef?: FieldDef
): string | null {
  if (!filePayload) return null;

  // If already a simple filename string (e.g. "avatar_123.png"), return as is
  if (typeof filePayload === 'string') {
    if (!filePayload.startsWith('data:') && !filePayload.startsWith('{')) {
      return filePayload;
    }
    // If JSON string, try to parse
    if (filePayload.startsWith('{')) {
      try {
        filePayload = JSON.parse(filePayload);
      } catch {
        return filePayload;
      }
    }
  }

  // If object with base64 data: { name, data, size, type }
  if (typeof filePayload === 'object' && filePayload.data) {
    const rawData = String(filePayload.data);
    let base64Content = rawData;
    let ext = '';
    let detectedMime = filePayload.type || '';

    if (rawData.includes(';base64,')) {
      const parts = rawData.split(';base64,');
      base64Content = parts[1];
      const mimeMatch = parts[0].match(/data:([^;]+)/);
      if (mimeMatch && mimeMatch[1]) {
        detectedMime = mimeMatch[1];
        for (const [e, m] of Object.entries(MIME_TYPES)) {
          if (m === detectedMime) {
            ext = e;
            break;
          }
        }
      }
    }

    const origName = filePayload.name || 'file';
    if (!ext) {
      ext = path.extname(origName) || '.png';
    }

    // MIME type validation from column field settings
    if (fieldDef?.mimeTypes && fieldDef.mimeTypes.length > 0) {
      const allowed = fieldDef.mimeTypes.map((m) => m.toLowerCase().trim());
      const isAllowed = allowed.some((pattern) => {
        if (pattern === detectedMime.toLowerCase()) return true;
        if (pattern.startsWith('.') && ext.toLowerCase() === pattern) return true;
        if (pattern.endsWith('/*')) {
          const prefix = pattern.slice(0, -1);
          return detectedMime.toLowerCase().startsWith(prefix);
        }
        return false;
      });

      if (!isAllowed) {
        throw new Error(
          `File type "${detectedMime || ext}" is not allowed for field "${fieldDef.name}". Allowed types: ${fieldDef.mimeTypes.join(', ')}`
        );
      }
    }

    const buffer = Buffer.from(base64Content, 'base64');

    // Max size validation from column field settings
    if (fieldDef?.maxSize && fieldDef.maxSize > 0) {
      if (buffer.length > fieldDef.maxSize) {
        const maxMb = (fieldDef.maxSize / (1024 * 1024)).toFixed(1);
        throw new Error(
          `File size (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${maxMb}MB for field "${fieldDef.name}"`
        );
      }
    }

    const baseName =
      path.parse(origName).name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30) ||
      'file';
    const uniqueSuffix = crypto.randomBytes(6).toString('hex');
    const filename = `${baseName}_${uniqueSuffix}${ext}`;

    const recordDir = path.join(FILES_DIR, collectionName, recordId);
    if (!fs.existsSync(recordDir)) {
      fs.mkdirSync(recordDir, { recursive: true });
    }

    const filePath = path.join(recordDir, filename);
    fs.writeFileSync(filePath, buffer);

    return filename;
  }

  return typeof filePayload === 'string' ? filePayload : null;
}

/**
 * Delete all files for a record when the record is deleted
 */
export function deleteRecordFiles(collectionName: string, recordId: string) {
  try {
    const recordDir = path.join(FILES_DIR, collectionName, recordId);
    if (fs.existsSync(recordDir)) {
      fs.rmSync(recordDir, { recursive: true, force: true });
    }
  } catch (err: any) {
    console.warn(
      `[Storage] Failed to delete files for ${collectionName}/${recordId}:`,
      err.message
    );
  }
}

/**
 * Safely move a file or directory across filesystems / mount points / devices.
 * Tries fast fs.renameSync first; falls back to copy+remove on EXDEV / permission cross-device errors.
 */
export function safeMoveSync(srcPath: string, dstPath: string): void {
  try {
    fs.renameSync(srcPath, dstPath);
  } catch (err: any) {
    if (
      err &&
      (err.code === 'EXDEV' ||
        err.code === 'EPERM' ||
        err.code === 'EBUSY' ||
        err.code === 'EACCES' ||
        err.message?.includes('cross-device'))
    ) {
      const stats = fs.statSync(srcPath);
      if (stats.isDirectory()) {
        fs.cpSync(srcPath, dstPath, { recursive: true });
        fs.rmSync(srcPath, { recursive: true, force: true });
      } else {
        fs.copyFileSync(srcPath, dstPath);
        fs.unlinkSync(srcPath);
      }
    } else {
      throw err;
    }
  }
}

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export const filesRouter = Router();

// GET /api/files/:collection/:recordId/:filename
filesRouter.get(
  '/:collection/:recordId/:filename',
  (req: Request, res: Response) => {
    const collection = getParam(req.params.collection);
    const recordId = getParam(req.params.recordId);
    const filename = getParam(req.params.filename);
    const filePath = path.join(FILES_DIR, collection, recordId, filename);

    // Prevent directory traversal attacks
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(FILES_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check protected field permission if enabled
    const col = getCollection(collection);
    if (col) {
      const protectedField = col.fields.find(
        (f) => (f.type === 'file' || f.name === 'avatar') && f.protected
      );
      if (protectedField) {
        const auth = (req as any).auth as AuthPayload | undefined;
        if (!checkPermission(col.rules.view, auth)) {
          return res.status(403).json({
            error: 'Access denied: protected file requires view permissions'
          });
        }
      }
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (req.query.download === '1' || req.query.download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    res.sendFile(resolved);
  }
);

// Backward-compatible single-param route /api/files/:filename
filesRouter.get('/:filename', (req: Request, res: Response) => {
  const filename = getParam(req.params.filename);

  function findFile(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === filename) return full;
      if (entry.isDirectory()) {
        const found = findFile(full);
        if (found) return found;
      }
    }
    return null;
  }

  try {
    const found = findFile(FILES_DIR);
    if (found && fs.existsSync(found)) {
      const ext = path.extname(found).toLowerCase();
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      return res.sendFile(found);
    }
  } catch {}

  res.status(404).json({ error: 'File not found' });
});
