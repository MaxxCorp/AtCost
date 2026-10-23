import { query } from '$app/server';
import * as v from 'valibot';

import {
    MICROSOFT_TENANT_ID,
    MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET
} from '$app/env/private';

import { getAuthenticatedUser } from '#lib/server/authorization.js';
import { db, account, resource, eq, and } from '@ac/db';

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

        const tenantId = MICROSOFT_TENANT_ID;
        const clientId = MICROSOFT_CLIENT_ID;
        const clientSecret = MICROSOFT_CLIENT_SECRET;

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

        const itemsMap = new Map<string, { id: string; displayName: string; emailAddress: string; type: 'room' | 'equipment' }>();
        let lastErrorStatus: number | null = null;
        let lastErrorText: string | null = null;

        const addItem = (item: { id: string; displayName: string; emailAddress: string; type: 'room' | 'equipment' }) => {
            const key = (item.emailAddress || item.id).toLowerCase().trim();
            if (key && !itemsMap.has(key)) {
                itemsMap.set(key, item);
            }
        };

        if (requestedType === 'room') {
            // Attempt 1: Graph Places API (requires Place.Read.All) with @odata.nextLink pagination
            let nextPlacesUrl: string | null = 'https://graph.microsoft.com/v1.0/places/microsoft.graph.room';
            let placesPages = 0;

            while (nextPlacesUrl && placesPages < 10) {
                placesPages++;
                try {
                    const roomsResponse: Response = await fetch(nextPlacesUrl, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            Accept: 'application/json'
                        }
                    });

                    if (roomsResponse.ok) {
                        const resJson: any = await roomsResponse.json();
                        if (Array.isArray(resJson.value)) {
                            for (const r of resJson.value) {
                                addItem({
                                    id: r.id || r.emailAddress,
                                    displayName: r.displayName || r.nickname || r.emailAddress,
                                    emailAddress: r.emailAddress || '',
                                    type: 'room'
                                });
                            }
                        }
                        nextPlacesUrl = resJson['@odata.nextLink'] || null;
                    } else {
                        lastErrorStatus = roomsResponse.status;
                        lastErrorText = await roomsResponse.text();
                        console.warn(`[MS Tenant Sync] Places API returned ${roomsResponse.status}: ${lastErrorText}`);
                        break;
                    }
                } catch (fetchErr) {
                    console.warn('[MS Tenant Sync] Places API fetch error:', fetchErr);
                    break;
                }
            }

            // Attempt 2: Supplement with findRooms API (which queries Exchange directory directly and sees newly created rooms before Places indexing propagates)
            let userTokenForFindRooms: string | null = tokenType === 'user' ? accessToken : null;
            if (!userTokenForFindRooms && user?.id) {
                const [userAccount] = await db
                    .select()
                    .from(account)
                    .where(and(
                        eq(account.userId, user.id as string),
                        eq(account.providerId, 'microsoft')
                    ))
                    .limit(1);

                if (userAccount?.accessToken) {
                    userTokenForFindRooms = userAccount.accessToken;
                }
            }

            if (userTokenForFindRooms) {
                try {
                    const findRoomsResponse = await fetch('https://graph.microsoft.com/v1.0/me/findRooms', {
                        headers: {
                            Authorization: `Bearer ${userTokenForFindRooms}`,
                            Accept: 'application/json'
                        }
                    });

                    if (findRoomsResponse.ok) {
                        const findJson = await findRoomsResponse.json();
                        if (Array.isArray(findJson.value)) {
                            for (const r of findJson.value) {
                                addItem({
                                    id: r.address || r.name,
                                    displayName: r.name || r.address,
                                    emailAddress: r.address || '',
                                    type: 'room'
                                });
                            }
                            lastErrorStatus = null;
                            lastErrorText = null;
                        }
                    } else {
                        console.warn(`[MS Tenant Sync] findRooms API returned ${findRoomsResponse.status}: ${await findRoomsResponse.text()}`);
                    }
                } catch (findErr) {
                    console.warn('[MS Tenant Sync] findRooms API query error:', findErr);
                }
            }

            // Attempt 3: Supplement with existing local room resources that already have microsoft-calendar configured
            try {
                const localResources = await db
                    .select()
                    .from(resource)
                    .where(eq(resource.type, 'room'));

                for (const lr of localResources) {
                    let cals: any[] = [];
                    if (typeof lr.allocationCalendars === 'string') {
                        try { cals = JSON.parse(lr.allocationCalendars); } catch { cals = []; }
                    } else if (Array.isArray(lr.allocationCalendars)) {
                        cals = lr.allocationCalendars;
                    }

                    for (const cal of cals) {
                        if (cal.provider === 'microsoft-calendar' && cal.calendarId && cal.calendarId.includes('@')) {
                            const email = cal.calendarId.trim();
                            addItem({
                                id: email,
                                displayName: lr.name || cal.name || email,
                                emailAddress: email,
                                type: 'room'
                            });
                        }
                    }
                }
            } catch (dbErr) {
                console.warn('[MS Tenant Sync] Local DB room discovery warning:', dbErr);
            }
        } else {
            // Equipment items discovery with @odata.nextLink pagination
            let nextEquipUrl: string | null = "https://graph.microsoft.com/v1.0/users?$filter=userType eq 'Member'&$top=100";
            let equipPages = 0;

            while (nextEquipUrl && equipPages < 5) {
                equipPages++;
                try {
                    const equipResponse: Response = await fetch(nextEquipUrl, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            Accept: 'application/json'
                        }
                    });

                    if (equipResponse.ok) {
                        const resJson: any = await equipResponse.json();
                        if (Array.isArray(resJson.value)) {
                            for (const u of resJson.value) {
                                if (u.mail || u.userPrincipalName) {
                                    addItem({
                                        id: u.id || u.mail || u.userPrincipalName,
                                        displayName: u.displayName || u.userPrincipalName,
                                        emailAddress: u.mail || u.userPrincipalName,
                                        type: 'equipment'
                                    });
                                }
                            }
                        }
                        nextEquipUrl = resJson['@odata.nextLink'] || null;
                    } else {
                        lastErrorStatus = equipResponse.status;
                        lastErrorText = await equipResponse.text();
                        console.warn(`[MS Tenant Sync] Users API for equipment returned ${equipResponse.status}: ${lastErrorText}`);
                        break;
                    }
                } catch (equipErr) {
                    console.warn('[MS Tenant Sync] Users API equipment error:', equipErr);
                    break;
                }
            }
        }

        const items = Array.from(itemsMap.values()).sort((a, b) =>
            a.displayName.localeCompare(b.displayName)
        );

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
