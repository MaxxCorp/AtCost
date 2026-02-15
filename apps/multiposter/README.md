# AC Multiposter – Developer Quickstart

This is a SvelteKit app that manages Campaigns and Calendar Events with RBAC using Better Auth and a Postgres database via Drizzle ORM.

What you’ll set up:
- SvelteKit dev server
- Postgres connection and migrations (Drizzle)
- Better Auth with Google and/or Microsoft sign-in
- Admin/claims to unlock features (Events, Campaigns, Synchronizations)

## Prerequisites

- Node.js 20+ (LTS) or 22+
- PNPM or NPM (examples below use PNPM)
- A Postgres database (local or remote)
- OAuth credentials (at least one):
	- Google OAuth Client ID/Secret
	- Microsoft Entra ID (Azure) App with Client ID/Secret

## Setting up Google OAuth (Required for Calendar Sync)

To enable Google Calendar synchronization, you need to create a Google Cloud project and configure OAuth credentials:

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "AC Multiposter Dev") and click "Create"
4. Wait for the project to be created and select it

### 2. Enable Google Calendar API

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it and click **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (for testing) and click **Create**
3. Fill in the required fields:
   - **App name**: AC Multiposter (or your app name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**
5. On the **Scopes** page:
   - Click **Add or Remove Scopes**
   - Search for and add these scopes:
     - `openid`
     - `profile`
     - `email`
     - `https://www.googleapis.com/auth/calendar` (Google Calendar API)
   - Click **Update** and then **Save and Continue**
6. On the **Test users** page (for testing stage):
   - Click **Add Users**
   - Enter the email addresses that will test the app (including your own)
   - Click **Add** and then **Save and Continue**
7. Review the summary and click **Back to Dashboard**

### 4. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application** as the application type
4. Enter a name (e.g., "AC Multiposter Local Dev")
5. Under **Authorized redirect URIs**, add:
   - `https://localhost:5173/api/auth/callback/google` (HTTPS required for webhooks)
   - (Add additional URIs for staging/production as needed)
6. Click **Create**
7. Copy the **Client ID** and **Client Secret** - you'll need these for your `.env.local` file

**Note:** The dev server runs with HTTPS using a self-signed certificate. This is required for Google Calendar webhooks to work locally.

### 5. Add Credentials to Environment

Add the credentials to your `.env.local` file:

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
BETTER_AUTH_URL=https://localhost:5173
```

### Testing Stage Notes

- While your app is in **Testing** status (not published), only users added to the Test users list can sign in
- You can add up to 100 test users
- Test users won't see the "This app isn't verified" warning
- For production, you'll need to submit your app for verification or publish it

## 1) Install dependencies

```powershell
pnpm install
```

## 2) Configure environment

Create a `.env.local` file in the project root with at least:

```env
DATABASE_URL=postgres://USER:PASS@localhost:5432/ac_multiposter

# URL your app will run on locally (HTTPS for webhook testing)
BETTER_AUTH_URL=https://localhost:5173

# OAuth providers (pick at least one and fill in values)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

Notes:
- `DATABASE_URL` is required. The app will throw if it's missing.
- `BETTER_AUTH_URL` should be **`https://localhost:5173`** for local dev (required for Google Calendar webhooks)
- The dev server runs with HTTPS using `vite-plugin-mkcert` (automatic self-signed certificate)
- OAuth callback URLs to configure with your providers:
	- Google: `https://localhost:5173/api/auth/callback/google` (use HTTPS)
	- Microsoft: `https://localhost:5173/api/auth/callback/microsoft` (use HTTPS)
	- Microsoft scope used: `Calendars.ReadWrite` and `offline_access`

Notes:
- `DATABASE_URL` is required. The app will throw if it's missing.
- `BETTER_AUTH_URL` should be **`https://localhost:5173`** for local dev (required for Google Calendar webhooks)
- The dev server runs with HTTPS using `vite-plugin-mkcert` (automatic self-signed certificate)
- OAuth callback URLs to configure with your providers (must use HTTPS):
	- Google: `https://localhost:5173/api/auth/callback/google`
	- Microsoft: `https://localhost:5173/api/auth/callback/microsoft`
	- Microsoft scope used: `Calendars.ReadWrite` and `offline_access`

## 3) Initialize the database

Run migrations to create tables and bring the DB up to date:

```powershell
pnpm db:migrate
# or (if you prefer schema sync)
pnpm db:push
```

Optional (visualize your schema):

```powershell
pnpm db:studio
```

## 4) Start the app

```powershell
pnpm dev
```

Visit https://localhost:5173 and use the "Sign In" menu in the header to authenticate with Google or Microsoft.

**Note:** Your browser may show a security warning about the self-signed certificate. This is expected - click "Advanced" and "Proceed to localhost" to continue.

## 5) Grant yourself access (roles/claims)

Access is controlled by roles and claims on the user record managed by Better Auth.

Where these live: Better Auth persists the user (and the extra fields below) in your Postgres DB via Drizzle. After your first sign-in, locate your user in the auth tables and set:

- roles: an array or a JSON string of roles. If it contains `admin`, you have access to all features.
- claims: a JSON object (or JSON string) of booleans per feature key.

Accepted formats by the app:
- Roles: `['admin']` OR `'["admin"]'`
- Claims: `{ "events": true, "campaigns": true, "synchronizations": false }` OR the same object as a string

Typical ways to set them:
- Using your DB client (or Drizzle Studio), update your user row’s `roles` and `claims` columns.
- Examples (adjust table/column names to your DB, as Better Auth may name the table `user`):

```sql
-- Grant admin (full access)
UPDATE "user"
SET roles = '["admin"]'
WHERE email = 'you@example.com';

-- Or set per-feature claims (no admin)
UPDATE "user"
SET claims = '{"events":true,"campaigns":true,"synchronizations":false}'
WHERE email = 'you@example.com';
```

After setting roles/claims, refresh the app. The homepage cards will appear according to your access.

## How authorization works (quick tour)

Core file: `src/lib/authorization.ts`
- `parseRoles(user)`: returns a string[] whether roles is stored as an array or JSON string
- `parseClaims(user)`: returns an object (or null) whether claims is stored as an object or JSON string
- `hasAccess(user, feature)`: true if `roles` contains `admin` OR if `claims[feature]` is true
- `ensureAccess(user, feature)`: throws `Unauthorized` if `hasAccess` is false

Usage in endpoints/remotes:
- First, get the session user: `getAuthenticatedUser()` (e.g. `src/routes/events/auth.ts` or `src/routes/campaigns/auth.ts`)
- Then gate the operation: `ensureAccess(user, 'events')` (or `'campaigns'`, `'synchronizations'`)

## The Features system (metadata-driven UI)

Core file: `src/lib/features.ts`
- `FEATURES`: metadata list of features powering the homepage cards
- Each item has `key`, `title`, `description`, `href`, `buttonText`, and styling/icon metadata
- The `key` must match the `Feature` union in `authorization.ts` and the per-feature claim key
- `getVisibleFeatures(user, hasAccess)`: filters and sorts the list for the logged-in user

UI wiring:
- The homepage (`src/routes/+page.svelte`) renders cards by iterating the filtered features list
- Icons live in `src/lib/icons.ts`
- Card component: `src/lib/components/ui/DashboardCard.svelte`

Adding a new feature:
1. Add a new key to `Feature` in `src/lib/authorization.ts`
2. Add a new entry to `FEATURES` in `src/lib/features.ts` with the same `key`
3. Build your routes/logic under `/src/routes/<your-feature>`
4. Grant claims or admin to see it on the homepage

## Testing

- Run server-side unit tests only (fast path):

```powershell
pnpm test:unit -- --run --project server
```

- If you want to run browser tests too, first install browsers:

```powershell
npx playwright install
pnpm test
```

## Troubleshooting

- 500 Unauthorized from an endpoint
	- Ensure you’re signed in (session cookies present)
	- Check `DATABASE_URL` is set and reachable
	- Verify your user’s `roles` or `claims` in the DB
	- Ensure OAuth callback URLs match `BETTER_AUTH_URL` and provider settings

- Events/Campaigns features not visible
	- You may be signed in, but your user lacks the claims
	- Set `roles` to `['admin']` (full access) or toggle specific claims in the DB

- Social sign-in doesn't redirect correctly
	- Ensure your provider app's redirect URIs are set to `https://localhost:5173/api/auth/callback/<provider>`
	- Confirm `BETTER_AUTH_URL` is `https://localhost:5173` during local development

## Google Calendar Webhooks (Push Notifications)

**Important: Google Calendar webhooks require HTTPS.** The dev server is configured to run with HTTPS using `vite-plugin-mkcert` for automatic self-signed certificates. This is essential for testing synchronizations locally.

The app automatically sets up webhooks with Google Calendar when you create a synchronization with **pull** or **bidirectional** direction. This allows Google Calendar to push updates to your app when events change on their side.

### How it works

1. **Webhook Setup**: When you create a sync, the app calls Google's `watch()` API to register a webhook
2. **Push Notifications**: Google sends notifications to `/api/sync/webhook/google-calendar` when events change
3. **Automatic Sync**: The webhook handler triggers a sync to pull the latest changes
4. **Webhook Renewal**: Webhooks expire after ~7 days, so they need to be renewed periodically

### Webhook Endpoint Requirements

For webhooks to work, your app must:

1. **Use HTTPS** - Google Calendar webhooks **require HTTPS**
2. **Be publicly accessible** - Google needs to reach your webhook endpoint (localhost won't work)
3. **Have the correct `BETTER_AUTH_URL`**:
   ```env
   # Production
   BETTER_AUTH_URL=https://your-domain.com
   
   # Local development with ngrok (see below)
   BETTER_AUTH_URL=https://your-unique-id.ngrok-free.app
   ```

### Testing Webhooks Locally with ngrok

Since Google can't reach localhost, you need to expose your local server using a tunnel service like ngrok:

#### 1. Install ngrok

Download from [ngrok.com](https://ngrok.com/download) or use a package manager:

```powershell
# Windows (using Chocolatey)
choco install ngrok

# Or download directly from ngrok.com
```

#### 2. Start your dev server

```powershell
pnpm dev
```

Your app runs at `https://localhost:5173`

#### 3. Start ngrok tunnel

In a separate terminal:

```powershell
ngrok http https://localhost:5173
```

**Important:** Note the HTTPS URL ngrok provides (e.g., `https://abc123.ngrok-free.app`)

#### 4. Update your environment

Update `.env` with the ngrok URL:

```env
BETTER_AUTH_URL=https://abc123.ngrok-free.app
```

Restart your dev server to pick up the new URL.

#### 5. Update Google OAuth redirect URI

In Google Cloud Console, add the ngrok URL to authorized redirect URIs:
- `https://abc123.ngrok-free.app/api/auth/callback/google`

#### 6. Create synchronization

Now when you create a sync, the webhook will be registered with the ngrok URL, and Google can send notifications to it.

**Note:** Free ngrok URLs change each time you restart ngrok. For persistent URLs, consider:
- ngrok paid plan (persistent domains)
- Deployment to a staging environment
- Other tunnel services like localtunnel, Cloudflare Tunnel

### Automatic Webhook Renewal

Webhooks are automatically renewed daily via a cron job. Two options:

#### Option 1: Vercel Cron (Recommended if hosting on Vercel)

The included `vercel.json` configures a daily cron job automatically. No additional setup needed.

#### Option 2: External Cron Service

If not using Vercel, set up an external cron job to call the renewal endpoint:

1. Set a secret token in your environment:
   ```env
   CRON_SECRET=your-random-secret-token-here
   ```

2. Configure a cron service (cron-job.org, EasyCron, GitHub Actions) to call daily:
   ```bash
   curl -X POST https://your-domain.com/api/sync/renew-webhooks \
     -H "Authorization: Bearer your-random-secret-token-here"
   ```

### Manual Testing with curl

Once your webhook is set up (via ngrok or production deployment), you can manually test the endpoint. See `src/routes/api/sync/webhook/google-calendar/TESTING.md` for comprehensive testing instructions including:
- Manual testing with curl
- Automated test suite  
- Webhook header reference
- Troubleshooting guide

**Note:** The automated test suite runs without needing ngrok, but real webhook notifications from Google require a publicly accessible URL.

### Webhook Cleanup

Webhooks are automatically canceled when you delete a synchronization. This prevents orphaned webhooks and unnecessary notifications.
