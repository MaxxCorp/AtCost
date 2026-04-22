import type { BlobStorageProvider } from './types';
import { put, del } from '@vercel/blob';

export class VercelBlobStorageProvider implements BlobStorageProvider {
    async put(path: string, content: Buffer | string, contentType: string): Promise<string | undefined> {
        try {
            // Vercel Blob requires BLOB_READ_WRITE_TOKEN in env
            const response = await put(path, content, {
                contentType,
                access: 'public',
                addRandomSuffix: false,
                allowOverwrite: true,
            });
            return response.url;
        } catch (error) {
            console.error(`Vercel Blob put failed for ${path}:`, error);
            return undefined;
        }
    }

    async delete(url: string): Promise<void> {
        try {
            await del(url);
        } catch (error) {
            console.error(`Vercel Blob delete failed for ${url}:`, error);
        }
    }
}
