# KSD Auto Blog Platform

Internal content platform for Khao Sok Discovery.

## Architecture

- Backend: Node.js + TypeScript + Express
- Database: PostgreSQL + Prisma
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios

The existing Express API remains the source of truth. The Vue application lives in `frontend/` and talks to the backend through Vite's development proxy.

## Local development

### 1. Start PostgreSQL

```bash
npm run db:up
```

### 2. Start the backend

The backend runs on port `3000`.

If your local branch already uses `tsx`:

```bash
npm run dev
```

If the repository still has the legacy `ts-node-dev` runner with TypeScript 7, update the local dev runner to `tsx` before starting the backend.

### 3. Install and start the Vue frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173/login
```

Vite proxies `/api` and `/health` to `http://localhost:3000`.

## Vue routes

- `/login`
- `/dashboard`
- `/generate`
- `/articles`
- `/articles/:id`
- `/websites`
- `/project-progress`
- `/system-logs`
- `/settings`

## Phase 2 status

Phase 2 development is prepared but is not complete until both real KSD WordPress websites:

1. pass Test Connection
2. create a real Draft post successfully

AI providers are intentionally not connected yet. Phase 3 begins after the WordPress acceptance tests pass.
