# AlsaBase JavaScript / TypeScript Client SDK

Official client SDK for **AlsaBase** - lightweight, batteries-included SQLite backend engine with instant REST APIs, realtime subscriptions, authentication, and superuser collection management.

---

## Installation

```bash
npm install alsabase
```

Or via yarn/pnpm:
```bash
yarn add alsabase
# or
pnpm add alsabase
```

Browser via CDN (ESM):
```html
<script type="module">
  import AlsaBase from "https://cdn.jsdelivr.net/npm/alsabase/dist/index.js";

  const ab = new AlsaBase("http://127.0.0.1:8090");
</script>
```

---

## Quickstart

```typescript
import AlsaBase from "alsabase";

const ab = new AlsaBase("http://127.0.0.1:8090");

// 1. Authenticate as a regular user
const authData = await ab.collection("users").authWithPassword("john@example.com", "12345678");

// 2. Query paginated records
const result = await ab.collection("posts").getList(1, 20, {
  filter: ab.filter("status = {:status}", { status: "published" }),
  sort: "-created_at",
});

console.log(result.items);

// 3. Create a new record
const newPost = await ab.collection("posts").create({
  title: "Hello World",
  content: "Welcome to AlsaBase!",
  status: "published",
});

// 4. Realtime subscription
const unsubscribe = await ab.collection("posts").subscribe("*", (e) => {
  console.log("Post event:", e.action, e.record);
});
```

---

## Core Features

### 1. Authentication

#### User Authentication (Password & OTP)
```typescript
// Login with username or email
await ab.collection("users").authWithPassword("test@example.com", "password123");

// One-Time Password (OTP)
await ab.collection("users").requestOTP("test@example.com");
await ab.collection("users").authWithOTP("123456", "test@example.com");

// Check current auth status
console.log(ab.authStore.isValid);
console.log(ab.authStore.token);
console.log(ab.authStore.model);

// Logout
ab.authStore.clear();
```

#### Superuser / Admin Authentication
```typescript
// Login as Superuser / Admin
await ab.superusers.authWithPassword("admin@example.com", "superpassword");

// Admin alias is also available:
await ab.admins.authWithPassword("admin@example.com", "superpassword");

// Check if initial superuser setup is required
const { hasSuperuser } = await ab.superusers.hasInitialSuperuser();

if (!hasSuperuser) {
  await ab.superusers.setupInitialSuperuser("admin@example.com", "superpassword");
}
```

---

### 2. Record Operations (CRUD)

```typescript
// List records with pagination
const list = await ab.collection("articles").getList(1, 50, {
  filter: 'status = "published"',
  sort: "-created_at",
});

// Fetch all records across pages
const allArticles = await ab.collection("articles").getFullList();

// Fetch single record by ID
const article = await ab.collection("articles").getOne("RECORD_ID");

// Fetch first item matching filter
const first = await ab.collection("articles").getFirstListItem('slug = "intro"');

// Create record
const record = await ab.collection("articles").create({
  title: "New Post",
  slug: "new-post",
});

// Update record
await ab.collection("articles").update("RECORD_ID", {
  title: "Updated Title",
});

// Delete record
await ab.collection("articles").delete("RECORD_ID");

// Truncate (delete all records - Superuser only)
await ab.collection("articles").truncate();
```

---

### 3. Collection Management (Superuser / Admin)

Create, inspect, and update collection schemas dynamically from code:

```typescript
// 1. Inspect table schema via ab.collection()
const tableSchema = await ab.collection("products").getSchema();
console.log("Table columns:", tableSchema.fields);

// 2. Inspect table schema via ab.collections service
const col = await ab.collections.getSchema("products"); // or ab.collections.getOne("products")

// 3. Inspect table schema via top-level helper
const schema = await ab.getSchema("products");

// List all collections
const collections = await ab.collections.getFullList();

// Create a new collection
const newCollection = await ab.collections.create({
  name: "products",
  type: "base",
  fields: [
    { name: "title", type: "text", required: true },
    { name: "price", type: "number", required: true },
    { name: "in_stock", type: "bool" },
    { name: "tags", type: "json" },
  ],
  rules: {
    listRule: "", // Public
    viewRule: "", // Public
    createRule: "@request.auth.id != ''", // Authenticated users
    updateRule: "@request.auth.id != ''",
    deleteRule: null, // Admin only
  },
});

// Update collection schema or rules
await ab.collections.update("products", {
  fields: [
    ...newCollection.fields,
    { name: "sku", type: "text", unique: true },
  ],
});

// Delete collection
await ab.collections.delete("products");
```

---

### 4. Server Logs & Telemetry (Superuser / Admin)

Query server error logs, execution metrics, and latency timelines:

```typescript
// Query recent server logs
const logs = await ab.logs.getList(1, 50, {
  level: "ERROR",
  search: "/api/collections",
});

// Get log summary stats
const stats = await ab.logs.getStats();
console.log("Total errors:", stats.error, "Average latency:", stats.avgDurationMs, "ms");

// Get 7-day hourly request timeline
const timeline = await ab.logs.getTimeline();

// Clear logs
await ab.logs.clear();
```

---

### 5. Realtime Subscriptions

Subscribe to realtime create, update, and delete events via WebSocket / SSE:

```typescript
// Subscribe to all changes in a collection
const unsub = await ab.collection("messages").subscribe("*", (e) => {
  console.log("Action:", e.action); // 'create' | 'update' | 'delete'
  console.log("Record:", e.record);
});

// Subscribe to a specific record
const unsubRecord = await ab.collection("messages").subscribe("RECORD_ID", (e) => {
  console.log("Message updated:", e.record);
});

// Unsubscribe
unsub();
```

---

### 6. File Asset Helpers

Generate URLs for uploaded media files and static site assets:

```typescript
// Record file URL helper
const fileUrl = ab.files.getUrl(record, record.avatar);

// Public website assets helper (served from _public)
const publicUrl = ab.files.getPublicUrl("images/hero.webp");
```

---

### 7. Serverless Hooks & Crons (Superuser / Admin)

Inspect and trigger serverless backend hooks:

```typescript
// Get overview of loaded hook files, registered routes, and cron jobs
const overview = await ab.hooks.getOverview();

// Manually trigger a scheduled cron job
await ab.hooks.triggerCron("daily_cleanup");

// Reload hooks
await ab.hooks.reload();
```

---

## License

MIT License.
