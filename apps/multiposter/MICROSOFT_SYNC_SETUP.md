# Microsoft Calendar Sync Integration Setup

This guide describes how to configure Microsoft Calendar synchronization for the AC Multiposter application, including OAuth registration and real-time webhook (push) notifications.

## Prerequisites

- Access to the [Microsoft Entra ID admin center](https://entra.microsoft.com/) (formerly Azure Active Directory)
- A publicly accessible URL (for webhooks) or `ngrok` for local development.

---

## 1. Register an Application in Microsoft Entra ID

To enable Microsoft Calendar synchronization, you need to register an application in your Microsoft tenant:

1. Go to the [Microsoft Entra ID admin center](https://entra.microsoft.com/)
2. Navigate to **Identity** → **Applications** → **App registrations**
3. Click **+ New registration**
4. Fill in the details:
   - **Name**: AC Multiposter (or your preferred name)
   - **Supported account types**: "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"
   - **Redirect URI**:
     - Select **Web**
     - Enter: `https://localhost:5173/api/auth/callback/microsoft` (for local development)
     - *Note: You can add more redirect URIs for staging/production later.*
5. Click **Register**

### 2. Configure Authentication

1. In your app's menu, go to **Authentication**
2. Ensure **Allow public client flows** is set to **No** (default)
3. Ensure the Redirect URIs include your local and production callback URLs.

### 3. Create a Client Secret

1. Go to **Certificates & secrets**
2. Click **+ New client secret**
3. Add a description (e.g., "Multiposter Dev Secret") and select an expiration period
4. Click **Add**
5. **CRITICAL**: Copy the **Value** of the secret immediately. You won't be able to see it again.

### 4. Configure API Permissions

1. Go to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Search for and check the following permissions:
   - `openid`
   - `profile`
   - `email`
   - `offline_access` (Required for background synchronization)
   - `Calendars.ReadWrite` (Required to sync calendar events)
6. Click **Add permissions**

---

## 5. Configure Environment Variables

Update your `.env.local` or production environment variables:

```env
# Microsoft OAuth Credentials
MICROSOFT_CLIENT_ID=your-application-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret-value

# Base URL for the app (required for webhooks and auth callbacks)
# Must match your registered redirect URI base
BETTER_AUTH_URL=https://localhost:5173
```

---

## 6. Microsoft Graph Webhooks (Push Notifications)

The application uses Microsoft Graph subscriptions to receive real-time updates when events are created, updated, or deleted in the user's Microsoft Calendar.

### How it Works

1. **Setup**: When a user creates a Microsoft Calendar synchronization, the app registers a subscription with Microsoft Graph.
2. **Validation**: Microsoft sends a POST request to `/api/sync/webhook/microsoft-calendar` with a `validationToken`. The app must respond immediately with that token as plain text.
3. **Notification**: Whenever a change occurs, Microsoft sends a notification payload to the same endpoint.
4. **Renewal**: Microsoft Graph subscriptions expire after a few days (~2.9 days max). The app's background cron job automatically renews these subscriptions.

### Testing Webhooks Locally

Since Microsoft Graph cannot send notifications to `localhost`, you must use a tunnel like `ngrok`:

1. Start your dev server: `pnpm dev`
2. Start ngrok: `ngrok http https://localhost:5173`
3. Copy the ngrok HTTPS URL (e.g., `https://abc-123.ngrok-free.app`)
4. Update your `.env.local`:
   ```env
   SYNC_WEBHOOK_URL=https://abc-123.ngrok-free.app
   ```
5. You DO NOT need to update your Microsoft App Registration Redirect URI if you only set `SYNC_WEBHOOK_URL`. `BETTER_AUTH_URL` can remain as `http://localhost:5173`.
6. Create a new synchronization in the app. The webhook will now be registered using the ngrok URL.

---

## 7. Troubleshooting

### "Invalid Authentication Token"
- Ensure `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` are correct.
- Ensure the user has granted the `offline_access` and `Calendars.ReadWrite` scopes during sign-in.

### Webhook Notifications Not Received
- Ensure `BETTER_AUTH_URL` is set to a publicly accessible HTTPS URL.
- Check the application logs for `Microsoft Graph API Error` during subscription setup.
- Verify that Microsoft can reach your endpoint (use `ngrok` inspect dashboard at `http://127.0.0.1:4040`).

### Subscription Expiration
- Webhooks are renewed automatically by the sync service. Ensure your cron job (if not on Vercel) is correctly calling `/api/sync/renew-webhooks`.
