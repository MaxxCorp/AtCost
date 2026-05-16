# Microsoft Graph Calendar Webhook Testing

This guide describes how to test the Microsoft Graph webhook integration, including the validation token challenge and change notifications.

## Testing with curl

### 1. Test Subscription Validation Challenge

When you first set up a subscription, Microsoft sends a request to verify your endpoint. You must respond with the `validationToken` as plain text.

```bash
curl -X POST "http://localhost:5173/api/sync/webhook/microsoft-calendar?validationToken=test-token-12345" \
  -v
```

**Expected Response:**
- Status: `200 OK`
- Body: `test-token-12345` (plain text)
- Content-Type: `text/plain`

---

### 2. Test Change Notification (POST with JSON)

After a subscription is active, Microsoft sends change notifications as JSON in the request body.

```bash
curl -X POST http://localhost:5173/api/sync/webhook/microsoft-calendar \
  -H "Content-Type: application/json" \
  -d '{
    "value": [
      {
        "subscriptionId": "sub-uuid-123",
        "clientState": "your-sync-config-id",
        "changeType": "updated",
        "resource": "Users/me/Events/event-id-abc",
        "resourceData": {
          "@odata.type": "#Microsoft.Graph.Event",
          "@odata.id": "Users/me/Events/event-id-abc",
          "id": "event-id-abc"
        }
      }
    ]
  }' \
  -v
```

**Expected Response:**
- Status: `202 Accepted`

This should trigger an asynchronous sync for all enabled Microsoft Calendar configurations in the system.

---

### 3. Test Multiple Notifications

Microsoft may batch multiple changes in a single request.

```bash
curl -X POST http://localhost:5173/api/sync/webhook/microsoft-calendar \
  -H "Content-Type: application/json" \
  -d '{
    "value": [
      {
        "subscriptionId": "sub-1",
        "changeType": "created",
        "resourceData": { "id": "event-1" }
      },
      {
        "subscriptionId": "sub-1",
        "changeType": "deleted",
        "resourceData": { "id": "event-2" }
      }
    ]
  }' \
  -v
```

---

## Testing Real Microsoft Graph Webhooks

1. Use `ngrok` to expose your local server (see `MICROSOFT_SYNC_SETUP.md`).
2. Update `BETTER_AUTH_URL` and your Microsoft App redirect URIs.
3. Create a Microsoft Calendar synchronization in the AC Multiposter UI.
4. Open your Microsoft Outlook Calendar and:
   - Create a new event.
   - Update an existing event.
   - Delete an event.
5. Check your local server logs for incoming webhook notifications.
6. Verify that the changes are reflected in the application's events list.

## Troubleshooting

### Endpoint Returns 500
- Check if the JSON payload is valid.
- Ensure the `syncService` is initialized correctly.
- Verify database connectivity.

### No Sync Triggered
- Ensure your Microsoft synchronization is "Enabled" in the app.
- Check server logs for any errors during the `handleWebhook` call.
