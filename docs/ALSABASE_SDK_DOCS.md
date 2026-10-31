# AlsaBase Client SDK Documentation (`alsabase` NPM Package)

The official **AlsaBase JavaScript/TypeScript SDK** (`alsabase`) provides a fluent, type-safe API for interacting with AlsaBase databases, authentication systems, realtime events (WebSocket & SSE), serverless hooks, telemetry logs, and schema management.

---

## 📦 Installation

```bash
# Using npm
npm install alsabase

# Using yarn
yarn add alsabase

# Using pnpm
pnpm add alsabase
```

### Browser / CDN Usage (ESM)

```html
<script type="module">
  import AlsaBase from "https://cdn.jsdelivr.net/npm/alsabase/dist/index.js";
  const ab = new AlsaBase("http://127.0.0.1:8090");
</script>
```

---

## 🚀 Quick Initialization

```typescript
import AlsaBase from "alsabase";

// Connect to local or remote AlsaBase server
const ab = new AlsaBase("http://127.0.0.1:8090");
```

---

## 📑 Table of Contents

1. [Authentication & User Management](#1-authentication--user-management)
2. [Superuser / Admin Operations](#2-superuser--admin-operations)
3. [Record CRUD Operations](#3-record-crud-operations)
4. [Filtering & Query Helpers](#4-filtering--query-helpers)
5. [Table & Schema Management](#5-table--schema-management)
6. [File Uploads & Media Assets](#6-file-uploads--media-assets)
7. [Realtime Subscriptions (WebSocket & SSE)](#7-realtime-subscriptions)
8. [Logs & Server Telemetry](#8-logs--server-telemetry)
9. [Serverless Hooks, Crons & Commands](#9-serverless-hooks-crons--commands)
10. [App Releases & Version Control](#10-app-releases--version-control)

---

## 1. Authentication & User Management

### Password Authentication

```typescript
// Login with email (or username) and password
const authData = await ab
  .collection("users")
  .authWithPassword("user@example.com", "password123");

console.log("Token:", authData.token);
console.log("User Record:", authData.record);

// Current auth state
console.log(ab.authStore.isValid); // boolean
console.log(ab.authStore.token); // string JWT
console.log(ab.authStore.model); // RecordModel | null
```

### One-Time Password (OTP) Authentication

```typescript
// 1. Request OTP code sent to user email
await ab.collection("users").requestOTP("user@example.com");

// 2. Verify OTP code and login
const authData = await ab
  .collection("users")
  .authWithOTP("123456", "user@example.com");
```

### Auth Refresh

```typescript
// Refresh current session and user profile
const refreshed = await ab.collection("users").authRefresh();
```

### Password Reset

```typescript
// Request password reset email
await ab.collection("users").requestPasswordReset("user@example.com");

// Confirm password reset with token
await ab.collection("users").confirmPasswordReset(resetToken, "newPassword123");
```

### Email Verification & Email Change

```typescript
// Request email verification
await ab.collection("users").requestVerification("user@example.com");

// Confirm verification with token
await ab.collection("users").confirmVerification(verificationToken);

// Request email change
await ab.collection("users").requestEmailChange("newemail@example.com");

// Confirm email change
await ab.collection("users").confirmEmailChange(changeToken, "currentPassword");
```

### Logout

```typescript
// Clear authentication token and state
ab.authStore.clear();
```

---

## 2. Superuser / Admin Operations

Superusers have administrative permissions to inspect logs, manage database schemas, configure settings, manage hooks and public directory.

```typescript
// Login as superuser
await ab.superusers.authWithPassword(
  "admin@alsabase.local",
  "superpassword123",
);

// Admin alias is also supported:
await ab.admins.authWithPassword("admin@alsabase.local", "superpassword123");

// Check if initial superuser setup is required
const { hasSuperuser } = await ab.superusers.hasInitialSuperuser();

if (!hasSuperuser) {
  // First-time administrator registration
  await ab.superusers.setupInitialSuperuser(
    "admin@alsabase.local",
    "superpassword123",
  );
}

// Get current superuser profile
const adminProfile = await ab.superusers.getMe();

// List all superuser accounts
const allAdmins = await ab.superusers.getFullList();

// Create a new administrator account
const newAdmin = await ab.superusers.create({
  email: "secondary_admin@alsabase.local",
  password: "strongPassword123"
});

// Update an administrator account
await ab.superusers.update(newAdmin.id, {
  password: "newStrongPassword123"
});

// Delete an administrator account
await ab.superusers.delete(newAdmin.id);
```

---

## 3. Record CRUD Operations

All record operations are accessed via `ab.collection("collectionName")`.

### List & Pagination (`getList`)

```typescript
interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  views: number;
  published: boolean;
  author: string;
}

// Fetch paginated records (Page 1, 20 items per page)
const result = await ab.collection<Post>("posts").getList(1, 20, {
  filter: "published = true && views > 100",
  sort: "-created", // '-created' for descending, 'created' for ascending
  expand: "author", // Expand relational fields
});

console.log("Total items:", result.totalItems);
console.log("Total pages:", result.totalPages);
console.log("Current page items:", result.items);
```

### Fetch All Records (`getFullList`)

```typescript
// Automatically handles pagination in batches behind the scenes
const allPosts = await ab.collection<Post>("posts").getFullList({
  batch: 200,
  sort: "-created",
});
```

### Get Single Record (`getOne` / `getFirstListItem`)

```typescript
// Fetch by ID
const post = await ab.collection<Post>("posts").getOne("RECORD_ID", {
  expand: "author",
});

// Fetch first item matching filter
const postBySlug = await ab
  .collection<Post>("posts")
  .getFirstListItem('slug = "introducing-alsabase"');
```

### Create Record (`create`)

```typescript
// Create with plain JSON
const newPost = await ab.collection("posts").create({
  title: "Building Fast Backends",
  slug: "building-fast-backends",
  content: "AlsaBase makes backend development effortless.",
  published: true,
  views: 0,
});

// Create with FormData (files + fields)
const formData = new FormData();
formData.append("title", "Post with Cover");
formData.append("cover", fileInput.files[0]);
const postWithCover = await ab.collection("posts").create(formData);
```

### Update Record (`update`)

```typescript
const updatedPost = await ab.collection("posts").update("RECORD_ID", {
  views: 150,
  published: true,
});
```

### Delete Record (`delete`)

```typescript
await ab.collection("posts").delete("RECORD_ID");
```

### Truncate Collection (`truncate` - Superuser Only)

```typescript
// Delete all records in the table
await ab.collection("posts").truncate();
```

---

## 4. Filtering & Query Helpers

AlsaBase provides a SQL-injection safe parameter formatter via `ab.filter(...)`:

```typescript
const filter = ab.filter(
  "status = {:status} && age >= {:minAge} && title ~ {:keyword}",
  {
    status: "active",
    minAge: 18,
    keyword: "developer",
  },
);

const result = await ab.collection("profiles").getList(1, 20, { filter });
```

### Supported Filter Operators:

| Operator   | Description             | Example                                  |
| ---------- | ----------------------- | ---------------------------------------- |
| `=`        | Equals                  | `status = "active"`                      |
| `!=`       | Not equals              | `status != "archived"`                   |
| `>` / `>=` | Greater than / or equal | `price >= 99.5`                          |
| `<` / `<=` | Less than / or equal    | `stock < 10`                             |
| `~`        | Contains / LIKE pattern | `title ~ "tutorial"`                     |
| `!~`       | Not contains            | `email !~ "spam"`                        |
| `&&`       | Logical AND             | `active = true && role = "editor"`       |
| `\|\|`     | Logical OR              | `status = "new" \|\| status = "pending"` |

---

## 5. Table & Schema Management

Inspect, create, modify, and delete collection schemas dynamically (requires Superuser authentication).

### 🔍 Get Current Table Schema

```typescript
// Method 1: Via collection instance
const schema = await ab.collection("articles").getSchema();
console.log("Table Name:", schema.name);
console.log("Column Definitions:", schema.fields);
console.log("API Access Rules:", schema.rules);

// Method 2: Via collections service
const schema = await ab.collections.getSchema("articles");

// Method 3: Via top-level client helper
const schema = await ab.getSchema("articles");
```

### List All Collections

```typescript
const collections = await ab.collections.getFullList();
```

### Create a New Collection

```typescript
const collection = await ab.collections.create({
  name: "products",
  type: "base",
  fields: [
    { name: "title", type: "text", required: true },
    { name: "price", type: "number", required: true },
    { name: "in_stock", type: "bool", defaultValue: true },
    { name: "sku", type: "text", unique: true },
    { name: "author", type: "relation", relationCollection: "users", relationField: "id", maxSelect: 1, cascadeDelete: false },
    { name: "tags", type: "json" },
    { name: "photos", type: "file", options: { maxSelect: 5 } },
  ],
  rules: {
    listRule: "", // Public access
    viewRule: "", // Public access
    createRule: "@request.auth.id != ''", // Authenticated users
    updateRule: "@request.auth.id != ''",
    deleteRule: null, // Admin only
  },
});
```

### Update Collection Schema

```typescript
await ab.collections.update("products", {
  fields: [...existingFields, { name: "discount", type: "number" }],
});
```

### Delete Collection

```typescript
await ab.collections.delete("products");
```

### ⚡ View & Manage Table Indexes

Inspect all live SQLite indexes, create custom composite or single-column indexes, and drop indexes:

```typescript
// 1. Get all active SQLite indexes on a table
const indexes = await ab.collections.getIndexes("products");
console.log("Active table indexes:", indexes);
// Example item: { name: "idx_products_sku", tableName: "products", unique: true, columns: ["sku"], sql: "..." }

// 2. Create an index using the builder
const newIndex = await ab.collections.createIndex("products", {
  name: "idx_products_category_price",
  columns: ["category", "price"],
  unique: false,
});
console.log("Created index:", newIndex.name, newIndex.sql);

// 3. Create an index using raw SQL statement
await ab.collections.createIndex("products", {
  rawSql: "CREATE INDEX IF NOT EXISTS idx_products_tags ON products (tags);",
});

// 4. Drop an index from a table
await ab.collections.dropIndex("products", "idx_products_category_price");
```

---

## 6. File Uploads & Media Assets

### Generate Record File URLs

```typescript
// Get download URL for an uploaded file
const fileUrl = ab.files.getUrl(record, record.avatar);
// Example: http://localhost:8090/api/files/users/rec_123/avatar.png

// With image thumbnail query parameter
const thumbUrl = ab.files.getUrl(record, record.avatar, { thumb: "100x100" });
```

### Static Website Asset URLs & Public Files Management (`ab.files`)

```typescript
// 1. Access assets hosted in AlsaBase's ./_public folder
const assetUrl = ab.files.getPublicUrl("images/banner.webp");

// 2. Read a file's text content from ./_public
const fileData = await ab.files.readPublicFile("index.html");
console.log("File content:", fileData.content);

// 3. Save or upload a file to ./_public
await ab.files.savePublicFile(
  "config.json",
  JSON.stringify({ siteName: "My App" }),
);

// 4. Batch upload multiple files/folders to ./_public
await ab.files.uploadPublicBatch([
  { path: "css/theme.css", content: "body { background: #000; }" },
  { path: "assets/logo.png", content: "<BASE64_STRING>", isBase64: true },
]);

// 5. List and delete files in ./_public
const publicFiles = await ab.files.listPublicFiles();
await ab.files.deletePublicFile("temp.txt");
```

---

## 7. Realtime Subscriptions (Socket.IO Powered)

Subscribe to live creates, updates, deletes, and custom events across collections in real time via Socket.IO.

```typescript
// 1. Subscribe to all changes in a collection
const unsubscribe = await ab.collection("messages").subscribe("*", (e) => {
  console.log("Action:", e.action); // 'create' | 'update' | 'delete'
  console.log("Record:", e.record);
});

// 2. Subscribe to changes on a specific record
const unsubRecord = await ab
  .collection("messages")
  .subscribe("RECORD_ID", (e) => {
    console.log("Message updated:", e.record);
  });

// 3. Subscribe to custom realtime topic
const unsubTopic = await ab.realtime.subscribe("chat-room-1", (e) => {
  console.log("Room message:", e.data);
});

// 4. Publish custom realtime event
await ab.realtime.publish(
  "chat-room-1",
  { text: "Hello everyone!" },
  "new_message",
);

// 5. Unsubscribe when component unmounts
unsubscribe();
unsubRecord();
unsubTopic();
```

---

## 8. Logs & Server Telemetry (Superuser Only)

```typescript
// 1. Fetch paginated server logs
const logs = await ab.logs.getList(1, 50, {
  level: "ERROR", // "INFO" | "WARN" | "ERROR"
  search: "/api/collections",
});

// 2. Get server execution metrics & error rates
const stats = await ab.logs.getStats();
console.log("Total requests:", stats.total);
console.log("Total errors:", stats.error);
console.log("Average response time:", stats.avgDurationMs, "ms");

// 3. Get 7-day hourly traffic timeline
const timeline = await ab.logs.getTimeline();

// 4. Purge logs
await ab.logs.clear();
```

---

## 9. Serverless Hooks, Crons & Commands (Superuser Only)

AlsaBase supports custom serverless hooks located in `./_hooks`.

```typescript
// 1. Get overview of loaded hook files, routes, crons, and commands
const overview = await ab.hooks.getOverview();
console.log("Loaded hook routes:", overview.routes);
console.log("Scheduled cron jobs:", overview.crons);

// 2. Read a script file from ./_hooks
const hookFile = await ab.hooks.readFile("main.js");
console.log("Hook code:", hookFile.content);

// 3. Save or upload a new script to ./_hooks
await ab.hooks.saveFile(
  "stripe.js",
  `
  routerAdd("POST", "/api/webhooks/stripe", (c) => {
    return c.json({ received: true });
  });
`,
);

// 4. Batch upload multiple hook modules/subdirectories
await ab.hooks.uploadBatch([
  {
    path: "crons/cleaner.js",
    content: "cronAdd('cleaner', '0 0 * * *', () => {});",
  },
  {
    path: "utils/logger.js",
    content: "module.exports = { log: console.log };",
  },
]);

// 5. Manually trigger a scheduled cron job
await ab.hooks.triggerCron("daily_cleanup");

// 6. Cancel a running cron job
await ab.hooks.cancelCron("cron_123456", "daily_cleanup");

// 7. Run a custom CLI command or script
await ab.hooks.runCommand("seed:users", ["--count", "10"]);

// 8. Cancel a running CLI command
await ab.hooks.cancelCommand("cmd_123456", "seed:users");

// 9. Hot-reload hooks without restarting the server
await ab.hooks.reload();
```

---

## 10. App Releases & Version Control

AlsaBase provides a built-in application version control and auto-update system. You can publish release packages (.exe, .dmg, .apk, .zip, etc.), set update importance (`automatic` vs `optional`), link versions to specific user table column values (e.g. Alpha or Beta testers), and check for updates directly from client applications.

### Check for App Updates

```typescript
// Check if an update is available for your desktop, mobile, or CLI app
const update = await ab.checkAppUpdate("desktop-app", {
  currentVersion: "1.0.0",
  platform: "windows", // "windows" | "macos" | "linux" | "android" | "ios" | "web" | "all"
  channel: "stable",  // optional: "stable" | "beta" | "alpha" | "latest"
});

if (update.hasUpdate) {
  console.log("New version available:", update.latestVersion);
  console.log("Release notes:", update.releaseNotes);

  if (update.isAutomatic) {
    // Automatic (Mandatory) update: download and install without prompting user
    console.log("Automatic mandatory update required.");
  } else {
    // Optional update: prompt user with an update dialog
    console.log("Optional update available.");
  }

  // Download URL for the binary installer / archive
  console.log("Download URL:", update.downloadUrl);
  // Full download URL including server base URL
  console.log("Full Download URL:", update.version?.fullDownloadUrl);
} else {
  console.log("App is up to date.");
}
```

### Accessing App Versions & Binaries

```typescript
// List all published versions eligible for the current user/device
const versions = await ab.apps.getVersions("desktop-app", {
  platform: "windows",
});

// Get a specific version details
const version = await ab.apps.getVersion("desktop-app", "1.2.0");

// Get direct download link for a version
const downloadUrl = ab.apps.getDownloadUrl("desktop-app", "1.2.0");
```

### Superuser Operations (Publishing & Managing Releases)

```typescript
// 1. Create a new application with PC device access limits
const app = await ab.apps.createApp({
  name: "AlsaBase Desktop Client",
  slug: "desktop-app",
  description: "Official desktop client for macOS and Windows",
  maxDevices: 5,                       // Limit the entire app to run on at most 5 PCs
  devicePolicy: "max_devices",         // "unrestricted" | "max_devices" | "whitelist_only"
});

// 2. Upload and publish a new version release
const release = await ab.apps.uploadVersion({
  appSlug: "desktop-app",
  version: "1.2.0",
  buildNumber: 120,
  importance: "automatic", // "automatic" (mandatory) or "optional"
  channel: "beta",         // "stable" | "beta" | "alpha" | "latest"
  platform: "windows",
  releaseNotes: "### What's New\n- High performance database sync\n- Realtime connection improvements",
  minOsVersion: "Windows 10",
  isActive: true,

  // File binary attachment (base64)
  file: {
    name: "AlsaBase-Setup-1.2.0.exe",
    data: "data:application/octet-stream;base64,TVqQAAMAAAAEAAAA...",
    size: 24500000,
  },
});

// 3. Update version metadata
await ab.apps.updateVersion(release.id, {
  importance: "optional",
  isActive: true,
});

// 4. Delete version and its storage file
await ab.apps.deleteVersion(release.id);
```

### Device Locking & Hardware Protection

Protect your application by verifying client hardware identifiers and preventing banned computers from accessing updates:

```typescript
// Check if a client device is locked / banned
const deviceCheck = await ab.apps.checkDevice("desktop-app", "PC-HWID-98234");
if (deviceCheck.isLocked) {
  throw new Error("This computer has been locked: " + (deviceCheck.lockReason || "Access prohibited"));
}

// Pass deviceId into update checks for automatic hardware-lock blocking
const update = await ab.checkAppUpdate("desktop-app", {
  currentVersion: "1.0.0",
  platform: "windows",
  deviceId: "PC-HWID-98234",
});
```

### Serial Key & License Activation

Issue serial numbers with device activation limits and validate client PC licenses:

```typescript
// 1. Activate a license key on a client machine
const activation = await ab.apps.activateLicense("desktop-app", {
  key: "ABCD-EFGH-IJKL-MNOP",
  deviceId: "PC-HWID-98234",
  deviceName: "John's Workstation",
  platform: "windows",
});

console.log("License status:", activation.license.status);
console.log("Activations used:", activation.license.activatedCount, "/", activation.license.maxActivations);

// 2. Validate license validity on launch
const check = await ab.apps.validateLicense("desktop-app", {
  key: "ABCD-EFGH-IJKL-MNOP",
  deviceId: "PC-HWID-98234",
});

if (!check.valid) {
  console.log("License invalid or expired:", check.message);
}

// 3. Deactivate license from a computer
await ab.apps.deactivateLicense("desktop-app", {
  key: "ABCD-EFGH-IJKL-MNOP",
  deviceId: "PC-HWID-98234",
});

// 4. Superuser: Batch generate license serial keys
const batch = await ab.apps.manageCreateLicenses({
  appSlug: "desktop-app",
  count: 20,
  format: "XXXX-XXXX-XXXX-XXXX",
  maxActivations: 3,
  expiresAt: "2027-12-31T23:59:59.000Z",
  customerName: "Enterprise Client",
});
console.log(`Generated ${batch.createdCount} licenses`);

### End-to-End Desktop / Client App Lifecycle Flow

Here is the complete production workflow for desktop applications (Tauri, Electron, React Native, or Node.js) combining device lock checks, auto-updates, and serial key licensing:

```typescript
import { AlsaBase, ClientResponseError } from "alsabase";

const ab = new AlsaBase("https://alsabase.example.com");

export interface AppInitState {
  isLicensed: boolean;
  needsUpdate: boolean;
  updateUrl?: string;
  isMandatoryUpdate: boolean;
  deviceLocked: boolean;
  lockReason?: string;
}

export class AppSecurityManager {
  private appSlug = "my-desktop-app";
  private currentVersion = "1.0.0";
  private deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  /**
   * Run full verification on application launch.
   */
  async initialize(): Promise<AppInitState> {
    // Step 1: Check device hardware ban / lock status
    const deviceCheck = await ab.apps.checkDevice(this.appSlug, this.deviceId);
    if (deviceCheck.isLocked) {
      return {
        isLicensed: false,
        needsUpdate: false,
        isMandatoryUpdate: false,
        deviceLocked: true,
        lockReason: deviceCheck.lockReason || "Device locked by administrator",
      };
    }

    // Step 2: Check for application updates
    let needsUpdate = false;
    let isMandatoryUpdate = false;
    let updateUrl: string | undefined;

    try {
      const update = await ab.apps.checkUpdate(this.appSlug, {
        currentVersion: this.currentVersion,
        platform: "windows",
        deviceId: this.deviceId,
      });

      if (update.hasUpdate) {
        needsUpdate = true;
        isMandatoryUpdate = update.isAutomatic || update.isMandatory;
        updateUrl = update.downloadUrl || undefined;
      }
    } catch (err) {
      console.warn("Failed to check update:", err);
    }

    // Step 3: Check stored license key
    const storedSerial = this.getStoredLicenseKey();
    let isLicensed = false;

    if (storedSerial) {
      try {
        const val = await ab.apps.validateLicense(this.appSlug, {
          key: storedSerial,
          deviceId: this.deviceId,
        });
        isLicensed = Boolean(val.valid && !val.isLocked);
      } catch (err) {
        // Optional offline grace period check
        isLicensed = this.checkOfflineGracePeriod();
      }
    }

    return {
      isLicensed,
      needsUpdate,
      isMandatoryUpdate,
      updateUrl,
      deviceLocked: false,
    };
  }

  /**
   * Activate a new serial key provided by the user.
   */
  async activate(serialKey: string, deviceName?: string) {
    const result = await ab.apps.activateLicense(this.appSlug, {
      key: serialKey.trim().toUpperCase(),
      deviceId: this.deviceId,
      deviceName: deviceName || "Desktop-PC",
      platform: "windows",
    });

    if (result.success || result.activated) {
      this.saveStoredLicenseKey(serialKey.trim().toUpperCase());
      return true;
    }
    return false;
  }

  /**
   * Deactivate license on this PC to free up a slot for another machine.
   */
  async deactivate(): Promise<boolean> {
    const storedSerial = this.getStoredLicenseKey();
    if (!storedSerial) return true;

    try {
      await ab.apps.deactivateLicense(this.appSlug, {
        key: storedSerial,
        deviceId: this.deviceId,
      });
      this.clearStoredLicenseKey();
      return true;
    } catch {
      return false;
    }
  }

  private getStoredLicenseKey(): string | null {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("alsabase_license_key");
    }
    return null;
  }

  private saveStoredLicenseKey(key: string) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("alsabase_license_key", key);
      localStorage.setItem("alsabase_license_validated_at", Date.now().toString());
    }
  }

  private clearStoredLicenseKey() {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("alsabase_license_key");
      localStorage.removeItem("alsabase_license_validated_at");
    }
  }

  private checkOfflineGracePeriod(graceDays = 7): boolean {
    if (typeof localStorage === "undefined") return false;
    const lastValidated = localStorage.getItem("alsabase_license_validated_at");
    if (!lastValidated) return false;
    const elapsed = Date.now() - parseInt(lastValidated, 10);
    return elapsed < graceDays * 24 * 60 * 60 * 1000;
  }
}
```

---

## 🛡️ Error Handling

The SDK throws `ClientResponseError` on API errors:

```typescript
import { ClientResponseError } from "alsabase";

try {
  await ab.collection("posts").create({ title: "" });
} catch (err) {
  if (err instanceof ClientResponseError) {
    console.error("HTTP Status:", err.status);
    console.error("Response Data:", err.data);
    console.error("Error Message:", err.message);
  }
}
```
