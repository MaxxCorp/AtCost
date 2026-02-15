# Deploying AC Multiposter to Vercel

This guide walks you through deploying your AC Multiposter application to Vercel with a Postgres database and Vercel Cron Jobs for webhook renewal.

## Prerequisites

- A Vercel account (free tier works)
- A Postgres database (Neon, Supabase, Railway, etc.)
- Google OAuth credentials configured
- Your GitHub repository pushed to GitHub

## Table of Contents

1. [Why Vercel?](#why-vercel)
2. [Database Setup](#1-database-setup)
3. [Deploy to Vercel](#2-deploy-to-vercel)
4. [Environment Variables](#3-environment-variables)
5. [Google OAuth Configuration](#4-google-oauth-configuration)
6. [Database Migration](#5-database-migration)
7. [Cron Jobs (Webhook Renewal)](#6-cron-jobs-webhook-renewal)
8. [Testing Your Deployment](#7-testing-your-deployment)
9. [Troubleshooting](#8-troubleshooting)

---

## Why Vercel?

Vercel offers several advantages for SvelteKit applications:
- **Native SvelteKit support** - First-class integration, no adapter configuration needed
- **Automatic deployments** - Every push to GitHub triggers a new deployment
- **Preview deployments** - Every PR gets its own URL for testing
- **Built-in Cron Jobs** - No separate Worker needed (unlike Cloudflare)
- **Generous free tier** - 100 GB bandwidth, unlimited requests
- **Fast edge network** - Global CDN for static assets and serverless functions
- **Simple environment variables** - Easy to configure and update

---

## 1. Database Setup

You need a Postgres database accessible from the internet. Choose one of these options:

### Option A: Neon (Recommended - Free Tier Available)

1. Go to [neon.tech](https://neon.tech)
2. Sign up and create a new project
3. Create a database
4. **Important:** Copy the **Pooled connection** string (for serverless)
   - Format: `postgresql://user:pass@host:5432/dbname?sslmode=require`

### Option B: Supabase (Free Tier Available)

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings** → **Database**
4. **Important:** Copy the **Connection pooling** string with port 6543
   - This is optimized for serverless environments

### Option C: Railway, Render, or other providers

Follow their documentation to create a Postgres database and obtain the connection string.

**Note:** For serverless platforms like Vercel, always use connection pooling if available. This prevents exhausting database connections.

---

## 2. Deploy to Vercel

### Option A: Deploy via GitHub (Recommended)

1. Push your code to GitHub:
   ```powershell
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. Go to [vercel.com](https://vercel.com) and sign in
3. Click **Add New** → **Project**
4. Import your GitHub repository
5. Vercel will auto-detect SvelteKit:
   - **Framework Preset:** SvelteKit
   - **Build Command:** `pnpm build` (or `npm run build`)
   - **Output Directory:** `.vercel/output` (auto-configured by adapter)
   - **Install Command:** `pnpm install` (or `npm install`)

6. **Don't deploy yet** - click **Environment Variables** first

### Option B: Deploy via Vercel CLI

If you prefer the command line:

```powershell
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (will prompt for project settings)
vercel

# Or deploy to production
vercel --prod
```

**Note:** The Windows symlink issue you encountered during local build won't affect Vercel's build servers (Linux-based).

---

## 3. Environment Variables

Before deploying, add these environment variables in the Vercel dashboard:

1. In your Vercel project, go to **Settings** → **Environment Variables**
2. Add the following variables for **Production**, **Preview**, and **Development**:

| Variable | Value | Example | Notes |
|----------|-------|---------|-------|
| `DATABASE_URL` | Your Postgres connection string | `postgresql://user:pass@host:5432/dbname` | Use pooled connection |
| `BETTER_AUTH_SECRET` | Random secure string (32+ characters) | Use: `openssl rand -base64 32` | Must be strong |
| `BETTER_AUTH_URL` | Your Vercel deployment URL | `https://your-project.vercel.app` | Update after first deploy |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console | `xxx.apps.googleusercontent.com` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console | `GOCSPX-xxx` | OAuth client secret |
| `MICROSOFT_CLIENT_ID` | (Optional) From Azure | `xxx` | If using Microsoft auth |
| `MICROSOFT_CLIENT_SECRET` | (Optional) From Azure | `xxx` | If using Microsoft auth |
| `CRON_SECRET` | Random secure string for cron auth | Use: `openssl rand -base64 32` | Protects cron endpoint |

**To generate secure secrets on Windows:**

```powershell
# Using PowerShell
$bytes = New-Object byte[] 32
(New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

### Important Notes

- **BETTER_AUTH_URL:** After your first deployment, Vercel assigns a URL like `https://your-project.vercel.app`. Update this variable with that URL and redeploy.
- **Database URL:** Make sure to use the pooled/connection pooling version of your Postgres URL for best performance.
- **Environment Scopes:** Set variables for all three environments (Production, Preview, Development) unless you want different values for each.

---

## 4. Google OAuth Configuration

### Update Authorized Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://your-project.vercel.app/api/auth/callback/google
   ```
   (Replace `your-project` with your actual Vercel project name)
5. Click **Save**

### Update Authorized JavaScript Origins (if needed)

Add your Vercel domain:
```
https://your-project.vercel.app
```

### Custom Domain (Optional)

If you add a custom domain to Vercel later:
1. Add the custom domain redirect URI: `https://yourdomain.com/api/auth/callback/google`
2. Update `BETTER_AUTH_URL` environment variable to `https://yourdomain.com`
3. Redeploy

---

## 5. Database Migration

You need to run database migrations to set up the schema. You have two options:

### Option A: Run Migrations Locally (Recommended)

1. **Temporarily update your local `.env` file** with the production database URL:
   ```env
   DATABASE_URL="postgresql://production-connection-string"
   ```

2. **Run migrations**:
   ```powershell
   pnpm db:push
   # or
   pnpm db:migrate
   ```

3. **Restore your local `.env`** to use your local database

### Option B: Use Database GUI

Most database providers (Neon, Supabase, Railway) provide a SQL editor. Copy and run the migration files from the `drizzle/` directory in order:

1. `0000_tan_chat.sql`
2. `0001_flippant_shotgun.sql`
3. (And so on, in numerical order)

---

## 6. Cron Jobs (Webhook Renewal)

Google Calendar webhooks expire after ~7 days and need renewal. Vercel has **built-in Cron Jobs** (no separate service needed!).

### Vercel Cron Configuration

The `vercel.json` file already includes the cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/sync/renew-webhooks",
      "schedule": "0 0 * * *"
    }
  ]
}
```

This runs daily at midnight UTC.

### How It Works

1. Vercel automatically calls `/api/sync/renew-webhooks` daily with a GET request
2. Vercel adds the header `x-vercel-cron: 1` on these requests
3. For security, set a `CRON_SECRET` and pass it as a query parameter: `/api/sync/renew-webhooks?token=YOUR_CRON_SECRET`
  - Alternatively, you can use an `Authorization: Bearer <CRON_SECRET>` header when triggering manually
4. The endpoint renews all webhooks that are about to expire

### Verify Cron Setup

After deployment:
1. Go to your Vercel project dashboard
2. Click **Cron Jobs** in the sidebar
3. You should see the `/api/sync/renew-webhooks` job listed with daily schedule

### Manual Testing

You can manually trigger the webhook renewal:

```powershell
# Using GET with query token (works anywhere)
curl "https://your-project.vercel.app/api/sync/renew-webhooks?token=YOUR_CRON_SECRET"

# Or using POST with Authorization header
curl -X POST "https://your-project.vercel.app/api/sync/renew-webhooks" `
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 7. Testing Your Deployment

### Step 1: Verify Deployment Success

1. Go to your Vercel dashboard
2. Check that the deployment succeeded (green checkmark)
3. Click the deployment URL to open your app

### Step 2: Test Health Endpoints

Visit these URLs to verify configuration:

- **Health check:** `https://your-project.vercel.app/api/health/auth`
  - Should return `{ "ok": true, "checks": {...} }`
  - If `ok: false`, check which specific check failed

- **Auth session:** `https://your-project.vercel.app/api/auth/get-session`
  - Should return `{ "session": null }` (before login)
  - Not a 404 error

### Step 3: Test Google OAuth

1. Visit your Vercel app URL
2. Click **Sign In with Google**
3. Complete the OAuth flow
4. You should be redirected back and logged in

### Step 4: Grant Admin Access

After your first sign-in, grant yourself admin access:

1. Connect to your production database using a SQL client (or database GUI)
2. Run:
   ```sql
   UPDATE "user"
   SET roles = '["admin"]'
   WHERE email = 'your-email@example.com';
   ```
3. Refresh the app - you should now see all features

### Step 5: Test Webhook Functionality

1. Create a synchronization with Google Calendar
2. Verify the webhook is registered (check logs)
3. Test creating/updating events

---

## 8. Troubleshooting

### Build Fails on Vercel

**Problem:** Build fails with module errors or TypeScript errors

**Solutions:**
- Check the build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node version (Vercel uses Node 20.x by default)
- Check for missing environment variables that are accessed during build

### OAuth Redirect Errors

**Problem:** "redirect_uri_mismatch" from Google

**Solutions:**
- Ensure redirect URI in Google Console exactly matches: `https://your-project.vercel.app/api/auth/callback/google`
- No trailing slashes
- Must be HTTPS
- Must match your `BETTER_AUTH_URL`
- Check for typos in the domain name

### Database Connection Errors

**Problem:** App can't connect to database

**Solutions:**
- Verify `DATABASE_URL` is set correctly in Vercel environment variables
- Use the **pooled connection** URL (not the direct connection)
- Check if your database allows connections from all IPs (most providers do by default)
- For Neon: Use the connection string with `-pooler` in the hostname
- For Supabase: Use port 6543 (connection pooling) instead of 5432

### Function Timeout Errors

**Problem:** "Function exceeded maximum duration"

**Solutions:**
- The default timeout is configured in `svelte.config.js` (currently 30 seconds)
- Free tier: Max 10 seconds per function
- Pro tier: Max 60 seconds per function
- To change timeout, edit `svelte.config.js`:
  ```javascript
  adapter: adapter({
    runtime: 'nodejs20.x',
    maxDuration: 30  // Change this value
  })
  ```
- Optimize slow database queries
- Consider breaking long operations into smaller chunks

### Environment Variables Not Working

**Problem:** App behaves as if environment variables are missing

**Solutions:**
- Redeploy after adding environment variables (Vercel requires this)
- Check that variables are set for the correct environment (Production/Preview)
- Verify variable names match exactly (case-sensitive)
- Check the deployment logs for any environment variable warnings

### Cron Job Not Running

**Problem:** Webhooks not being renewed

**Solutions:**
- Check Vercel dashboard → Cron Jobs to see execution history
- Verify the cron path matches your endpoint exactly
- Check function logs for the cron execution
- Ensure `CRON_SECRET` is set correctly
- Manually test the endpoint with curl

### Health Endpoint Returns 500

**Problem:** `/api/health/auth` returns `{ "ok": false }`

**Solutions:**
- Check which specific check failed in the response
- Common issues:
  - `databaseOk: false` → Database connection problem
  - `hostMatchesBetterAuthUrl: false` → Wrong `BETTER_AUTH_URL`
  - Missing credentials → Set all required environment variables
- Check Vercel function logs for detailed error messages

---

## Performance Optimization

### Enable Caching

Vercel automatically caches static assets. For dynamic content:

1. Use appropriate `Cache-Control` headers in your API routes
2. Consider Vercel's Edge Config for frequently accessed data
3. Use Incremental Static Regeneration (ISR) for semi-static pages

### Database Connection Pooling

**Critical for serverless:** Always use connection pooling:
- **Neon:** Use the `-pooler` hostname in your connection string
- **Supabase:** Use port 6543 (connection pooling) instead of 5432
- This prevents exhausting database connections

### Monitor Performance

1. Go to Vercel dashboard → Analytics
2. View function execution times, error rates, and bandwidth usage
3. Set up Vercel's Speed Insights for real user metrics

---

## Rollback Strategy

If a deployment breaks:

1. Go to Vercel dashboard → Deployments
2. Find the last working deployment
3. Click the **...** menu → **Promote to Production**
4. The previous version becomes live instantly

---

## Custom Domain (Optional)

To use your own domain:

1. In Vercel project, go to **Settings** → **Domains**
2. Click **Add**
3. Enter your domain name
4. Follow the DNS configuration instructions
5. Update `BETTER_AUTH_URL` to your custom domain
6. Update Google OAuth redirect URIs to use custom domain
7. Redeploy

---

## Security Best Practices

1. **Never commit** `.env` files to git (already in `.gitignore`)
2. **Rotate secrets** periodically (BETTER_AUTH_SECRET, CRON_SECRET)
3. **Use strong** database passwords
4. **Enable** database SSL connections (usually required by default)
5. **Monitor** Vercel logs for suspicious activity
6. **Keep dependencies** updated: `pnpm update`
7. **Enable Vercel's Firewall** (Pro plan) for additional protection

---

## Cost Estimate

### Free Tier Limits (as of 2024)

**Vercel:**
- 100 GB bandwidth per month
- Unlimited API requests
- 100 GB-hours of function execution time
- 12 serverless functions
- 100 cron executions per day

**Database Options:**
- **Neon:** 0.5 GB storage, 3 GB data transfer/month free
- **Supabase:** 500 MB database, 1 GB bandwidth free

Most small to medium applications stay within free tiers.

---

## Advantages of Vercel vs Cloudflare Pages

| Feature | Vercel | Cloudflare Pages |
|---------|--------|------------------|
| **SvelteKit Integration** | Native, zero-config | Requires adapter setup |
| **Cron Jobs** | Built-in, easy setup | Requires separate Worker |
| **Preview Deployments** | Automatic for PRs | Manual or via GitHub integration |
| **Function Timeout (free)** | 10 seconds | 15 seconds |
| **Bundle Size Limit** | None | 25 MB (hard limit) |
| **Edge Network** | Global | Global (slightly larger) |
| **Node.js Support** | Full | Limited (via compat flag) |
| **Database Connections** | Easy with pooling | Can be tricky with cold starts |

---

## Next Steps

After successful deployment:

1. Set up monitoring and alerts via Vercel dashboard
2. Configure custom domain (optional)
3. Enable Vercel Analytics
4. Set up automated backups for your database
5. Configure Vercel's Firewall rules (Pro plan)
6. Set up Vercel Speed Insights for performance monitoring

---

## Support and Resources

- [Vercel Documentation](https://vercel.com/docs)
- [SvelteKit Vercel Adapter Docs](https://kit.svelte.dev/docs/adapter-vercel)
- [Better Auth Documentation](https://better-auth.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Vercel Community Discord](https://vercel.com/discord)

Happy deploying! 🚀
