# Deploy VibeSphere to Render

This guide deploys VibeSphere to Render with ONE link. The backend (Node/Express) also serves the built React app, so you only deploy a single Web Service.

## 1) Prerequisites
- A Render account
- A MySQL database (hosted). Options:
  - PlanetScale (recommended free tier)
  - Aiven, Railway, or any hosted MySQL
- Your database credentials or a `DATABASE_URL` like:
  ```
  mysql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require
  ```
- A JWT secret for auth (any strong random string)

## 2) Configure the repo
We already added:
- `render.yaml` – defines a single Web Service named `vibesphere` that builds the frontend and runs the backend
- The backend serves the built SPA from `/dist` (single URL for UI + API)
- Backend supports both discrete `DB_*` vars or `DATABASE_URL` in `backend/config/database.js`

## 3) One-click deploy (Blueprint)
1. Push all changes to GitHub (done).
2. In Render, click New → Blueprint → Connect this GitHub repo.
3. Render will parse `render.yaml` and show one Web Service `vibesphere`.
4. Set environment variables:
   - `DATABASE_URL` (preferred), or set these individually: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT=3306`
   - `DB_SSL=true` (recommended on hosted MySQL)
   - `JWT_SECRET` (pick a strong random value)
   - Optional: `MONGODB_URI` if you want to enable Mongo features
5. Click Apply. Render will build the React app, then start the API which also serves the built site.

Notes:
- Backend health check: `/api/health` (Render uses this automatically from `render.yaml`).
- No separate frontend service is needed; a single URL serves both UI and API.

## 4) Verify
- Open `vibesphere-web` URL and try Explore/Discover flows
- Check API health: `https://<vibesphere-api>.onrender.com/api/health`
- If you see DB errors, confirm the MySQL credentials and that your provider allows external connections (and SSL is enabled or `DB_SSL=true`).

## 5) Running migrations (optional)
- `render.yaml` tries `npm run migrate` during build (ignored if DB isn’t yet reachable). You can run migrations manually:
  - Open `vibesphere-api` → Shell → run `npm run migrate`

## 6) Local dev remains unchanged
- `npm run dev:full` starts backend+frontend locally.
- Frontend still uses `/api` proxy in dev.

## Troubleshooting
- 504/Timeouts: Check `vibesphere-api` logs and health endpoint. Ensure DB is reachable.
- CORS: With a single origin, CORS issues are minimized. The backend still allows CORS for flexibility.
- API URL: The frontend talks to same-origin `/api` by default when served from the backend. No extra config needed.
