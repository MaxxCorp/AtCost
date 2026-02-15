# Google Calendar Webhook Integration - Implementation Summary

## Overview

Implemented automatic webhook setup with Google Calendar's push notification API to enable real-time synchronization. When events change in Google Calendar, Google now sends push notifications to the app, triggering automatic syncs.

## What Was Implemented

### 1. Webhook Lifecycle Management

**Service Methods** (`src/lib/server/sync/service.ts`):
- `setupWebhook(configId)` - Registers a webhook with Google Calendar when creating a sync
- `cancelWebhook(configId)` - Stops the webhook when deleting a sync
- `renewWebhooks()` - Renews expiring webhooks (called by cron job)

**Features**:
- Automatically constructs callback URLs based on `BETTER_AUTH_URL`
- Cleans up old webhooks before creating new ones
- Stores webhook subscriptions in the database
- Handles webhook expiration gracefully

### 2. Integration with Sync CRUD Operations

**Sync Creation** (`src/routes/synchronizations/new/create.remote.ts`):
- After creating a sync config, automatically calls `setupWebhook()`
- Only sets up webhooks for `pull` or `bidirectional` sync directions
- Fails gracefully if webhook setup fails (sync still created)

**Sync Deletion** (`src/routes/synchronizations/[id]/delete.remote.ts`):
- Before deleting a sync config, calls `cancelWebhook()` to stop notifications
- Works for both single and bulk delete operations
- Prevents orphaned webhooks

### 3. Automatic Webhook Renewal

**Cron Endpoint** (`src/routes/api/sync/renew-webhooks/+server.ts`):
- POST endpoint to renew webhooks expiring within 24 hours
- Protected with optional `CRON_SECRET` authentication
- Returns JSON with success status

**Vercel Cron** (`vercel.json`):
- Configured to call renewal endpoint daily at midnight UTC
- Schedule: `"0 0 * * *"` (daily)
- Automatic on Vercel deployments

### 4. Google Calendar Provider Updates

**Existing Methods** (`src/lib/server/sync/providers/google-calendar.ts`):
- `setupWebhook(callbackUrl)` - Calls Google's `events.watch()` API
- `renewWebhook(subscription)` - Stops old channel and creates new one
- `cancelWebhook(subscription)` - Calls Google's `channels.stop()` API

**Webhook Properties**:
- Channel ID: Random UUID
- Token: Sync config ID (for verification)
- Type: `web_hook`
- Callback: `{BETTER_AUTH_URL}/api/sync/webhook/google-calendar`
- Expiration: ~7 days (Google's default)

## How It Works

### Webhook Setup Flow

```
User creates sync → Sync config saved to DB → setupWebhook() called
                                              ↓
                                    Google Calendar watch() API
                                              ↓
                                    Webhook subscription created
                                              ↓
                                    Subscription stored in DB
```

### Push Notification Flow

```
Event changes in Google Calendar → Google sends webhook notification
                                              ↓
                                    /api/sync/webhook/google-calendar
                                              ↓
                                    Webhook handler validates headers
                                              ↓
                                    syncService.handleWebhook() called
                                              ↓
                                    Full sync triggered
                                              ↓
                                    Events updated in local DB
```

### Webhook Renewal Flow

```
Daily cron job → /api/sync/renew-webhooks → Find expiring webhooks
                                              ↓
                                    For each subscription:
                                    - Stop old channel (Google API)
                                    - Create new channel (Google API)
                                    - Update DB with new expiration
```

## Configuration Required

### Environment Variables

```env
# Base URL for webhook callbacks (REQUIRED in production)
BETTER_AUTH_URL=https://your-domain.com

# Optional: Protect cron endpoint
CRON_SECRET=your-random-secret-token-here
```

### Production Requirements

1. **Public HTTPS endpoint** - Google requires HTTPS for webhooks
2. **Domain must be accessible** - Google needs to reach your webhook endpoint
3. **Webhook renewal** - Set up cron job (automatic on Vercel)

### Alternative Cron Setup (non-Vercel)

If not using Vercel, configure external cron service:

```bash
# Daily cron job
curl -X POST https://your-domain.com/api/sync/renew-webhooks \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Services: cron-job.org, EasyCron, GitHub Actions, etc.

## Testing

### Webhook Tests Created

1. **Unit Tests** (`webhook.spec.ts`): 10 tests covering handler behavior
2. **Integration Tests** (`webhook-integration.spec.ts`): 9 tests with mock Google Calendar data
3. **Test Documentation** (`TESTING.md`): Manual testing guide with curl examples

### Test Coverage

- Valid webhook notifications (exists/not_exists states)
- Initial verification (sync state)
- Missing authentication (channel token)
- Error handling
- Various event types (timed, all-day, recurring, cancelled)

All 31 server tests passing ✓

## Database Schema

No schema changes required. Uses existing `webhookSubscription` table:

```typescript
{
  id: string (PK)
  syncConfigId: string (FK)
  providerId: string
  resourceId: string  // Google's resource identifier
  channelId: string   // Unique channel identifier
  expiresAt: Date     // When webhook expires (~7 days)
  createdAt: Date
}
```

## Benefits

1. **Real-time sync** - Events sync automatically when changed in Google Calendar
2. **Reduced API calls** - No need to poll; Google pushes changes
3. **Better UX** - Users see changes immediately without manual sync
4. **Automatic maintenance** - Webhooks renewed automatically before expiration
5. **Clean teardown** - Webhooks canceled when syncs deleted

## Limitations & Notes

- Webhooks require HTTPS in production (localhost HTTP works for testing)
- Google Calendar webhooks expire after ~7 days (handled by renewal cron)
- Webhook setup happens async; failures don't block sync creation
- Only works for `pull` and `bidirectional` sync directions
- Webhook notifications don't include change details; triggers full sync

## Documentation Updated

- `README.md` - Added comprehensive "Google Calendar Webhooks" section
- `TESTING.md` - Complete testing guide for webhooks
- `vercel.json` - Cron configuration for automatic renewal

## Security Considerations

1. **Webhook authentication** - Uses sync config ID as verification token
2. **Header validation** - Validates all required Google webhook headers
3. **Cron protection** - Optional `CRON_SECRET` to prevent unauthorized renewal
4. **Database cleanup** - Cascade delete removes webhooks when sync deleted

## Next Steps

For production deployment:

1. Set `BETTER_AUTH_URL` to your production domain
2. Ensure domain is publicly accessible via HTTPS
3. Deploy with Vercel (auto cron) or set up external cron job
4. Optional: Set `CRON_SECRET` for additional security
5. Test webhook flow with real Google Calendar changes
