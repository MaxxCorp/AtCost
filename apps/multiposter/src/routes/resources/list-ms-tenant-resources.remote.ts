import { query } from '$app/server';
import * as v from 'valibot';
import { env } from '$env/dynamic/private';
import { getAuthenticatedUser } from '$lib/server/authorization';
import { db, account, eq, and } from '@ac/db';

const querySchema = v.optional(
    v.object({
        type: v.optional(v.string()),
    }),
    {}
);

export const listMsTenantResources = query(querySchema, async (params) => {
    try {
        const user = getAuthenticatedUser();
        if (!user || !user.id) {
            return { success: false, data: [], error: 'Not authenticated' };
        }

        const requestedType = (params?.type || 'room').toLowerCase();

        const tenantId = env.MICROSOFT_TENANT_ID;
        const clientId = env.MICROSOFT_CLIENT_ID;
        const clientSecret = env.MICROSOFT_CLIENT_SECRET;

        let accessToken: string | null = null;
        let tokenType: 'app' | 'user' = 'app';

        // 1. Try to acquire App-Only access token via client credentials grant
        if (tenantId && clientId && clientSecret) {
            try {
                const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        grant_type: 'client_credentials',
                        scope: 'https://graph.microsoft.com/.default'
                    })
                });

                if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    accessToken = tokenData.access_token;
                    tokenType = 'app';
                } else {
                    console.warn('[MS Tenant Sync] App token acquisition failed:', await tokenResponse.text());
                }
            } catch (err) {
                console.warn('[MS Tenant Sync] App token error:', err);
            }
        }

        // 2. Fallback to user's connected Microsoft account token if available
        if (!accessToken) {
            const [userAccount] = await db
                .select()
                .from(account)
                .where(and(
                    eq(account.userId, user.id as string),
                    eq(account.providerId, 'microsoft')
                ))
                .limit(1);

            if (userAccount?.accessToken) {
                accessToken = userAccount.accessToken;
                tokenType = 'user';
            }
        }

        if (!accessToken) {
            return {
                success: true,
                data: [],
                configured: false,
                message: 'Neither Microsoft tenant env variables nor a connected Microsoft user account are available.'
            };
        }

        let items: Array<{ id: string; displayName: string; emailAddress: string; type: 'room' | 'equipment' }> = [];
        let lastErrorStatus: number | null = null;
        let lastErrorText: string | null = null;

        if (requestedType === 'room') {
            // Attempt 1: Graph Places API (requires Place.Read.All)
            const roomsResponse = await fetch('https://graph.microsoft.com/v1.0/places/microsoft.graph.room', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json'
                }
            });

            if (roomsResponse.ok) {
                const resJson = await roomsResponse.json();
                if (Array.isArray(resJson.value)) {
                    items = resJson.value.map((r: any) => ({
                        id: r.id || r.emailAddress,
                        displayName: r.displayName || r.nickname || r.emailAddress,
                        emailAddress: r.emailAddress || '',
                        type: 'room'
                    }));
                }
            } else {
                lastErrorStatus = roomsResponse.status;
                lastErrorText = await roomsResponse.text();
                console.warn(`[MS Tenant Sync] Places API returned ${roomsResponse.status}: ${lastErrorText}`);

                // Attempt 2: findRooms API (only for user-delegated token with /me context)
                if (tokenType === 'user') {
                    const findRoomsResponse = await fetch('https://graph.microsoft.com/v1.0/me/findRooms', {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            Accept: 'application/json'
                        }
                    });

                    if (findRoomsResponse.ok) {
                        const findJson = await findRoomsResponse.json();
                        if (Array.isArray(findJson.value)) {
                            items = findJson.value.map((r: any) => ({
                                id: r.address || r.name,
                                displayName: r.name || r.address,
                                emailAddress: r.address || '',
                                type: 'room'
                            }));
                            lastErrorStatus = null;
                            lastErrorText = null;
                        }
                    } else {
                        console.warn(`[MS Tenant Sync] findRooms API returned ${findRoomsResponse.status}: ${await findRoomsResponse.text()}`);
                    }
                }
            }
        } else {
            // Equipment items discovery
            const equipResponse = await fetch("https://graph.microsoft.com/v1.0/users?$filter=userType eq 'Member'&$top=100", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json'
                }
            });

            if (equipResponse.ok) {
                const resJson = await equipResponse.json();
                if (Array.isArray(resJson.value)) {
                    items = resJson.value
                        .filter((u: any) => u.mail || u.userPrincipalName)
                        .map((u: any) => ({
                            id: u.id || u.mail || u.userPrincipalName,
                            displayName: u.displayName || u.userPrincipalName,
                            emailAddress: u.mail || u.userPrincipalName,
                            type: 'equipment'
                        }));
                }
            } else {
                lastErrorStatus = equipResponse.status;
                lastErrorText = await equipResponse.text();
                console.warn(`[MS Tenant Sync] Users API for equipment returned ${equipResponse.status}: ${lastErrorText}`);
            }
        }

        if (lastErrorStatus && items.length === 0) {
            if (lastErrorStatus === 403) {
                return {
                    success: false,
                    data: [],
                    error: `403 Forbidden from Microsoft Graph API. Permission 'Place.Read.All' or 'User.Read.All' is required in App Registration with Admin Consent granted.`
                };
            }
            return {
                success: false,
                data: [],
                error: `Microsoft Graph API error (${lastErrorStatus}): ${lastErrorText || 'Failed to list tenant resources'}`
            };
        }

        return {
            success: true,
            data: items,
            configured: true
        };
    } catch (err: any) {
        console.error('[MS Tenant Sync] Exception:', err);
        return {
            success: false,
            data: [],
            error: err.message || 'Failed to list tenant resources'
        };
    }
});
