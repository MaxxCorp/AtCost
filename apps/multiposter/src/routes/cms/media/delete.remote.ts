import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getStorageProvider } from '$lib/server/blob-storage';
import { getAuthenticatedUser } from '$lib/server/authorization';
import { deleteImageSchema } from '$lib/validations/cms';
import { db } from '@ac/db';
import { cmsMedia } from '@ac/db';
import { eq } from 'drizzle-orm';

export const deleteMedia = command(deleteImageSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();
        if (!user) {
            error(401, 'Unauthorized');
        }

        const { id } = data;

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

        // Delete from blob storage
        const provider = getStorageProvider();
        await provider.delete(record.path);

        // Delete from database
        await db.delete(cmsMedia).where(eq(cmsMedia.id, id));

        return {
            success: true
        };
    } catch (err: any) {
        console.error('Delete failed:', err);
        return {
            success: false,
            error: err.message || 'Delete failed'
        };
    }
});
