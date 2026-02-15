# Google Calendar Webhook Testing

This directory contains tests for the Google Calendar webhook integration.

## Test Files

### `webhook.spec.ts`
Unit tests for the webhook endpoint handler. Tests:
- Valid webhook notifications (exists, not_exists states)
- Initial sync verification
- Missing channel token rejection
- Error handling
- Various Google Calendar notification scenarios

### `webhook-integration.spec.ts`
Integration tests with realistic Google Calendar event data. Includes:
- Mock Google Calendar event structures (timed, all-day, recurring, cancelled)
- Event transformation examples
- Webhook notification scenarios

## Running the Tests

```bash
# Run all webhook tests
pnpm test:unit -- src/routes/api/sync/webhook

# Run with watch mode
pnpm test:unit -- src/routes/api/sync/webhook --watch

# Run with coverage
pnpm test:unit -- src/routes/api/sync/webhook --coverage
```

## Manual Testing with curl

### 1. Test Webhook Verification (sync state)
```bash
curl -X POST http://localhost:5173/api/sync/webhook/google-calendar \
  -H "X-Goog-Channel-ID: test-channel-123" \
  -H "X-Goog-Resource-ID: test-resource-456" \
  -H "X-Goog-Resource-State: sync" \
  -H "X-Goog-Channel-Token: your-sync-config-id"
```

Expected response: `OK` (200)

### 2. Test Event Change Notification
```bash
curl -X POST http://localhost:5173/api/sync/webhook/google-calendar \
  -H "X-Goog-Channel-ID: test-channel-123" \
  -H "X-Goog-Resource-ID: test-resource-456" \
  -H "X-Goog-Resource-State: exists" \
  -H "X-Goog-Channel-Token: your-sync-config-id" \
  -H "X-Goog-Message-Number: 1" \
  -v
```

Expected response: `Webhook processed` (200)

This should trigger a sync for the specified config ID.

### 3. Test Event Deletion Notification
```bash
curl -X POST http://localhost:5173/api/sync/webhook/google-calendar \
  -H "X-Goog-Channel-ID: test-channel-123" \
  -H "X-Goog-Resource-ID: test-resource-456" \
  -H "X-Goog-Resource-State: not_exists" \
  -H "X-Goog-Channel-Token: your-sync-config-id" \
  -H "X-Goog-Message-Number: 5" \
  -v
```

Expected response: `Webhook processed` (200)

### 4. Test Missing Token (should fail)
```bash
curl -X POST http://localhost:5173/api/sync/webhook/google-calendar \
  -H "X-Goog-Channel-ID: test-channel-123" \
  -H "X-Goog-Resource-ID: test-resource-456" \
  -H "X-Goog-Resource-State: exists" \
  -v
```

Expected response: `Missing channel token` (400)

## Testing with Postman/Insomnia

Create a new POST request with these headers:

```
POST http://localhost:5173/api/sync/webhook/google-calendar

Headers:
X-Goog-Channel-ID: channel-abc123
X-Goog-Resource-ID: resource-def456
X-Goog-Resource-State: exists
X-Goog-Channel-Token: <your-actual-sync-config-id>
X-Goog-Message-Number: 1
X-Goog-Resource-URI: https://www.googleapis.com/calendar/v3/calendars/primary/events?alt=json
X-Goog-Channel-Expiration: <future-date-RFC2822>
```

## Google Calendar Webhook Headers Reference

| Header | Description | Values |
|--------|-------------|--------|
| `X-Goog-Channel-ID` | Unique channel identifier | UUID string |
| `X-Goog-Resource-ID` | Resource identifier from Google | Opaque string |
| `X-Goog-Resource-State` | Notification state | `sync`, `exists`, `not_exists` |
| `X-Goog-Channel-Token` | Token set during subscription (our sync config ID) | String |
| `X-Goog-Message-Number` | Sequential message number | Integer (increments) |
| `X-Goog-Resource-URI` | URI of the changed resource | URL |
| `X-Goog-Channel-Expiration` | When the channel expires | RFC 2822 date |

## Webhook States

- **`sync`**: Initial verification when webhook is set up (we just acknowledge)
- **`exists`**: Resource changed (new event or updated event) - triggers sync
- **`not_exists`**: Resource deleted (event removed) - triggers sync

## Monitoring Webhook Activity

Check the server logs for webhook activity:

```
Google Calendar webhook received: {
  channelId: 'channel-abc123',
  resourceId: 'resource-def456',
  resourceState: 'exists',
  channelToken: 'sync-config-id-123'
}
```

Followed by sync operation logs:
```
[SyncService] Sync completed successfully: { pulled: 5, pushed: 0, errors: [] }
```

## Testing Real Google Calendar Webhooks

To test with real Google Calendar notifications:

1. Set up a sync configuration in the app
2. Enable webhooks for that configuration
3. Make changes in your Google Calendar:
   - Create a new event
   - Modify an existing event
   - Delete an event
4. Watch the server logs for incoming webhook notifications
5. Verify events are synced correctly in the app

## Troubleshooting

### Webhook not triggering sync
- Check that the `X-Goog-Channel-Token` matches a valid sync config ID
- Verify the sync config is enabled in the database
- Check server logs for error messages

### 400 Bad Request
- Ensure `X-Goog-Channel-Token` header is present
- Verify all required headers are included

### 500 Internal Server Error
- Check database connectivity
- Verify OAuth credentials are valid
- Check sync service logs for specific errors
