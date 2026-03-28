import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/server/authorization';
import { updateImageSchema } from '$lib/validations/cms';
import { db } from '$lib/server/db';
import { cmsMedia } from '@ac/db';
import { eq } from 'drizzle-orm';

export const updateMedia = command(updateImageSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();
        if (!user) {
            error(401, 'Unauthorized');
        }

        const { id, filename } = data;

        // Find the record
        const record = await db.query.cmsMedia.findFirst({
            where: eq(cmsMedia.id, id)
        });

        if (!record) {
            error(404, 'Image not found');
        }

        // Optional: ensure user owns the image
        //if (record.userId && record.userId !== user.id) {
        //    error(403, 'Forbidden');
        //}

        // Update database
        await db.update(cmsMedia).set({
            filename
        }).where(eq(cmsMedia.id, id));

        return {
            success: true
        };
    } catch (err: any) {
        console.error('Update failed:', err);
        return {
            success: false,
            error: err.message || 'Update failed'
        };
    }
});
