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
11. [App Releases & Version Control](#11-app-releases--version-control)
12. [Client SDK Quickstart](#12-client-sdk-quickstart)

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
      { "name": "author", "type": "relation", "relationCollection": "users", "relationField": "id", "maxSelect": 1, "cascadeDelete": false },
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
  - `filter` _(string)_: AlsaBase filter expression (e.g. `id = "123"`, `title = "game"`, `price > 50`, `title ~ "hero" && status = "active"`).
    - Supported Operators: `=`, `!=`, `~` (contains/LIKE), `!~` (not contains), `>`, `<`, `>=`, `<=`
    - Supported Connectors: `&&` / `AND`, `||` / `OR`
  - `sort` _(string)_: Sort fields (e.g. `-created`, `+created`, `-created_at`, `title`, `-updated`).
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

## 11. App Releases & Version Control

AlsaBase includes an application release management and distribution system for desktop, mobile, and CLI applications. It supports version checking (semver), automated/mandatory vs optional update policies, release channels (e.g. stable, beta, alpha), platform filtering, and binary distribution.

### 🌐 Public & Client Endpoints

#### `GET /api/apps`
Lists active applications with basic statistics.

#### `GET /api/apps/:slug`
Gets metadata for a specific application by its slug or ID.

#### `GET /api/apps/:slug/check-update`
Checks if a newer release is available for an app. If `deviceId` is provided and the device is locked, returns HTTP 403 Forbidden.

- **Query Parameters**:
  - `currentVersion` (string, required): Current installed version (e.g. `1.0.0`).
  - `platform` (string, optional): Target platform (`windows`, `macos`, `linux`, `android`, `ios`, `all`).
  - `channel` (string, optional): Release channel filter (`stable`, `beta`, `alpha`, `latest`).
  - `deviceId` (string, optional): Hardware / machine identifier. If this device is locked, returns HTTP 403 Forbidden.
- **Response**: `200 OK`
  ```json
  {
    "updateAvailable": true,
    "hasUpdate": true,
    "currentVersion": "1.0.0",
    "latestVersion": "1.2.0",
    "importance": "automatic",
    "isAutomatic": true,
    "isMandatory": true,
    "releaseNotes": "Critical security fixes and performance updates",
    "downloadUrl": "/api/apps/desktop-app/versions/1.2.0/download",
    "version": {
      "id": "rel_abc123",
      "version": "1.2.0",
      "buildNumber": 12,
      "importance": "automatic",
      "channel": "stable",
      "platform": "windows",
      "fileName": "Setup-1.2.0.exe",
      "fileSize": 25481920,
      "fileHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "downloadUrl": "/api/apps/desktop-app/versions/1.2.0/download",
      "fullDownloadUrl": "http://127.0.0.1:8090/api/apps/desktop-app/versions/1.2.0/download",
      "createdAt": "2026-10-29T00:00:00.000Z"
    }
  }
  ```

#### `GET /api/apps/:slug/devices/check`
Checks if a specific client computer / hardware device is permitted or locked from using the application.

- **Query Parameters**:
  - `deviceId` (string, required): Hardware identifier / MAC address / machine GUID.
- **Response**: `200 OK`
  ```json
  {
    "allowed": true,
    "isLocked": false,
    "lockReason": null,
    "device": {
      "deviceId": "PC-HWID-98234",
      "deviceName": "Workstation-1",
      "isLocked": false
    }
  }
  ```
  If locked:
  ```json
  {
    "allowed": false,
    "isLocked": true,
    "lockReason": "Subscription expired or violation of terms"
  }
  ```

#### `POST /api/apps/:slug/licenses/activate`
Activates a license serial key for a specific client PC / device.

- **Body**:
  ```json
  {
    "key": "ABCD-EFGH-IJKL-MNOP",
    "deviceId": "PC-HWID-98234",
    "deviceName": "Workstation-1",
    "osName": "Windows 11 Pro",
    "platform": "windows"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "activated": true,
    "message": "License activated successfully for this device",
    "license": {
      "id": "lic_123",
      "serialKey": "ABCD-EFGH-IJKL-MNOP",
      "status": "active",
      "maxActivations": 3,
      "activatedCount": 1
    },
    "device": {
      "deviceId": "PC-HWID-98234",
      "deviceName": "Workstation-1",
      "isLocked": false
    }
  }
  ```

#### `POST /api/apps/:slug/licenses/validate`
Validates an existing serial key or checks if a device holds an active valid activation.

- **Body**:
  ```json
  {
    "deviceId": "PC-HWID-98234",
    "key": "ABCD-EFGH-IJKL-MNOP"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "valid": true,
    "isLocked": false,
    "license": {
      "id": "lic_123",
      "serialKey": "ABCD-EFGH-IJKL-MNOP",
      "status": "active",
      "maxActivations": 3,
      "activatedCount": 1,
      "expiresAt": "2027-12-31T23:59:59.000Z",
      "customerName": "Acme Corp"
    },
    "device": {
      "deviceId": "PC-HWID-98234",
      "deviceName": "Workstation-1",
      "isLocked": false
    }
  }
  ```
- **Device-Only Validation**:
  If `key` is omitted, validates the computer device against the application device policy (`unrestricted`, `max_devices`, `whitelist_only`):
  ```json
  {
    "deviceId": "PC-HWID-98234"
  }
  ```

#### `POST /api/apps/:slug/licenses/deactivate`
Deactivates a serial key from a device, freeing up an activation slot so the license can be activated on another computer.

- **Body**:
  ```json
  {
    "key": "ABCD-EFGH-IJKL-MNOP",
    "deviceId": "PC-HWID-98234"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "License deactivated successfully for this device",
    "license": {
      "id": "lic_123",
      "serialKey": "ABCD-EFGH-IJKL-MNOP",
      "status": "active",
      "activatedCount": 0
    }
  }
  ```

---

### Client Application Integration by Programming Language

The AlsaBase Apps API is completely language-agnostic and accessible via standard HTTP REST endpoints. Below are production-ready client integration examples across multiple programming languages.

#### Recommended Application Startup Lifecycle

Every client application (Desktop, Mobile, or CLI) should follow this sequence on launch:

1. **Resolve Machine Identifier (HWID)**: Extract a stable, unique hardware fingerprint (e.g. Windows MachineGuid, macOS IOPlatformUUID, Linux machine-id).
2. **Gatekeeper Check (`GET /api/apps/:slug/devices/check`)**: Verify device is not locked or banned by an administrator.
3. **Update Check (`GET /api/apps/:slug/check-update`)**: Check for new releases. If mandatory (`isAutomatic: true`), prompt or force update before starting.
4. **License Validation (`POST /api/apps/:slug/licenses/validate`)**: If a stored serial key exists locally, validate it against AlsaBase. If no key exists or validation fails, prompt for serial key entry and call `POST /api/apps/:slug/licenses/activate`.

---

#### 1. C# (.NET 8+ / WPF / WinForms / MAUI)

```csharp
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace AlsaBaseClient
{
    public class LicenseActivationResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("activated")]
        public bool Activated { get; set; }

        [JsonPropertyName("message")]
        public string Message { get; set; }

        [JsonPropertyName("error")]
        public string Error { get; set; }
    }

    public class UpdateCheckResult
    {
        [JsonPropertyName("updateAvailable")]
        public bool UpdateAvailable { get; set; }

        [JsonPropertyName("latestVersion")]
        public string LatestVersion { get; set; }

        [JsonPropertyName("isAutomatic")]
        public bool IsAutomatic { get; set; }

        [JsonPropertyName("downloadUrl")]
        public string DownloadUrl { get; set; }

        [JsonPropertyName("releaseNotes")]
        public string ReleaseNotes { get; set; }
    }

    public class AlsaBaseAppClient
    {
        private readonly HttpClient _http;
        private readonly string _baseUrl;
        private readonly string _appSlug;

        public AlsaBaseAppClient(string baseUrl, string appSlug)
        {
            _baseUrl = baseUrl.TrimEnd('/');
            _appSlug = appSlug;
            _http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        }

        // 1. Get Hardware ID (HWID) on Windows via MachineGuid
        public static string GetWindowsHardwareId()
        {
            try
            {
                using var key = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64)
                                           .OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
                var guid = key?.GetValue("MachineGuid")?.ToString();
                if (!string.IsNullOrEmpty(guid)) return guid;
            }
            catch {}
            return Environment.MachineName;
        }

        // 2. Check if this device is locked / authorized
        public async Task<bool> CheckDeviceAllowedAsync(string deviceId)
        {
            var url = $"{_baseUrl}/api/apps/{_appSlug}/devices/check?deviceId={Uri.EscapeDataString(deviceId)}";
            var response = await _http.GetAsync(url);
            if (!response.IsSuccessStatusCode) return false;

            using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
            var root = doc.RootElement;
            return root.TryGetProperty("allowed", out var prop) && prop.GetBoolean();
        }

        // 3. Check for application update
        public async Task<UpdateCheckResult> CheckUpdateAsync(string currentVersion, string deviceId)
        {
            var url = $"{_baseUrl}/api/apps/{_appSlug}/check-update?currentVersion={currentVersion}&platform=windows&deviceId={Uri.EscapeDataString(deviceId)}";
            return await _http.GetFromJsonAsync<UpdateCheckResult>(url);
        }

        // 4. Activate a serial key on this device
        public async Task<LicenseActivationResult> ActivateLicenseAsync(string serialKey, string deviceId)
        {
            var payload = new
            {
                key = serialKey,
                deviceId = deviceId,
                deviceName = Environment.MachineName,
                osName = Environment.OSVersion.ToString(),
                platform = "windows"
            };

            var url = $"{_baseUrl}/api/apps/{_appSlug}/licenses/activate";
            var response = await _http.PostAsJsonAsync(url, payload);
            return await response.Content.ReadFromJsonAsync<LicenseActivationResult>();
        }

        // 5. Validate existing serial key on startup
        public async Task<bool> ValidateLicenseAsync(string serialKey, string deviceId)
        {
            var payload = new { key = serialKey, deviceId = deviceId };
            var url = $"{_baseUrl}/api/apps/{_appSlug}/licenses/validate";
            var response = await _http.PostAsJsonAsync(url, payload);
            if (!response.IsSuccessStatusCode) return false;

            using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
            return doc.RootElement.TryGetProperty("valid", out var validProp) && validProp.GetBoolean();
        }

        // 6. Deactivate serial key from this computer (transfers license slot)
        public async Task<bool> DeactivateLicenseAsync(string serialKey, string deviceId)
        {
            var payload = new { key = serialKey, deviceId = deviceId };
            var url = $"{_baseUrl}/api/apps/{_appSlug}/licenses/deactivate";
            var response = await _http.PostAsJsonAsync(url, payload);
            return response.IsSuccessStatusCode;
        }
    }
}
```

---

#### 2. JavaScript / TypeScript (Node.js / Electron / Tauri Frontend)

Using native `fetch`:

```typescript
export class AlsaBaseAppClient {
  constructor(
    private baseUrl: string,
    private appSlug: string
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  // 1. Check if device is banned or locked
  async checkDevice(deviceId: string): Promise<{ allowed: boolean; isLocked: boolean; lockReason?: string }> {
    const res = await fetch(
      `${this.baseUrl}/api/apps/${encodeURIComponent(this.appSlug)}/devices/check?deviceId=${encodeURIComponent(deviceId)}`
    );
    return res.json();
  }

  // 2. Check for application update
  async checkUpdate(currentVersion: string, deviceId?: string, platform = "windows") {
    const params = new URLSearchParams({ currentVersion, platform });
    if (deviceId) params.set("deviceId", deviceId);

    const res = await fetch(
      `${this.baseUrl}/api/apps/${encodeURIComponent(this.appSlug)}/check-update?${params.toString()}`
    );
    return res.json();
  }

  // 3. Activate a serial key
  async activateLicense(payload: {
    key: string;
    deviceId: string;
    deviceName?: string;
    osName?: string;
    platform?: string;
  }) {
    const res = await fetch(
      `${this.baseUrl}/api/apps/${encodeURIComponent(this.appSlug)}/licenses/activate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Activation failed");
    return data;
  }

  // 4. Validate license on application boot
  async validateLicense(key: string, deviceId: string) {
    const res = await fetch(
      `${this.baseUrl}/api/apps/${encodeURIComponent(this.appSlug)}/licenses/validate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, deviceId }),
      }
    );
    return res.json();
  }

  // 5. Deactivate license from current computer
  async deactivateLicense(key: string, deviceId: string) {
    const res = await fetch(
      `${this.baseUrl}/api/apps/${encodeURIComponent(this.appSlug)}/licenses/deactivate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, deviceId }),
      }
    );
    return res.json();
  }
}
```

---

#### 3. Rust (Tauri / CLI / Desktop)

Using `reqwest` and `serde`:

```rust
use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Serialize)]
struct ActivatePayload<'a> {
    key: &'a str,
    #[serde(rename = "deviceId")]
    device_id: &'a str,
    #[serde(rename = "deviceName")]
    device_name: &'a str,
    platform: &'a str,
}

#[derive(Deserialize, Debug)]
pub struct ValidateResponse {
    pub valid: bool,
    #[serde(rename = "isLocked")]
    pub is_locked: bool,
    pub error: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct UpdateResponse {
    #[serde(rename = "updateAvailable")]
    pub update_available: bool,
    #[serde(rename = "latestVersion")]
    pub latest_version: Option<String>,
    #[serde(rename = "downloadUrl")]
    pub download_url: Option<String>,
    #[serde(rename = "isAutomatic")]
    pub is_automatic: bool,
}

pub struct AlsaBaseApp {
    base_url: String,
    app_slug: String,
    client: reqwest::Client,
}

impl AlsaBaseApp {
    pub fn new(base_url: &str, app_slug: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            app_slug: app_slug.to_string(),
            client: reqwest::Client::new(),
        }
    }

    // Check for updates
    pub async fn check_update(&self, current_ver: &str, device_id: &str) -> Result<UpdateResponse, Box<dyn Error>> {
        let url = format!(
            "{}/api/apps/{}/check-update?currentVersion={}&platform=windows&deviceId={}",
            self.base_url, self.app_slug, current_ver, device_id
        );
        let resp = self.client.get(&url).send().await?.json::<UpdateResponse>().await?;
        Ok(resp)
    }

    // Activate license serial
    pub async fn activate_license(&self, key: &str, device_id: &str, machine_name: &str) -> Result<bool, Box<dyn Error>> {
        let url = format!("{}/api/apps/{}/licenses/activate", self.base_url, self.app_slug);
        let payload = ActivatePayload {
            key,
            device_id,
            device_name: machine_name,
            platform: "windows",
        };
        let res = self.client.post(&url).json(&payload).send().await?;
        Ok(res.status().is_success())
    }

    // Validate license on startup
    pub async fn validate_license(&self, key: &str, device_id: &str) -> Result<ValidateResponse, Box<dyn Error>> {
        let url = format!("{}/api/apps/{}/licenses/validate", self.base_url, self.app_slug);
        let body = serde_json::json!({ "key": key, "deviceId": device_id });
        let resp = self.client.post(&url).json(&body).send().await?.json::<ValidateResponse>().await?;
        Ok(resp)
    }
}
```

---

#### 4. Python (Desktop GUI / PySide / Requests)

```python
import platform
import uuid
import requests

class AlsaBaseAppClient:
    def __init__(self, base_url: str, app_slug: str):
        self.base_url = base_url.rstrip("/")
        self.app_slug = app_slug
        self.session = requests.Session()

    @staticmethod
    def get_hardware_id() -> str:
        """Returns stable hardware MAC-based node identifier."""
        return f"PC-{uuid.getnode():012x}"

    def check_device(self, device_id: str) -> dict:
        """Check if hardware ID is permitted or locked."""
        url = f"{self.base_url}/api/apps/{self.app_slug}/devices/check"
        resp = self.session.get(url, params={"deviceId": device_id}, timeout=10)
        return resp.json()

    def check_update(self, current_version: str, device_id: str, platform_name: str = "windows") -> dict:
        """Query for new releases and mandatory upgrade requirements."""
        url = f"{self.base_url}/api/apps/{self.app_slug}/check-update"
        resp = self.session.get(url, params={
            "currentVersion": current_version,
            "platform": platform_name,
            "deviceId": device_id
        }, timeout=10)
        return resp.json()

    def activate_license(self, serial_key: str, device_id: str) -> dict:
        """Bind serial key to this PC machine."""
        url = f"{self.base_url}/api/apps/{self.app_slug}/licenses/activate"
        payload = {
            "key": serial_key.strip().upper(),
            "deviceId": device_id,
            "deviceName": platform.node(),
            "osName": f"{platform.system()} {platform.release()}",
            "platform": platform.system().lower()
        }
        resp = self.session.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def validate_license(self, serial_key: str, device_id: str) -> dict:
        """Validate license validity on application launch."""
        url = f"{self.base_url}/api/apps/{self.app_slug}/licenses/validate"
        resp = self.session.post(url, json={"key": serial_key, "deviceId": device_id}, timeout=10)
        return resp.json()

    def deactivate_license(self, serial_key: str, device_id: str) -> bool:
        """Release activation slot on uninstallation or license transfer."""
        url = f"{self.base_url}/api/apps/{self.app_slug}/licenses/deactivate"
        resp = self.session.post(url, json={"key": serial_key, "deviceId": device_id}, timeout=10)
        return resp.status_code == 200
```

---

#### 5. cURL / Command Line Quick Reference

```bash
# 1. Check if device is banned or locked
curl "http://127.0.0.1:8090/api/apps/desktop-app/devices/check?deviceId=PC-HWID-98234"

# 2. Check for update
curl "http://127.0.0.1:8090/api/apps/desktop-app/check-update?currentVersion=1.0.0&platform=windows&deviceId=PC-HWID-98234"

# 3. Activate a serial number
curl -X POST "http://127.0.0.1:8090/api/apps/desktop-app/licenses/activate" \
  -H "Content-Type: application/json" \
  -d '{"key":"ABCD-EFGH-IJKL-MNOP","deviceId":"PC-HWID-98234","deviceName":"Office-PC","platform":"windows"}'

# 4. Validate serial key on boot
curl -X POST "http://127.0.0.1:8090/api/apps/desktop-app/licenses/validate" \
  -H "Content-Type: application/json" \
  -d '{"key":"ABCD-EFGH-IJKL-MNOP","deviceId":"PC-HWID-98234"}'

# 5. Deactivate serial key (free seat)
curl -X POST "http://127.0.0.1:8090/api/apps/desktop-app/licenses/deactivate" \
  -H "Content-Type: application/json" \
  -d '{"key":"ABCD-EFGH-IJKL-MNOP","deviceId":"PC-HWID-98234"}'
```

#### `GET /api/apps/:slug/versions`
Lists all releases for the application.

#### `GET /api/apps/:slug/versions/:version`
Returns metadata for a specific release version.

#### `GET /api/apps/:slug/versions/:version/download`
Downloads the binary installer or archive file directly. Automatically increments the release `download_count`.

---

### 👑 Superuser Management Endpoints (`/api/apps/manage/...`)

All management endpoints require a valid Superuser JWT (`Authorization: Bearer <token>`).

#### `GET /api/apps/manage/apps`
Lists all registered apps with version counts, total storage usage, and download numbers.

#### `POST /api/apps/manage/apps`
Registers a new application.
- **Body**:
  ```json
  {
    "name": "Desktop Client",
    "slug": "desktop-client",
    "description": "Cross-platform desktop application",
    "iconUrl": "https://example.com/icon.png",
    "maxDevices": 5,
    "devicePolicy": "max_devices"
  }
  ```
- **Policy Modes**:
  - `unrestricted`: Any PC/hardware can access the app (default).
  - `max_devices`: App can only run on up to `maxDevices` distinct PCs. Subsequent unknown PCs are rejected with `403 Forbidden` (`PC_LIMIT_REACHED`).
  - `whitelist_only`: Only pre-approved computers in the devices table can access the app (`WHITELIST_REQUIRED`).

#### `PUT /api/apps/manage/apps/:id`
Updates application metadata, icon, or device restriction policy.
- **Body**:
  ```json
  {
    "name": "Desktop Client",
    "slug": "desktop-client",
    "description": "Updated description",
    "maxDevices": 3,
    "devicePolicy": "max_devices"
  }
  ```

#### `DELETE /api/apps/manage/apps/:id`
Deletes an application, all its releases, and all physical binary files from disk.

#### `GET /api/apps/manage/versions`
Lists releases across all applications, with optional `?appId=...` filter.

#### `POST /api/apps/manage/versions`
Uploads and publishes a new release version with an attached binary package.
- **Body**:
  ```json
  {
    "appSlug": "desktop-client",
    "version": "1.2.0",
    "buildNumber": 102,
    "importance": "automatic",
    "channel": "beta",
    "platform": "windows",
    "releaseNotes": "### What's New\n- Beta feature release",
    "minOsVersion": "Windows 10",
    "isActive": true,
    "file": {
      "name": "Desktop-Setup-1.2.0.exe",
      "data": "TVqQAAMAAAAEAAAA...",
      "size": 24500000,
      "type": "application/x-msdownload"
    }
  }
  ```

#### `PUT /api/apps/manage/versions/:id`
Updates release metadata (importance, channel, active status, release notes).

#### `DELETE /api/apps/manage/versions/:id`
Deletes a release record and removes its physical binary file from storage.

#### `GET /api/apps/manage/licenses`
Lists issued licenses for an app with optional `?appId=...`, `?status=...`, and `?search=...`.

#### `POST /api/apps/manage/licenses`
Generates single or batch license keys with custom format, activation limit, and expiration.
- **Body**:
  ```json
  {
    "appId": "app_123",
    "count": 10,
    "format": "XXXX-XXXX-XXXX-XXXX",
    "maxActivations": 3,
    "expiresAt": "2027-12-31T23:59:59.000Z",
    "customerName": "Acme Corp",
    "customerEmail": "licenses@acme.com",
    "notes": "Enterprise contract #849"
  }
  ```

#### `PUT /api/apps/manage/licenses/:id`
Updates a license's status (`active`, `revoked`, `suspended`, `expired`), customer metadata, or activation limit.

#### `DELETE /api/apps/manage/licenses/:id`
Permanently deletes a license and unbinds all associated client devices.

#### `GET /api/apps/manage/devices`
Lists registered devices / PCs for an application with optional `?appId=...`, `?isLocked=true|false`, and `?search=...`.

#### `POST /api/apps/manage/devices/lock`
Pre-bans or locks a client hardware ID with a custom lock reason.
- **Body**:
  ```json
  {
    "appId": "app_123",
    "deviceId": "PC-HWID-98234",
    "deviceName": "Workstation-A",
    "reason": "Unauthorized access or violation of terms"
  }
  ```

#### `PUT /api/apps/manage/devices/:id/lock`
Toggles lock status on an existing registered device (`{ "isLocked": true|false, "reason": "..." }`).

#### `DELETE /api/apps/manage/devices/:id`
Deletes and unbinds a device record from the registry.

---

## 12. Client SDK Quickstart

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
