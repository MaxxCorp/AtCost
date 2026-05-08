import { query } from '$app/server';
import { db } from '@ac/db';
import { getOptionalUser, hasAccess } from '$lib/server/authorization';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

/**
 * Query: Read a contact by ID
 * 
 * Access rules:
 * - If contact is public: anyone can view (but only work info, no relations)
 * - If contact is private: only authenticated users with 'contacts' access can view
 * 
 * For public contacts accessed by unauthenticated/unauthorized users:
 * - Filter to only work emails, phones, addresses
 * - Remove relations
 * - Show public versions of QR code and vCard
 */
export const readContact = query(v.string(), async (id: string): Promise<any> => {
    // First fetch the contact to check if it's public
    const result = await db.query.contact.findFirst({
        where: (table, { eq }) => eq(table.id, id),
        with: {
            emails: true,
            phones: true,
            addresses: true,
            locationAssociations: {
                with: {
                    location: true
                }
            },
            relations: {
                with: {
                    targetContact: true
                }
            },
            tags: {
                with: {
                    tag: true
                }
            }
        }
    });

    if (!result) return null;

    // Check access based on public flag
    const user = getOptionalUser();
    const isAuthorized = user && hasAccess(user, 'contacts');

    if (!result.isPublic) {
        // Private contact: require authentication and authorization
        if (!user) {
            error(403, 'Authentication required to view this contact');
        }
        if (!isAuthorized) {
            error(403, 'You do not have permission to view this contact');
        }
    }

    // For public contacts viewed by unauthenticated/unauthorized users, filter data
    if (result.isPublic && !isAuthorized) {
        // Filter to only work type items
        const workEmails = result.emails?.filter((e: any) => e.type?.toLowerCase() === 'work') || [];
        const workPhones = result.phones?.filter((p: any) => p.type?.toLowerCase() === 'work') || [];
        const workAddresses = result.addresses?.filter((a: any) => a.type?.toLowerCase() === 'work') || [];
        // Use dynamic API paths
        let publicQrCodePath = result.qrCodePath;
        let publicVCardPath = result.vCardPath;

        // Ensure paths point to the dynamic API
        if (!publicQrCodePath || !publicQrCodePath.includes('/api/')) {
            publicQrCodePath = `/api/contacts/${id}/qr.png`;
        }
        if (!publicVCardPath || !publicVCardPath.includes('/api/')) {
            publicVCardPath = `/api/contacts/${id}/contact.vcf`;
        }

        // For public view, append public query param to vCard
        if (publicVCardPath && !publicVCardPath.includes('public')) {
            publicVCardPath += '?public';
        }

        return {
            id: result.id,
            displayName: result.displayName,
            givenName: result.givenName,
            familyName: result.familyName,
            middleName: result.middleName,
            honorificPrefix: result.honorificPrefix,
            honorificSuffix: result.honorificSuffix,
            notes: result.notes,
            isPublic: result.isPublic,
            // Filtered data (work only)
            emails: workEmails,
            phones: workPhones,
            addresses: workAddresses,
            // No relations for public view
            relations: [],
            // Tags are ok to show
            tags: result.tags.map((t: any) => ({
                id: t.tag.id,
                name: t.tag.name
            })),
            // Public file versions
            qrCodePath: publicQrCodePath,
            vCardPath: publicVCardPath,
        };
    }

    return {
        ...result,
        vCardPath: result.vCardPath?.includes('/api/') ? result.vCardPath : `/api/contacts/${id}/contact.vcf`,
        qrCodePath: result.qrCodePath?.includes('/api/') ? result.qrCodePath : `/api/contacts/${id}/qr.png`,
        tags: result.tags.map((t: any) => ({
            id: t.tag.id,
            name: t.tag.name
        }))
    };
});
