# Contributing to AlsaBase

Thank you for your interest in contributing to AlsaBase.

## Development Setup

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm 9+

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/alsabase.git
   cd alsabase
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Run the development server (starts both Express backend on port 8090 and Vite client on port 5173):
   ```bash
   npm run dev
   ```

5. Open `http://localhost:8090/_/` (or `http://localhost:5173/_/`) to access the admin dashboard.

---

## Project Structure

```
AlsaBase/
├── server/             # Express.js backend with SQLite, Auth, WebSocket, & Hooks
├── src/                # React Mantine Admin Dashboard application
├── public/             # Static dashboard assets & brand favicon
├── _public/            # Built-in static website & file hosting root
├── _hooks/             # Serverless TypeScript hook files and cron jobs
├── packages/
│   └── alsabase/       # Official JavaScript/TypeScript SDK package
└── dist/               # Compiled production assets
```

---

## Verification & Guidelines

Before opening a pull request, ensure all TypeScript checks and builds pass:

```bash
# Run full typecheck across frontend and backend
npm run typecheck:all

# Verify production build
npm run build

# Build the SDK package
npm run build --prefix packages/alsabase
```

### Pull Request Checklist
- Code is formatted and free of TypeScript compiler warnings.
- New endpoints or features have corresponding methods in `packages/alsabase` when applicable.
- No sensitive configuration or test database files are committed.
