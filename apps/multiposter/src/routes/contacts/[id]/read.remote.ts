import { query } from '$app/server';
import { db } from '@ac/db';
import { getOptionalUser, hasAccess } from '#lib/server/authorization.js';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { getCache, setCache, cacheKeys } from '#lib/server/cache/index.js';
import { sanitizePublicContact } from '#lib/server/public-sanitization.js';

/**
 * Query: Read a contact by ID
 * 
 * Access rules:
 * - If contact is public: anyone can view (but only work info, no relations, no internal notes, external tags only)
 * - If contact is private: only authenticated users with 'contacts' access can view
 */
export const readContact = query(v.string(), async (id: string): Promise<any> => {
    const user = getOptionalUser();
    const isAuthorized = !!(user && hasAccess(user, 'contacts'));

    // Cache check for public viewers / robots
    if (!isAuthorized) {
        const cachedPayload = await getCache<{ isPrivate: boolean; data?: any }>(cacheKeys.publicContact(id));
        if (cachedPayload !== null) {
            if (cachedPayload.isPrivate) {
                if (!user) {
                    error(403, 'Authentication required to view this contact');
                }
                error(403, 'You do not have permission to view this contact');
            }
            return cachedPayload.data ?? null;
        }
    }

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

    if (!result) {
        if (!isAuthorized) {
            await setCache(cacheKeys.publicContact(id), { isPrivate: false, data: null }, 30);
        }
        return null;
    }

    // Check access based on public flag
    if (!result.isPublic || result.obfuscationStatus === 'obfuscated') {
        if (!isAuthorized) {
            await setCache(cacheKeys.publicContact(id), { isPrivate: true }, 300);
        }
        if (!user) {
            error(403, 'Authentication required to view this contact');
        }
        if (!isAuthorized) {
            error(403, 'You do not have permission to view this contact');
        }
    }

    // For public contacts viewed by unauthenticated/unauthorized users, sanitize via centralized helper
    if (!isAuthorized) {
        const sanitized = sanitizePublicContact(result);
        const publicContact = sanitized
            ? {
                  ...sanitized,
                  tags: (sanitized.tags || []).map((t: any) => {
                      const tagObj = t.tag || t;
                      return {
                          id: tagObj.id,
                          name: tagObj.name,
                          visibility: 'external',
                          color: tagObj.color
                      };
                  })
              }
            : null;

        await setCache(cacheKeys.publicContact(id), { isPrivate: false, data: publicContact }, 3600);
        return publicContact;
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
