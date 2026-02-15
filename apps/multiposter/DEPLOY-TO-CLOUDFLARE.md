
# Deploying AC Multiposter to Cloudflare Pages

This guide walks you through deploying your AC Multiposter application to Cloudflare Pages with a Postgres database and Cloudflare Cron Triggers for webhook renewal.

## Prerequisites

- A Cloudflare account (free tier works)
- A Postgres database (see Database Options below)
- Google OAuth credentials configured
- Your GitHub repository pushed to GitHub

## Table of Contents

1. [Database Setup](#1-database-setup)
2. [Cloudflare Pages Setup](#2-cloudflare-pages-setup)
3. [Environment Variables](#3-environment-variables)
4. [Google OAuth Configuration](#4-google-oauth-configuration)
5. [Database Migration](#5-database-migration)
6. [Cloudflare Cron Jobs](#6-cloudflare-cron-jobs-webhook-renewal)
7. [Testing Your Deployment](#7-testing-your-deployment)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Database Setup

You need a Postgres database accessible from the internet. Choose one of these options:

### Option A: Neon (Recommended - Free Tier Available)

1. Go to [neon.tech](https://neon.tech)
2. Sign up and create a new project
3. Create a database
4. Copy the connection string (starts with `postgresql://`)

### Option B: Supabase (Free Tier Available)

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings** → **Database**
4. Copy the connection string (use the "Connection pooling" one for better performance)

### Option C: Railway, Render, or other providers

Follow their documentation to create a Postgres database and obtain the connection string.

---

## 2. Cloudflare Pages Setup

### Step 1: Create Wrangler Configuration

Before connecting to Cloudflare, create a `wrangler.json` file in your project root:

```json
{
	"$schema": "./node_modules/wrangler/config-schema.json",
	"name": "ac-multiposter",
	"pages_build_output_dir": ".svelte-kit/cloudflare",
	"compatibility_date": "2025-01-01",
	"compatibility_flags": ["nodejs_compat"]
}
```

> **Important:** This configuration is required for Cloudflare Pages:
> - `pages_build_output_dir`: Tells Cloudflare where to find the built output (`.svelte-kit/cloudflare`)
> - `compatibility_flags: ["nodejs_compat"]`: Enables Node.js built-in modules (required for `googleapis`, `better-auth`, `pg`)
> - `compatibility_date`: Specifies which Workers runtime version to use

Without `nodejs_compat`, the build will fail with errors like "Could not resolve 'crypto'" or "Could not resolve 'http'".

**SvelteKit Configuration:** The adapter is configured in `svelte.config.js` to reference this file:

```js
adapter: adapter({
	config: 'wrangler.json',
	platformProxy: {
		persist: true
	}
})
```

This enables:
- Cloudflare platform emulation during local development
- Proper wrangler configuration detection during build
- Access to `platform.env` bindings in dev mode

### Step 2: Connect Your Repository

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **Workers & Pages** → **Create application**
3. Select **Pages** tab
4. Click **Connect to Git**
5. Authorize Cloudflare to access your GitHub account
6. Select your `ac-multiposter` repository
7. Click **Begin setup**

### Step 2: Configure Build Settings

On the setup page, configure:

- **Production branch**: `main` (or your default branch)
- **Framework preset**: Select "SvelteKit"
- **Build command**: `pnpm build` (per SvelteKit docs, this runs `vite build`)
- **Build output directory**: `.svelte-kit/cloudflare`

**Important Build Settings (from latest SvelteKit docs):**

- You can use either `npm run build` or `vite build` (we use `pnpm build` which calls `vite build`).
- The output directory must be `.svelte-kit/cloudflare`.
- The Framework preset should be "SvelteKit" so Pages recognizes the project.
- Optional: Set `NODE_VERSION=20` in build env vars if your dependencies require it.
- **The `wrangler.jsonc` file enables Node.js compatibility automatically** - no additional build configuration needed.

Click **Save and Deploy** (it will fail initially - that's okay, we need to add environment variables first)

---

## 3. Environment Variables

### Step 1: Add Environment Variables in Cloudflare

1. In your Cloudflare Pages project, go to **Settings** → **Environment variables**
2. Add the following variables for **Production** environment:

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | Your Postgres connection string | `postgresql://user:pass@host:5432/dbname` |
| `BETTER_AUTH_SECRET` | Random secure string (32+ characters) | Use: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Your Cloudflare Pages URL | `https://ac-multiposter.pages.dev` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console | `GOCSPX-xxx` |
| `MICROSOFT_CLIENT_ID` | (Optional) From Azure | `xxx` |
| `MICROSOFT_CLIENT_SECRET` | (Optional) From Azure | `xxx` |
| `CRON_SECRET` | Random secure string for cron auth | Use: `openssl rand -base64 32` |

**To generate secure secrets on Windows:**

```powershell
# Using PowerShell
$bytes = New-Object byte[] 32
(New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

### Step 2: Note Your Cloudflare Pages URL

After deployment, Cloudflare assigns a URL like:
- `https://ac-multiposter.pages.dev` (main production)
- Or `https://[deployment-id].ac-multiposter.pages.dev` (preview deployments)

You'll need this for the next step.

---

## 4. Google OAuth Configuration

### Update Authorized Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://ac-multiposter.pages.dev/api/auth/callback/google
   ```
   (Replace with your actual Cloudflare Pages domain)
5. Click **Save**

### Update Authorized JavaScript Origins (if needed)

Add your Cloudflare Pages domain:
```
https://ac-multiposter.pages.dev
```

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
   pnpm db:migrate
   # or
   pnpm db:push
   ```

3. **Restore your local `.env`** to use your local database

### Option B: Use Database GUI

Most database providers (Neon, Supabase, Railway) provide a SQL editor. Copy and run the migration files from the `drizzle/` directory in order:

1. `0000_tan_chat.sql`
2. `0001_flippant_shotgun.sql`
3. (And so on, in numerical order)

---

## 6. Cloudflare Cron Jobs (Webhook Renewal)

Google Calendar webhooks expire after ~7 days and need renewal. **Cloudflare Pages does NOT support cron triggers directly** - you must create a separate Worker with a cron trigger.

### Option A: Use Cloudflare Workers (Recommended)

Create a Cloudflare Worker with a scheduled event handler:

#### Step 1: Create a new Worker

1. In Cloudflare Dashboard, go to **Workers & Pages** → **Create application**
2. Select **Create Worker**
3. Name it `ac-multiposter-cron` (or similar)
4. Click **Deploy**

#### Step 2: Edit Worker Code

1. Click **Edit Code**
2. Replace the default code with:

```javascript
export default {
  async scheduled(event, env, ctx) {
    try {
      const response = await fetch('https://ac-multiposter.pages.dev/api/sync/renew-webhooks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CRON_SECRET}`
        }
      });
      
      console.log('Webhook renewal response:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('Webhook renewal failed:', text);
      }
    } catch (error) {
      console.error('Webhook renewal error:', error);
    }
  },
};
```

3. Click **Save and Deploy**

#### Step 3: Add Environment Variable

1. Go to **Settings** → **Variables**
2. Under **Environment Variables**, click **Add variable**
3. Name: `CRON_SECRET`
4. Value: Same value as `CRON_SECRET` in your Pages project
5. Click **Deploy**

#### Step 4: Configure Cron Trigger

1. Go to **Triggers** tab
2. Scroll down to **Cron Triggers**
3. Click **Add Cron Trigger**
4. Enter schedule: `0 0 * * *` (runs daily at midnight UTC)
5. Click **Add Trigger**

The cron trigger will now call your Pages webhook renewal endpoint daily.

**Note:** Changes to cron triggers may take up to 15 minutes to propagate.

### Option B: Use External Cron Service

If you prefer not to use a Worker, use an external service like:
- [cron-job.org](https://cron-job.org) (free)
- [EasyCron](https://www.easycron.com) (free tier available)
- GitHub Actions (if your repo is on GitHub)

Configure it to make a POST request:
```bash
curl -X POST https://ac-multiposter.pages.dev/api/sync/renew-webhooks \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Schedule: Daily (cron expression: `0 0 * * *`)

---

## 7. Testing Your Deployment

### Local testing with Wrangler (optional)

After running a build, you can emulate Cloudflare locally:

- For Cloudflare Pages:
  ```powershell
  wrangler pages dev .svelte-kit/cloudflare
  ```
- For Cloudflare Workers:
  ```powershell
  wrangler dev .svelte-kit/cloudflare
  ```

This uses the generated worker output and helps validate routing and runtime behaviour before deploying.

### Step 1: Trigger a Deployment

After adding all environment variables:

1. Go to **Deployments** in your Cloudflare Pages project
2. Click **Retry deployment** on the failed deployment
3. Or push a new commit to trigger a fresh deployment

### Step 2: Monitor Build Logs

Watch the build logs to ensure:
- ✅ Dependencies install successfully
- ✅ Build completes without errors
- ✅ Deployment succeeds

### Step 3: Test the Application

1. Visit your Cloudflare Pages URL
2. Click **Sign In** and test Google OAuth
3. Grant yourself admin access (see [Granting Access](#granting-initial-admin-access) below)
4. Test creating events, campaigns, and synchronizations
5. Verify webhook registration works (check logs in Pages Functions)

### Granting Initial Admin Access

After your first sign-in, you need to grant admin access:

1. Connect to your production database using a SQL client
2. Run:
   ```sql
   UPDATE "user"
   SET roles = '["admin"]'
   WHERE email = 'your-email@example.com';
   ```
3. Refresh the app - you should now see all features

---

## 8. Troubleshooting

### "Could not resolve" Node.js modules (crypto, http, etc.)

**Problem:** Build fails with 66+ errors like:
- `Could not resolve "http"`
- `Could not resolve "crypto"`
- `Could not resolve "stream"`
- "The package 'crypto' wasn't found on the file system but is built into node."

**Solution:** Create a `wrangler.json` file in your project root (already included in this repo):

```json
{
	"$schema": "./node_modules/wrangler/config-schema.json",
	"name": "ac-multiposter",
	"pages_build_output_dir": ".svelte-kit/cloudflare",
	"compatibility_date": "2025-01-01",
	"compatibility_flags": ["nodejs_compat"]
}
```

**Key requirements for Cloudflare Pages:**
- `pages_build_output_dir` is required - tells Cloudflare where the built files are
- `compatibility_flags: ["nodejs_compat"]` enables Node.js built-in modules in Cloudflare Workers
- This is required for: `googleapis`, `better-auth`, `pg`, and `postgres` (database clients)

After adding/verifying the file, commit and push to trigger a new deployment.

### "No adapter specified" during build

**Problem:** Build fails with:
- `No adapter specified`
- `Output directory ".svelte-kit/cloudflare" not found.`

**Solution:** Ensure the Cloudflare adapter is configured inside the `kit` block in `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-cloudflare'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter()
  }
}
export default config
```

Then re-run the build (`pnpm build`) and redeploy.

### Build Fails with Node.js Version Error

**Problem:** "Error: The engine "node" is incompatible with this module"

**Solution:** Add environment variable in Cloudflare:
- `NODE_VERSION` = `20`

### Database Connection Errors

**Problem:** Build fails with "DATABASE_URL is not set" even though it's configured in Cloudflare Pages

**Root Cause:** Environment variables set in Cloudflare Pages "Variables and Secrets" are only available at **runtime**, not during the **build phase**. If your code tries to access env vars at the module top-level during build, it will fail.

**Solution:** The database connection has been updated to use **lazy initialization**:

```typescript
// src/lib/server/db/index.ts
// Lazy initialization - only create connection when db is actually accessed
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
	if (!_db) {
		if (!env.DATABASE_URL) {
			throw new Error('DATABASE_URL is not set');
		}
		const client = postgres(env.DATABASE_URL);
		_db = drizzle(client, { schema });
	}
	return _db;
}

// Export a Proxy that lazily initializes the connection
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
	get(target, prop) {
		return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>];
	}
});
```

This pattern:
1. **During build**: The `db` export is created but doesn't access `DATABASE_URL` yet
2. **At runtime**: When you first use `db.query...`, it initializes the connection with the actual environment variable

The `drizzle.config.ts` also uses a placeholder during build since it's only needed for CLI commands (`pnpm db:migrate`, etc.), not for building the app.

**Other database connection issues:**
- Verify `DATABASE_URL` is set correctly in Cloudflare Pages environment variables
- Ensure the database allows connections from Cloudflare IPs (most providers allow all IPs by default)
- For Neon/Supabase, use connection pooling URL if available
- Check if your database requires SSL (most do - this is handled automatically)

### OAuth Redirect Errors

**Problem:** "redirect_uri_mismatch" from Google

**Solution:**
- Ensure redirect URI in Google Console exactly matches: `https://your-domain.pages.dev/api/auth/callback/google`
- No trailing slashes
- Must be HTTPS
- Must match your `BETTER_AUTH_URL`

### Webhook Registration Fails

**Problem:** "Bad webhook address" or webhook setup errors

**Solutions:**
- Ensure `BETTER_AUTH_URL` is set to your public Cloudflare Pages domain
- Must be HTTPS
- Domain must be publicly accessible
- Test the webhook endpoint manually: `https://your-domain.pages.dev/api/sync/webhook/google-calendar`

### Functions Timeout

**Problem:** "Worker exceeded CPU time limit"

**Solutions:**
- Cloudflare Pages Functions have a 15-second timeout on free tier
- For long-running syncs, consider breaking them into smaller operations
- Check if database queries are optimized
- Consider upgrading to Workers Paid plan for longer timeouts

### Environment Variables Not Loading

**Problem:** App behaves as if environment variables are missing

**Solutions:**
- Redeploy after adding environment variables
- Check that variables are added to "Production" environment, not "Preview"
- Cloudflare Pages requires redeployment to pick up new environment variables

### Cron Job Not Running

**Problem:** Webhooks not being renewed

**Solutions:**
- Check Worker logs in Cloudflare Dashboard
- Verify `CRON_SECRET` matches between Worker and Pages project
- Test the endpoint manually with curl
- Ensure Worker has the correct URL

---

## Custom Domain (Optional)

To use your own domain:

1. In Cloudflare Pages project, go to **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain (must be using Cloudflare DNS)
4. Follow the verification steps
5. Update `BETTER_AUTH_URL` to your custom domain
6. Update Google OAuth redirect URI to use custom domain
7. Redeploy

---

## Performance Optimization

### Enable Caching

Cloudflare automatically caches static assets. For API routes:

1. Add appropriate Cache-Control headers in your API routes
2. Use Cloudflare Page Rules for additional caching

### Database Connection Pooling

Use connection pooling for better database performance:
- **Neon**: Use the "Pooled connection" string
- **Supabase**: Use the "Connection pooling" string with port 6543

### Monitoring

Enable Cloudflare Analytics:
1. Go to your Pages project
2. Click **Analytics**
3. View requests, errors, and performance metrics

---

## Rollback Strategy

If a deployment breaks:

1. Go to **Deployments**
2. Find the last working deployment
3. Click **...** → **Rollback to this deployment**
4. Or use **Rollback** button on the failed deployment

---

## Security Best Practices

1. **Never commit** `.env` files to git (already in `.gitignore`)
2. **Rotate secrets** periodically (BETTER_AUTH_SECRET, CRON_SECRET)
3. **Use strong** database passwords
4. **Enable** database SSL connections
5. **Restrict** database access to specific IPs if possible
6. **Monitor** Cloudflare logs for suspicious activity
7. **Keep dependencies** updated: `pnpm update`

---

## Cost Estimate

### Free Tier Limits (as of 2025)

**Cloudflare Pages:**
- Unlimited requests
- 500 builds per month
- 100,000 Functions requests per day
- First 100,000 requests/day are free

**Database Options:**
- **Neon**: 0.5GB storage, 3GB data transfer/month free
- **Supabase**: 500MB database, 1GB bandwidth free

Most small to medium applications stay within free tiers.

---

## Support and Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [SvelteKit Cloudflare Adapter Docs](https://kit.svelte.dev/docs/adapter-cloudflare)
- [Better Auth Documentation](https://better-auth.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

---

## Next Steps

After successful deployment:

1. Set up monitoring and alerts
2. Configure custom domain (optional)
3. Set up staging environment for testing
4. Enable Cloudflare Web Analytics
5. Configure caching strategies
6. Set up automated backups for your database

Happy deploying! 🚀
