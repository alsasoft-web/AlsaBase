# AlsaBase REST API & Backend Endpoints Documentation

Complete API endpoint reference for **AlsaBase** — the lightweight, batteries-included SQLite backend engine with instant REST APIs, authentication, realtime events, serverless hooks, and static site hosting.

**Base URL**: `http://127.0.0.1:8090/api`

---

## 📑 Table of Contents

1. [System & Server Health](#1-system--server-health)
2. [Authentication Endpoints](#2-authentication-endpoints)
3. [Collections & Schema Management](#3-collections--schema-management)
4. [Record CRUD Operations](#4-record-crud-operations)
5. [Query Filtering, Sorting & Expansion](#5-query-filtering-sorting--expansion)
6. [File Assets & Media Storage](#6-file-assets--media-storage)
7. [Realtime Events (WebSocket & SSE)](#7-realtime-events-websocket--sse)
8. [Serverless Hooks & Crons](#8-serverless-hooks--crons)
9. [Server Logs & Telemetry](#9-server-logs--telemetry)
10. [Settings & Backups](#10-settings--backups)
11. [Client SDK Quickstart](#11-client-sdk-quickstart)

---

## 1. System & Server Health

### `GET /api/health`

Returns the status, version, and initialization state of the AlsaBase server.

- **Auth Required**: None
- **Response**: `200 OK`

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-09-23T21:25:00.000Z",
  "hasSuperuser": true
}
```

---

## 2. Authentication Endpoints

### 👤 User / Record Authentication (`/api/collections/:collection/...`)

#### `POST /api/collections/:collection/auth-with-password`

Authenticates a user record using identity (email or username) and password.

- **Auth Required**: None
- **Body**:
  ```json
  {
    "identity": "john@example.com",
    "password": "mySecurePassword123"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "token": "eyJhbGciOi...",
    "record": {
      "id": "rec_usr123",
      "email": "john@example.com",
      "username": "john",
      "name": "John Doe",
      "verified": true,
      "created": "2026-09-23 12:00:00.000Z",
      "updated": "2026-09-23 12:00:00.000Z"
    }
  }
  ```

#### `POST /api/collections/:collection/auth-with-oauth2`

Authenticates with an OAuth2 provider (Google, GitHub, Microsoft, Discord, OIDC).

- **Body**:
  ```json
  {
    "provider": "google",
    "token": "ya29.GOOGLE_ACCESS_TOKEN"
  }
  ```

#### `POST /api/collections/:collection/request-otp`

Sends a one-time verification code to the specified user email.

- **Body**: `{ "email": "john@example.com" }`

#### `POST /api/collections/:collection/auth-with-otp`

Verifies OTP and generates an authenticated session token.

- **Body**: `{ "otp": "123456", "email": "john@example.com" }`

#### `POST /api/collections/:collection/auth-refresh`

Refreshes an active session token and returns the current user profile.

- **Headers**: `Authorization: Bearer <TOKEN>`

#### `POST /api/collections/:collection/request-password-reset`

- **Body**: `{ "email": "john@example.com" }`

#### `POST /api/collections/:collection/confirm-password-reset`

- **Body**: `{ "token": "<RESET_TOKEN>", "password": "<NEW_PASSWORD>" }`

#### `POST /api/collections/:collection/request-verification`

- **Body**: `{ "email": "john@example.com" }`

#### `POST /api/collections/:collection/confirm-verification`

- **Body**: `{ "token": "<VERIFY_TOKEN>" }`

---

### Superuser / Admin Authentication & Management (`/api/auth/superusers/...`)

#### `POST /api/auth/superusers/login` (Alias: `/api/admins/auth-with-password`)

- **Body**: `{ "email": "admin@alsabase.local", "password": "superpassword" }`
- **Response**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "admin_1",
      "email": "admin@alsabase.local",
      "role": "admin"
    }
  }
  ```

#### `GET /api/auth/superusers/has-initial`

Checks if at least one superuser account exists.

#### `POST /api/auth/superusers/setup`

Creates the initial superuser account (only available when no superusers exist).

#### `GET /api/auth/superusers/me`

Returns current authenticated administrator profile.

- **Headers**: `Authorization: Bearer <SUPERUSER_TOKEN>`

#### `GET /api/auth/superusers`

Returns a list of all administrator accounts.

- **Headers**: `Authorization: Bearer <SUPERUSER_TOKEN>`
- **Response**:
  ```json
  {
    "items": [
      {
        "id": "admin_1",
        "email": "admin@alsabase.local",
        "created": "2026-09-24T10:00:00.000Z",
        "updated": "2026-09-24T10:00:00.000Z"
      }
    ],
    "total": 1
  }
  ```

#### `POST /api/auth/superusers`

Creates a new administrator account.

- **Headers**: `Authorization: Bearer <SUPERUSER_TOKEN>`
- **Body**:
  ```json
  {
    "email": "secondary_admin@alsabase.local",
    "password": "strongPassword123"
  }
  ```

#### `PATCH /api/auth/superusers/:id`

Updates an existing administrator account's email or password.

- **Headers**: `Authorization: Bearer <SUPERUSER_TOKEN>`
- **Body**:
  ```json
  {
    "email": "new_email@alsabase.local",
    "password": "updatedPassword123"
  }
  ```

#### `DELETE /api/auth/superusers/:id`

Deletes an administrator account. Prevents deletion if it is the only remaining superuser.

- **Headers**: `Authorization: Bearer <SUPERUSER_TOKEN>`

---

## 3. Collections & Schema Management

All schema management operations require **Superuser** authentication.

### `GET /api/collections`

Returns a list of all defined collections and tables.

- **Response**:
  ```json
  {
    "items": [
      {
        "id": "col_1",
        "name": "posts",
        "type": "base",
        "fields": [
          { "name": "title", "type": "text", "required": true },
          { "name": "views", "type": "number" }
        ],
        "rules": { "list": "", "view": "", "create": "@request.auth.id != ''" }
      }
    ],
    "total": 1
  }
  ```

### `GET /api/collections/:name` (or `GET /api/collections/:name/schema`)

Fetches the current schema and column definition of a specific table.

- **Example**: `GET /api/collections/posts` or `GET /api/collections/posts/schema`
- **Response**: `200 OK`
  ```json
  {
    "id": "col_1",
    "name": "posts",
    "type": "base",
    "fields": [
      { "name": "title", "type": "text", "required": true },
      { "name": "slug", "type": "text", "unique": true },
      { "name": "published", "type": "bool", "defaultValue": true },
      { "name": "cover", "type": "file" }
    ],
    "rules": {
      "list": "",
      "view": "",
      "create": "@request.auth.id != ''",
      "update": "@request.auth.id != ''",
      "delete": null
    },
    "indexes": [
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_slug ON posts (slug)"
    ]
  }
  ```

### `POST /api/collections`

Creates a new collection schema and underlying SQLite table.

- **Body**:
  ```json
  {
    "name": "articles",
    "type": "base",
    "fields": [
      { "name": "title", "type": "text", "required": true },
      { "name": "slug", "type": "text", "required": true, "unique": true },
      { "name": "content", "type": "text" },
      { "name": "likes", "type": "number", "defaultValue": 0 }
    ],
    "rules": {
      "list": "",
      "view": ""
    }
  }
  ```

### `PATCH /api/collections/:name`

Updates fields, rules, or settings for an existing collection.

### `DELETE /api/collections/:name`

Drops a collection and deletes its associated database table.

### `DELETE /api/collections/:name/truncate`

Truncates all record data in a table while keeping the schema intact.

### `GET /api/collections/:name/indexes`

Fetches all active SQLite indexes on the table, including auto-primary-key indexes, unique constraints, and custom indexes.

- **Response**: `200 OK`
  ```json
  {
    "items": [
      {
        "name": "sqlite_autoindex_posts_1",
        "tableName": "posts",
        "unique": true,
        "columns": ["id"],
        "primaryKey": true
      },
      {
        "name": "idx_posts_slug",
        "tableName": "posts",
        "unique": true,
        "columns": ["slug"],
        "sql": "CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)"
      }
    ],
    "total": 2
  }
  ```

### `POST /api/collections/:name/indexes`

Creates a new index on the specified table (with column builder or raw SQL).

- **Body (Builder Mode)**:
  ```json
  {
    "name": "idx_posts_created_at",
    "columns": ["created_at"],
    "unique": false
  }
  ```
- **Body (Raw SQL Mode)**:
  ```json
  {
    "rawSql": "CREATE INDEX idx_posts_tag ON posts (tags);"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "name": "idx_posts_created_at",
    "sql": "CREATE INDEX IF NOT EXISTS \"idx_posts_created_at\" ON \"posts\" (\"created_at\");"
  }
  ```

### `DELETE /api/collections/:name/indexes/:indexName`

Drops an index from the table.

- **Response**: `200 OK`
  ```json
  {
    "success": true
  }
  ```

---

## 4. Record CRUD Operations

### `GET /api/collections/:collection/records`

Lists and paginates records in a collection.

- **Query Parameters**:
  - `page` _(number, default: 1)_: Page number.
  - `limit` / `perPage` _(number, default: 20)_: Number of items per page.
  - `filter` _(string)_: AlsaBase filter expression.
  - `sort` _(string)_: Sort fields (`-created`, `title`, `-views`).
  - `expand` _(string)_: Comma-separated list of relation fields to expand.
  - `search` _(string)_: Search across text columns.

- **Response**:
  ```json
  {
    "page": 1,
    "perPage": 20,
    "totalItems": 42,
    "totalPages": 3,
    "items": [
      {
        "id": "rec_001",
        "title": "Welcome to AlsaBase",
        "views": 120,
        "created": "2026-09-23 14:00:00.000Z",
        "updated": "2026-09-23 14:00:00.000Z"
      }
    ]
  }
  ```

### `GET /api/collections/:collection/records/:id`

Returns a single record by ID. Supports `?expand=relField`.

### `POST /api/collections/:collection/records`

Creates a new record. Supports `application/json` or `multipart/form-data` (with file uploads).

### `PATCH /api/collections/:collection/records/:id`

Updates fields on an existing record.

### `DELETE /api/collections/:collection/records/:id`

Deletes a single record by ID.

---

## 5. Query Filtering, Sorting & Expansion

### Filter Syntax

- `status = "published"` (Equality)
- `status != "archived"` (Inequality)
- `views >= 100 && price < 50` (Comparisons & AND)
- `title ~ "starter"` (Substring match / LIKE)
- `email !~ "spam"` (Does not contain)
- `category = "tech" || category = "design"` (OR conditions)

---

## 6. File Assets & Media Storage

### `GET /api/files/:collection/:recordId/:filename`

Downloads or streams an uploaded file for a specific record.

- **Optional Query**: `?thumb=100x100` (Generate image thumbnail)

### `GET /api/static-files/public/:path`

Serves assets stored in the `./_public` directory.

---

## 7. Realtime Events (Socket.IO, WebSocket & SSE)

### Socket.IO Realtime Engine: `/api/socket.io`
Primary high-performance bidirectional event transport for AlsaBase SDK and web clients.

- **Connection Path**: `/api/socket.io`
- **Supported Transports**: `websocket`, `polling`
- **Room Topics**:
  - `*`: Receives all collection changes and server events.
  - `<collectionName>`: e.g. `posts`, `messages`, `users`
  - `<collectionName>/<recordId>`: e.g. `posts/rec_123`
  - `logs`: Live server log streaming (superusers).

**Socket.IO Client Messages**:
- `socket.emit("subscribe", topicOrTopics)`: Join one or more room topics.
- `socket.emit("unsubscribe", topicOrTopics)`: Leave room topics.
- `socket.emit("publish", { topic, data, event })`: Broadcast custom web events to a topic room.

### Server-Sent Events (SSE): `GET /api/realtime`
Unidirectional HTTP stream fallback for browser/mobile clients.

### Native WebSocket: `ws://localhost:8090/api/realtime/ws`
Direct native WebSocket interface for environments where raw WebSocket transport is preferred.

**Event Payload**:

```json
{
  "action": "create",
  "collection": "messages",
  "record": {
    "id": "msg_123",
    "text": "Hello realtime!",
    "created": "2026-09-23 15:00:00.000Z"
  },
  "timestamp": "2026-09-23T15:00:00.000Z"
}
```

---

## 8. Serverless Hooks & Crons

> For complete scripting guide, globals reference, request context (`c`), cron patterns, and examples, see [ALSABASE_HOOKS_DOCS.md](file:///d:/Work/Websites/AlsaBase/docs/ALSABASE_HOOKS_DOCS.md).

### `GET /api/hooks` (Superuser Only)
Returns overview of registered dynamic routes, crons, commands, and hook files from `./_hooks`.

### `POST /api/hooks/reload` (Superuser Only)
Hot-reloads JavaScript hooks from `./_hooks` without server restart.

### `POST /api/hooks/cron/:name/trigger` (Superuser Only)
Manually triggers a scheduled cron job (Standard JSON response).

### `POST /api/hooks/cron/stream` or `POST /api/hooks/cron/:name/stream` (Superuser Only)
Executes a registered cron job with real-time SSE log streaming (`started`, `log`, `done`, `error` events).

### `POST /api/hooks/cron/cancel` (Superuser Only)
Cancels an active running cron job.

### `POST /api/hooks/commands/stream` (Superuser Only)
Executes a standalone CLI script or hook command with real-time SSE log streaming.

### `POST /api/hooks/commands/cancel` (Superuser Only)
Cancels a running CLI script or hook command process.

---

## 9. Server Logs & Telemetry (Superuser Only)

- `GET /api/logs`: Paginated request and error logs (`?level=ERROR`, `?search=...`).
- `GET /api/logs/stats`: Total counts, error rates, average latency.
- `GET /api/logs/timeline`: Hourly traffic volume for the past 7 days.
- `DELETE /api/logs`: Clears all stored server telemetry logs.

---

## 10. Settings & Backups (Superuser Only)

- `GET /api/settings` & `PATCH /api/settings`: Read/write SMTP, backup, and security configurations.
- `GET /api/settings/system-stats`: Returns live host VPS and Node.js process resource metrics (total/used RAM, CPU cores and load averages, disk capacity and usage, active database size, directory sizes, process uptime, and platform architecture).
- `GET /api/backups`: Lists existing ZIP backup archives.
- `POST /api/backups`: Generates an instant full system backup archive (database + uploads).
- `GET /api/backups/:filename/download`: Downloads backup archive.
- `POST /api/backups/:filename/restore`: Restores system from backup archive.
- `POST /api/backups/import-sqlite`: Imports a raw SQLite database file (`.sqlite`/`.db`), replaces the active database, automatically synchronizes/introspects all tables into collections, and hot-reloads the connection cleanly in-process.

---

## 11. Client SDK Quickstart

Connect directly via the official `alsabase` package:

```typescript
import AlsaBase from "alsabase";

const ab = new AlsaBase("http://127.0.0.1:8090");

// 1. Authenticate
await ab.collection("users").authWithPassword("john@example.com", "secret");

// 2. Query table schema
const schema = await ab.collection("products").getSchema();
console.log("Schema:", schema.fields);

// 3. Create record
const record = await ab.collection("products").create({
  title: "New Item",
  price: 29.99,
});
```
