# Free deployment: Vercel, Render and Supabase

Use `main` for deployment. The frontend runs on Vercel Hobby, Flask and the
Telegram webhook run in one Render Free web service, and PostgreSQL plus private
uploads live in Supabase Free. No Docker is required.

## Supabase

Create a Free project and a **private** Storage bucket named `asar-files`.
Use the connection settings under **Connect → Session pooler** (port 5432).
Copy the complete pooler username, including the project reference.
The database name is `postgres`. Disable **Enable Data API**: application data
is accessed through Flask. Supabase Auth is not used.

Keep deployment credentials in `backend/instance/deploy.env` locally; this
directory is ignored by Git. Do not replace the root `.env`, which belongs to
the local PostgreSQL installation. The deployment file is a configuration
reference for the dashboards; Flask does not automatically load it.

## Render

Create a Python **Web Service**, connect this repository and set:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `bash start.sh` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

Add these environment variables using your own values:

```dotenv
ASAR_ENV=production
FLASK_DEBUG=False
DB_HOST=YOUR_SESSION_POOLER_HOST
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.YOUR_PROJECT_REFERENCE
DB_PASSWORD=YOUR_DATABASE_PASSWORD
PGSSLMODE=require
SUPABASE_URL=https://YOUR_PROJECT_REFERENCE.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET_KEY
SUPABASE_STORAGE_BUCKET=asar-files
SECRET_KEY=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
TELEGRAM_BOT_TOKEN=YOUR_EXISTING_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET=YOUR_SEPARATE_RANDOM_SECRET
WEB_APP_URL=https://YOUR_FRONTEND.vercel.app
```

In dashboard value fields, enter passwords as plain values without dotenv
quotes or URL encoding. When importing a `.env` file, normal dotenv quoting
applies. Keep all server credentials on Render, outside frontend variables.

`start.sh` creates the current schema only when no application tables exist,
records its migration baseline, seeds capabilities idempotently, registers the
Telegram webhook using Render's `RENDER_EXTERNAL_URL`, and starts Gunicorn.
Existing versioned databases receive migrations; unversioned existing application
tables require an explicit baseline instead of an automatic assumption.
Application tables have RLS enabled to close direct Data API access.

The server uses **one Gunicorn worker** and four threads. Telegram processing
has one persistent event loop, serialized updates, conversation state in
PostgreSQL and persisted receipts for completed updates. Do not start local
polling for the same bot while its webhook is enabled.

## Vercel

Import the same repository as a Next.js project:

| Setting | Value |
| --- | --- |
| Production Branch | `main` |
| Root Directory | `frontend` |
| Node.js | 22.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Framework default |

Set `BACKEND_URL` to the actual HTTPS Render service URL, without `/api`.
Do not set `NEXT_PUBLIC_API_URL`. Browsers call same-origin `/api` routes;
Next.js rewrites them to Flask so session cookies stay on the frontend domain.
Uploads are read through authorized API routes and short-lived signed Storage
URLs. Private files are never placed in a public bucket.

After Vercel assigns a permanent URL, set that value as `WEB_APP_URL` on Render
and redeploy. Changes to Vercel's `BACKEND_URL` also require a new deployment.

## First launch

Check `/api/health`, registration, login, avatar and request-photo uploads,
moderation, SOS, and Telegram commands. A fresh database contains no local test
accounts and no administrator. Create the intended user account first, then
grant its administrator flags through an authenticated database connection.
Never publish the local test credentials as production administrator access.

Backend tests require `ASAR_TEST_DATABASE_URL` pointing to a separate PostgreSQL
database whose name ends in `_test`. Its application tables are recreated by the
fixtures. Never point tests at the local working database or Supabase deployment.
No SQLite fallback is used, including the historical migration tests.

Render Free sleeps after idle periods and has an ephemeral local filesystem.
Supabase therefore stores all deployed uploads; a Storage failure returns an
error instead of falling back to the local disk. Free database and storage
quotas and project pausing still apply. This setup is for a non-commercial
demonstration within the providers' free limits, without an uptime guarantee.
