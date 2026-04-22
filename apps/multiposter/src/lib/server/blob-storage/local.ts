import type { BlobStorageProvider } from './types';
import fs from 'fs';
import path from 'path';

export class LocalBlobStorageProvider implements BlobStorageProvider {
    private baseDir: string;

    constructor() {
        this.baseDir = path.join(process.cwd(), 'static');
    }

    async put(key: string, content: Buffer | string, contentType: string): Promise<string | undefined> {
        try {
            const fullPath = path.join(this.baseDir, key);
            const dir = path.dirname(fullPath);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(fullPath, content);

            // Return a relative URL that SvelteKit can serve from static folder
            // ensuring it starts with /
            return key.startsWith('/') ? key : `/${key}`;
        } catch (error) {
            console.error(`Local Blob put failed for ${key}:`, error);
            return undefined;
        }
    }

    async delete(url: string): Promise<void> {
        try {
            // Strip leading / if present to match the key
            const key = url.startsWith('/') ? url.substring(1) : url;
            const fullPath = path.join(this.baseDir, key);

            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        } catch (error) {
            console.error(`Local Blob delete failed for ${url}:`, error);
        }
    }
}
