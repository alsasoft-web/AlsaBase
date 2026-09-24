# AlsaBase Serverless Hooks & Scheduled Tasks Documentation

Complete developer guide for **AlsaBase Serverless Hooks** (`_hooks/`) — extend your AlsaBase backend with custom HTTP endpoints, automated cron jobs, custom CLI commands, real-time database event listeners, and direct SQLite queries using JavaScript or TypeScript.

---

## 📑 Table of Contents

1. [Overview & Directory Structure](#1-overview--directory-structure)
2. [Lifecycle & Hot Reloading](#2-lifecycle--hot-reloading)
3. [Global Sandbox APIs](#3-global-sandbox-apis)
4. [Custom HTTP Endpoints (`routerAdd`)](#4-custom-http-endpoints-routeradd)
5. [Scheduled Cron Jobs (`cronAdd`)](#5-scheduled-cron-jobs-cronadd)
6. [Database Event Triggers (`onRecord...`)](#6-database-event-triggers-onrecord)
7. [Database Query API (`collections` & `db`)](#7-database-query-api-collections--db)
8. [Custom Commands (`commandAdd`)](#8-custom-commands-commandadd)
9. [Public Static Files & Assets (`publicFiles`, `savePublicFile`)](#9-public-static-files--assets-publicfiles-savepublicfile)
10. [Events & Realtime Publishing](#10-events--realtime-publishing)
11. [Modules, Imports & NPM Packages](#11-modules-imports--npm-packages)
12. [Logging & Admin Dashboard Telemetry](#12-logging--admin-dashboard-telemetry)
13. [Real-World Examples](#13-real-world-examples)

---

## 1. Overview & Directory Structure

AlsaBase automatically discovers, loads, and monitors all JavaScript/TypeScript files inside the `_hooks/` directory in your project root:

```text
my-project/
├── _hooks/
│   ├── main.js              # Primary starter hooks
│   ├── routes/
│   │   ├── stripe.js        # Custom Stripe webhook receiver
│   │   └── reports.ts       # Analytics and reporting API
│   ├── crons/
│   │   └── cleanup.js       # Periodic data cleanup tasks
│   └── utils/
│       └── notifier.js      # Helper module imported by hooks
├── data/
│   └── alsabase.db
└── package.json
```

- Any file with `.js`, `.mjs`, `.cjs`, or `.ts` inside `_hooks/` is executed in a sandboxed Node.js VM context with full access to database helpers, HTTP routers, event emitters, and cron schedulers.
- Subdirectories and helper files can be organized freely and imported using relative paths (e.g. `require('./utils/notifier')`).

---

## 2. Lifecycle & Hot Reloading

- **Automatic Startup**: When the AlsaBase server boots up, it initializes `_hooks/` (creating a starter `main.js` if empty) and registers all endpoints, tasks, and listeners.
- **Instant Hot-Reloading**: The built-in file watcher monitors `_hooks/` in real time. Whenever you edit, add, or delete a file in `_hooks/`, AlsaBase automatically clears previous routes, stops outdated cron tasks, and reloads the entire registry without requiring a server restart.
- **Syntax & Execution Safety**: Hook errors during evaluation or runtime are caught cleanly, logged to the server telemetry database, and displayed in the Admin Dashboard UI under the **Hooks & Functions** view.

---

## 3. Global Sandbox APIs

Every hook file has instant access to the following top-level globals and the unified `$app` namespace:

| API Symbol                                     | Type                     | Description                                              |
| :--------------------------------------------- | :----------------------- | :------------------------------------------------------- |
| `routerAdd(method, path, handler, authLevel?)` | `Function`               | Registers a custom REST API route                        |
| `cronAdd(name, schedule, handler)`             | `Function`               | Registers an automated cron schedule                     |
| `cronRemove(name)`                             | `Function`               | Programmatically stops and removes a cron task           |
| `commandAdd(name, description, handler)`       | `Function`               | Registers a custom CLI command                           |
| `publicFiles` / `public`                       | `Object`                 | File manipulation helpers for `./_public` directory      |
| `savePublicFile(path, content, isBase64?)`     | `Function`               | Saves text, buffer, or base64 file to `./_public`        |
| `savePublicJson(path, data, spaces?)`          | `Function`               | Serializes and saves JSON file to `./_public`            |
| `readPublicFile(path)`                         | `Function`               | Reads text file from `./_public`                         |
| `readPublicJson(path)`                         | `Function`               | Reads and parses JSON file from `./_public`              |
| `deletePublicFile(path)`                       | `Function`               | Safely removes file from `./_public` (moves to `.trash`) |
| `publicPath(path?)`                            | `Function`               | Returns absolute filesystem path to `./_public` file     |
| `PUBLIC_DIR`                                   | `string`                 | Absolute path to the `./_public` directory               |
| `onRecordAfterCreate(collection, handler)`     | `Function`               | Triggered immediately after record insertion             |
| `onRecordAfterUpdate(collection, handler)`     | `Function`               | Triggered immediately after record update                |
| `onRecordAfterDelete(collection, handler)`     | `Function`               | Triggered immediately after record deletion              |
| `onRecordEvent(action, collection, handler)`   | `Function`               | Listens to specific or all database CRUD events          |
| `collections`                                  | `Object`                 | High-level data access and SQL querying methods          |
| `db`                                           | `BetterSqlite3.Database` | Direct raw SQLite database instance                      |
| `log(...args)`                                 | `Function`               | Logs messages to terminal and logs telemetry table       |
| `events`                                       | `Object`                 | In-memory custom event bus (`emit`, `on`)                |
| `realtime`                                     | `Object`                 | Broadcasts realtime Socket.IO and SSE events             |
| `require(module)`                              | `Function`               | Custom module loader for npm and local files             |
| `$app`                                         | `Object`                 | Unified container containing all above APIs              |

---

## 4. Custom HTTP Endpoints (`routerAdd`)

You can define custom HTTP routes attached to any HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).

### Signature

```typescript
routerAdd(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  handler: (c: RequestContext) => any,
  authLevel: "public" | "auth" | "superuser" = "public"
)
```

### Authorization Levels

- `"public"`: Anyone can access the endpoint without credentials.
- `"auth"`: Requires a valid authenticated record JWT token (`Authorization: Bearer <TOKEN>`).
- `"superuser"`: Requires superuser / admin authentication.

### The Request Context Object (`c`)

The handler receives a single context object `c` with rich helpers:

| Property / Method           | Type                     | Description                                      |
| :-------------------------- | :----------------------- | :----------------------------------------------- |
| `c.req`                     | `express.Request`        | Original Express request object                  |
| `c.res`                     | `express.Response`       | Original Express response object                 |
| `c.query`                   | `Record<string, string>` | Parsed URL query parameters                      |
| `c.params`                  | `Record<string, string>` | Route path parameters (e.g. `/api/users/:id`)    |
| `c.body`                    | `any`                    | Parsed JSON / URL-encoded request body           |
| `c.headers`                 | `Record<string, string>` | Incoming HTTP headers                            |
| `c.user`                    | `AuthPayload \| null`    | Authenticated user/superuser payload             |
| `c.json(data, status?)`     | `Function`               | Sends a JSON response (default status `200`)     |
| `c.text(text, status?)`     | `Function`               | Sends a plain text response                      |
| `c.html(html, status?)`     | `Function`               | Sends an HTML response                           |
| `c.status(code)`            | `Function`               | Sets the HTTP status code                        |
| `c.error(message, status?)` | `Function`               | Sends an error JSON response (e.g. `400`, `404`) |
| `c.redirect(url, status?)`  | `Function`               | Redirects to a URL (default `302`)               |
| `c.setHeader(key, val)`     | `Function`               | Sets a response header                           |
| `c.getHeader(key)`          | `Function`               | Gets a request header                            |
| `c.db` / `c.collections`    | `Object`                 | Database access helpers                          |

### Route Examples

```javascript
// 1. Simple Public GET Route
routerAdd("GET", "/api/v1/health-check", (c) => {
  return c.json({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// 2. Protected Authenticated Route
routerAdd(
  "POST",
  "/api/v1/profile/update-status",
  (c) => {
    const userId = c.user.id;
    const { statusText } = c.body;

    if (!statusText) {
      return c.error("statusText is required", 400);
    }

    collections.update("users", userId, { status_text: statusText });

    return c.json({
      success: true,
      message: "Profile status updated",
    });
  },
  "auth",
);

// 3. Superuser-Only Metrics Route
routerAdd(
  "GET",
  "/api/admin/system-stats",
  (c) => {
    const totalUsers = collections.count("users");
    const totalLogs = collections.count("_logs");

    return c.json({
      totalUsers,
      totalLogs,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  },
  "superuser",
);
```

---

## 5. Scheduled Cron Jobs (`cronAdd`)

Automate background jobs such as periodic database cleanups, email reminders, cache invalidations, and data syncing.

### Signature

```typescript
cronAdd(name: string, cronExpression: string, handler: (ctx: CronContext) => Promise<void> | void)
```

Standard 5-part cron syntax: `* * * * *` (Minute, Hour, Day of Month, Month, Day of Week).

### Interactive On-Demand Execution & Live Log Streaming

In addition to recurring schedules, any registered cron job can be executed on-demand directly from the **Crons** tab in the AlsaBase Admin Dashboard or via the API:

- Clicking **Run Now** in the Admin UI opens an interactive terminal console modal and streams real-time logs line by line via Server-Sent Events (SSE).
- Supports real-time status reporting, execution duration timers, user cancellation (`Ctrl+C`), and log clipboard export.
- **Persistent Execution Telemetry**: The last run timestamp, execution duration, and success/error status are automatically persisted into SQLite (`_crons` table), preserving accurate status across page refreshes, hot-reloads, and server restarts.
- SSE Endpoint: `POST /api/hooks/cron/stream` or `POST /api/hooks/cron/:name/stream`
- Cancellation Endpoint: `POST /api/hooks/cron/cancel`

```javascript
// Run every hour at minute 0
cronAdd("hourly_session_pruning", "0 * * * *", (ctx) => {
  log("Starting hourly session pruning...");

  const result = collections.run(
    "DELETE FROM _logs WHERE timestamp < datetime('now', '-30 days')",
  );

  log(`Pruned ${result.changes} old log entries.`);
});

// Run every Monday at 09:00 AM
cronAdd("weekly_summary_email", "0 9 * * 1", async (ctx) => {
  log("Generating weekly report...");
  const activeUsers = collections.query(
    "SELECT id, email FROM users WHERE verified = 1",
  );
  log(`Found ${activeUsers.length} active users to notify.`);
});
```

---

## 6. Database Event Triggers (`onRecord...`)

Hook directly into database lifecycle events across collections.

### Lifecycle Methods

```javascript
// Triggered immediately after a new record is inserted
onRecordAfterCreate("posts", (record) => {
  log(`New post created: ${record.id} - "${record.title}"`);

  // Realtime notification
  realtime.publish("notifications", {
    type: "new_post",
    title: record.title,
    postId: record.id,
  });
});

// Triggered immediately after a record is updated
onRecordAfterUpdate("orders", (record) => {
  if (record.status === "paid") {
    log(`Order ${record.id} has been marked as PAID.`);
  }
});

// Triggered immediately after a record is deleted
onRecordAfterDelete("products", (record) => {
  log(`Product ${record.id} deleted. Purging cached assets...`);
});

// Universal event listener (create, update, delete, or wildcard "*")
onRecordEvent("*", "articles", (event) => {
  log(`Articles event [${event.action}] on record ID: ${event.record.id}`);
});
```

---

## 7. Database Query API (`collections` & `db`)

The `collections` helper provides both high-level CRUD methods and parameterized SQL query execution.

### Query Methods

```javascript
// 1. Parameterized Query (Multiple Rows)
const activeUsers = collections.query(
  "SELECT * FROM users WHERE verified = ? ORDER BY created_at DESC LIMIT 20",
  1,
);

// 2. Query Single Row
const config = collections.get(
  "SELECT * FROM app_settings WHERE key = ?",
  "site_name",
);

// 3. Execute Statement (INSERT / UPDATE / DELETE / DDL)
const info = collections.run(
  "UPDATE posts SET views = views + 1 WHERE id = ?",
  "post_123",
);
log(`Updated rows: ${info.changes}`);

// 4. High-Level Find with Filter & Pagination
const results = collections.find("products", {
  filter: "price >= ? AND in_stock = ?",
  params: [50, 1],
  sort: "price ASC",
  limit: 10,
  offset: 0,
});

// 5. High-Level Create
const newOrder = collections.create("orders", {
  customer_id: "user_456",
  total_amount: 149.99,
  status: "pending",
});

// 6. High-Level Update & Delete
collections.update("orders", newOrder.id, { status: "completed" });
collections.delete("orders", "old_order_789");

// 7. Count Records
const totalPending = collections.count("orders", "status = ?", "pending");
```

### Direct SQLite Access with `db`

For complex transactions, prepared statements, or SQLite Pragmas:

```javascript
const insertMany = db.transaction((items) => {
  const stmt = db.prepare("INSERT INTO metrics (key, value) VALUES (?, ?)");
  for (const item of items) {
    stmt.run(item.key, item.value);
  }
});

insertMany([
  { key: "cpu", value: 45 },
  { key: "memory", value: 80 },
]);
```

---

## 8. Custom Commands (`commandAdd`)

Register custom CLI commands and scripts accessible via terminal or the Admin dashboard:

```javascript
commandAdd(
  "seed:users",
  "Populate database with demo mock users",
  async (ctx) => {
    log("Seeding database with mock users...");
    for (let i = 1; i <= 5; i++) {
      collections.create("users", {
        email: `testuser${i}@example.com`,
        name: `Test User ${i}`,
        verified: 1,
      });
    }
    log("Seeding completed successfully!");
  },
);
```

---

## 9. Public Static Files & Assets (`publicFiles`, `savePublicFile`)

Hooks and cron jobs have native helpers to generate, save, read, and manage static files inside the `./_public` directory (which are automatically served directly to users and web clients):

```javascript
// 1. Save text or HTML directly to _public/
savePublicFile("reports/daily.html", "<h1>Daily System Report</h1><p>Status: OK</p>");

// 2. Save JSON data feed (e.g. catalog or sitemap)
savePublicJson("data/test.json", {
  total: 1200,
  updatedAt: new Date().toISOString(),
  slugs: [...]
});

// 3. Save binary files, map tiles, or base64 images
const imageBuffer = Buffer.from(base64Data, "base64");
publicFiles.save("maps/elden-ring/tiles/0/0/0.png", imageBuffer);

// 4. Read static file from _public/
const indexHtml = readPublicFile("index.html");
const config = readPublicJson("data/config.json");

// 5. Check existence or delete files
if (publicFiles.exists("temp/cache.json")) {
  publicFiles.delete("temp/cache.json");
}

// 6. Get absolute filesystem path
const tileDir = publicPath("maps/elden-ring/tiles");
```

---

## 10. Events & Realtime Publishing

Broadcast real-time messages to connected web browsers, frontend apps, or internal subscribers:

```javascript
// Broadcast custom event to Socket.IO and SSE subscribers
realtime.publish("chat-room-general", {
  sender: "system",
  message: "Server maintenance scheduled in 10 minutes.",
});

// Listen to custom in-memory events
events.on("user:signup", (userData) => {
  log(`User signed up: ${userData.email}. Sending welcome email...`);
});

// Emit custom in-memory events
events.emit("user:signup", { email: "alice@example.com" });
```

---

## 11. Modules, Imports & NPM Packages

Hooks support standard `require(...)` and ESM-style `import` syntax:

### Built-in & Local Modules

```javascript
const crypto = require("node:crypto");
const path = require("node:path");

// Local helper import from _hooks/helpers/
const { sendSlackAlert } = require("./helpers/slack");
```

### External NPM Packages

Install dependencies inside your root `package.json` (or via the **NPM Packages** tab in the Admin UI), then require them directly:

```javascript
const axios = require("axios");
const bcrypt = require("bcryptjs");

routerAdd("POST", "/api/external-sync", async (c) => {
  const res = await axios.get("https://api.github.com/repos/facebook/react");
  return c.json({ stars: res.data.stargazers_count });
});
```

---

## 12. Logging & Admin Dashboard Telemetry

Calling `log(...)` inside hooks captures output automatically:

- Formats logs into clean string streams.
- Records log entries into the internal `_logs` database table.
- Surfaces logs in real time inside the **Logs & Telemetry** and **Hooks & Functions** Admin UI.

```javascript
log("Processing payment for user", userId, { amount: 99.0 });
```

---

## 13. Real-World Examples

### A. Stripe Webhook Receiver (`_hooks/stripe.js`)

```javascript
routerAdd("POST", "/api/webhooks/stripe", async (c) => {
  const sig = c.getHeader("stripe-signature");
  const event = c.body;

  log(`Received Stripe Webhook Event: ${event.type}`);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customerEmail = session.customer_details.email;
    const amountTotal = session.amount_total / 100;

    collections.create("payments", {
      email: customerEmail,
      amount: amountTotal,
      stripe_session_id: session.id,
      status: "paid",
    });

    log(`Payment recorded for ${customerEmail} ($${amountTotal})`);
  }

  return c.json({ received: true });
});
```

### B. Daily Database Optimization Cron (`_hooks/db_maintenance.js`)

```javascript
cronAdd("daily_vacuum", "0 3 * * *", () => {
  log("Starting scheduled SQLite VACUUM and ANALYZE...");
  db.exec("VACUUM; ANALYZE;");
  log("SQLite database optimization finished.");
});
```
