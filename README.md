# AlsaBase

AlsaBase is a self-hosted backend engine built with Node.js, Express, and embedded SQLite. It provides instant REST APIs, realtime subscriptions over WebSocket and SSE, a React admin dashboard, a serverless hooks system, built-in static website hosting, and an official JavaScript/TypeScript client SDK.

---

## Key Features

- **Embedded SQLite Core**: Zero-configuration, file-based database operating in WAL mode with automated snapshots and backups.
- **Dynamic Collections**: Visual schema builder supporting text, number, boolean, email, URL, date, select, JSON, and file fields.
- **Rule-Based Access Control**: Granular list, view, create, update, and delete access rules based on authentication status and user identities.
- **Authentication & Security**: Superuser administrative accounts, user registration, password reset flows, OTP verification, rate limiting, and IP allowlisting.
- **Realtime Engine**: Live record changes (create, update, delete) and custom topics broadcasted over WebSocket and Server-Sent Events (SSE).
- **Serverless Hooks System**: Extensible backend logic in `_hooks/` with automatic route loading, cron scheduler, and custom CLI command runners.
- **Static Website Hosting**: Built-in asset and Single Page Application (SPA) hosting from the `_public/` directory at the root URL.
- **Official Client SDK**: Full-featured, type-safe client library published under `alsabase` (`packages/alsabase`).
- **Modern Admin Dashboard**: Built with React and Mantine, accessible at `http://localhost:8090/_/`.

---

## Quick Start

### 1. Prerequisites
- Node.js 18.0.0 or higher (Node.js 20+ recommended)
- npm 9+

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/alsabase.git
cd alsabase
npm install
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Adjust the parameters in `.env` if needed:
- `PORT`: HTTP port for the backend and dashboard (Default: `8090`).
- `JWT_SECRET`: Secret key used for signing authentication tokens.

### 4. Running AlsaBase

Start the development environment (Express API server on port 8090 and Vite development client on port 5173):

```bash
npm run dev
```

For production deployment:

```bash
# Build frontend dashboard and SDK
npm run build

# Start the standalone server
npm run server
```

### 5. Running with Docker / Docker Compose

Start AlsaBase instantly using Docker Compose with persistent data volumes:

```bash
docker compose up -d
```

Or build and run the container manually:

```bash
docker build -t alsabase .
docker run -d -p 8090:8090 -v $(pwd)/data:/app/data --name alsabase alsabase
```

Open your browser at `http://localhost:8090/_/` to create your initial superuser account and start creating collections.

---

## Architecture Overview

```
AlsaBase/
├── server/             # Express.js API, SQLite driver, Auth, WebSocket, Logs & Hooks engine
├── src/                # React Mantine Admin Dashboard source
├── _public/            # Static files, maps, and SPAs hosted publicly at /
├── _hooks/             # Serverless hook files, scheduled crons, and custom CLI commands
├── packages/
│   └── alsabase/       # Official JavaScript / TypeScript SDK
├── public/             # Branding assets and favicon
├── data/               # Local SQLite database files (ignored from git)
└── dist/               # Production build output
```

---

## Admin Dashboard

The administrative interface is served at `/_/`:

- **Collections**: Manage table schemas, field types, constraints, and permission rules.
- **Records**: Search, filter, edit, and inspect table records.
- **Serverless Hooks**: Inspect active hooks, register custom routes, trigger cron jobs manually, and run custom CLI commands with live terminal output.
- **Logs & Metrics**: Real-time server access and error logs with execution durations, stack traces, and hourly timeline charts.
- **Static Files & Hosting**: Browse and manage files served from `_public/`.
- **System Settings**: Application configuration, token expiration, rate limiting, and SMTP email settings.
- **Backups**: Create database snapshots, download backup archives, and restore data.

---

## Serverless Hooks (`_hooks/`)

AlsaBase automatically watches and executes files inside the `_hooks/` directory.

### Custom API Routes
Create a file like `_hooks/routes.ts`:

```typescript
routerAdd("GET", "/api/v1/hello", (c) => {
  c.json(200, { message: "Hello from AlsaBase Hook!" });
});
```

### Scheduled Cron Tasks
Create a file like `_hooks/cron.ts`:

```typescript
cronAdd("daily_cleanup", "0 0 * * *", (c) => {
  c.db.prepare("DELETE FROM _logs WHERE timestamp < datetime('now', '-30 days')").run();
  console.log("Daily cleanup executed.");
});
```

### Custom CLI Commands
Create a file like `_hooks/commands.ts`:

```typescript
commandAdd("sync_feed", { description: "Fetch external data feed" }, async (c) => {
  console.log("Starting feed synchronization...");
});
```

---

## Static Web Hosting (`_public/`)

Any file or directory placed in `_public/` is served directly at the server root `/` and `/public/`:

- `_public/index.html` -> `http://localhost:8090/`
- `_public/images/logo.png` -> `http://localhost:8090/images/logo.png`
- `_public/maps/mafia/lost-heaven/index.html` -> `http://localhost:8090/maps/mafia/lost-heaven/`

Nested directories containing an `index.html` file are resolved automatically when requested with or without a trailing slash.

---

## Official Client SDK (`alsabase`)

Install the official client package:

```bash
npm install alsabase
```

### Example Usage

```typescript
import AlsaBase from "alsabase";

const pb = new AlsaBase("http://127.0.0.1:8090");

// 1. Authenticate
await pb.collection("users").authWithPassword("user@example.com", "password123");

// 2. Fetch Records with Filter & Sorting
const result = await pb.collection("posts").getList(1, 20, {
  filter: pb.filter("status = {:status}", { status: "published" }),
  sort: "-created_at",
});

// 3. Create a Record
const newPost = await pb.collection("posts").create({
  title: "First Post",
  content: "Hello AlsaBase!",
});

// 4. Realtime Subscription
const unsubscribe = await pb.collection("posts").subscribe("*", (e) => {
  console.log("Change event:", e.action, e.record);
});

// 5. Superuser / Admin Operations
await pb.superusers.authWithPassword("admin@example.com", "superpassword");
const collections = await pb.collections.getFullList();
const serverLogs = await pb.logs.getList(1, 50, { level: "ERROR" });
```

---

## CLI & Development Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs backend server (8090) and Vite frontend (5173) concurrently |
| `npm run server:dev` | Runs backend server with automatic file restart on changes |
| `npm run client:dev` | Runs frontend development server |
| `npm run build` | Typechecks and compiles production build |
| `npm run typecheck:all` | Runs full TypeScript compiler check on both backend and frontend |
| `npm run build --prefix packages/alsabase` | Builds the `alsabase` SDK package |

---

## Contributing

Contributions are welcome. Please check [CONTRIBUTING.md](CONTRIBUTING.md) for setup details and pull request guidelines.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
