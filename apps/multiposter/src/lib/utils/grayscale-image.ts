/**
 * High-fidelity image and SVG grayscale processor.
 * 
 * Avoids browser print & screen rasterization degradation caused by CSS `filter: grayscale(100%)`.
 * - For SVGs: parses hex and rgb color values and replaces them with their luminance equivalent,
 *   preserving 100% vector geometry, paths, text, and infinite print DPI.
 * - For raster images (JPEG, PNG, WebP): renders to an offscreen canvas at full native resolution
 *   (naturalWidth x naturalHeight) to generate a high-DPI grayscale data URL.
 */

const grayscaleCache = new Map<string, string>();

/**
 * Calculates ITU-R BT.601 relative luminance for given RGB values.
 */
function calculateLuminance(r: number, g: number, b: number): number {
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Converts colors in an SVG string to grayscale while preserving 100% vector curves.
 */
export function convertSvgToGrayscale(svgString: string): string {
    if (!svgString) return '';

    // Convert 6-digit hex (#rrggbb)
    let processed = svgString.replace(/#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/g, (_, r, g, b) => {
        const lum = calculateLuminance(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16));
        const hex = lum.toString(16).padStart(2, '0');
        return `#${hex}${hex}${hex}`;
    });

    // Convert 3-digit hex (#rgb)
    processed = processed.replace(/#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])\b/g, (_, r, g, b) => {
        const lum = calculateLuminance(parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16));
        const hex = lum.toString(16).padStart(2, '0');
        return `#${hex}${hex}${hex}`;
    });

    // Convert rgb(r, g, b)
    processed = processed.replace(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi, (_, r, g, b) => {
        const lum = calculateLuminance(parseInt(r, 10), parseInt(g, 10), parseInt(b, 10));
        return `rgb(${lum}, ${lum}, ${lum})`;
    });

    // Convert rgba(r, g, b, a)
    processed = processed.replace(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/gi, (_, r, g, b, a) => {
        const lum = calculateLuminance(parseInt(r, 10), parseInt(g, 10), parseInt(b, 10));
        return `rgba(${lum}, ${lum}, ${lum}, ${a})`;
    });

    return processed;
}

/**
 * Returns a high-resolution grayscale version of the given image URL.
 * Falls back to the original URL if client-side canvas manipulation is not possible (e.g. CORS).
 */
export function getGrayscaleImageUrlSync(url?: string | null): string {
    if (!url) return '';
    if (grayscaleCache.has(url)) return grayscaleCache.get(url)!;

    if (url.startsWith('data:image/svg+xml')) {
        try {
            let svgText = '';
            if (url.includes(';utf8,')) {
                svgText = decodeURIComponent(url.split(';utf8,')[1]);
            } else if (url.includes(';base64,')) {
                svgText = atob(url.split(';base64,')[1]);
            }
            if (svgText) {
                const graySvg = convertSvgToGrayscale(svgText);
                const result = 'data:image/svg+xml;utf8,' + encodeURIComponent(graySvg);
                grayscaleCache.set(url, result);
                return result;
            }
        } catch {
            // fallback to original
        }
    }

    return url;
}

/**
 * Asynchronously processes an image to grayscale using an offscreen canvas at full native resolution.
 */
export async function getGrayscaleImageUrl(url?: string | null): Promise<string> {
    if (!url) return '';
    if (grayscaleCache.has(url)) return grayscaleCache.get(url)!;

    // Check SVG synchronously first
    const syncRes = getGrayscaleImageUrlSync(url);
    if (syncRes !== url) return syncRes;

    if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = url;
            });

            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;
            if (width > 0 && height > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const imgData = ctx.getImageData(0, 0, width, height);
                    const d = imgData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        const lum = calculateLuminance(d[i], d[i + 1], d[i + 2]);
                        d[i] = lum;
                        d[i + 1] = lum;
                        d[i + 2] = lum;
                    }
                    ctx.putImageData(imgData, 0, 0);
                    const grayDataUrl = canvas.toDataURL('image/png');
                    grayscaleCache.set(url, grayDataUrl);
                    return grayDataUrl;
                }
            }
        } catch {
            // CORS restriction or canvas failure; fall back to original URL
        }
    }

    return url;
}
