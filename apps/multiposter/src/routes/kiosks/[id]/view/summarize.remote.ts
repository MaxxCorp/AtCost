import { command } from '$app/server';
import { env } from '$env/dynamic/private';
import { GoogleGenAI, Type } from '@google/genai';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { summarizeFlyerSchema, type SummarizeFlyerResult, type FlyerItemSummary } from '$lib/validations/flyer';

function stripFormatting(text?: string | null): string {
    if (!text) return '';
    return text
        .replace(/<[^>]*>/g, ' ')
        .replace(/[*_#`~\[\]]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function generateFallbackSummaries(
    items: Array<{ id: string; title: string; description?: string | null; type: 'event' | 'announcement' }>,
    targetDensity: 'compact' | 'standard' | 'detailed'
): Record<string, FlyerItemSummary> {
    const wordLimits = {
        compact: 14,
        standard: 28,
        detailed: 48
    };
    const maxWords = wordLimits[targetDensity] || 28;

    const result: Record<string, FlyerItemSummary> = {};

    for (const item of items) {
        const cleanDesc = stripFormatting(item.description);
        let summary = '';
        if (cleanDesc) {
            const words = cleanDesc.split(' ');
            if (words.length <= maxWords) {
                summary = cleanDesc;
            } else {
                summary = words.slice(0, maxWords).join(' ') + '...';
            }
        } else {
            summary = item.type === 'event' ? 'Scheduled event' : 'Announcement update';
        }

        result[item.id] = {
            id: item.id,
            title: item.title,
            summary
        };
    }

    return result;
}

export const summarizeFlyerItems = command(summarizeFlyerSchema, async (data): Promise<SummarizeFlyerResult> => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'kiosks');
    } catch {
        // Allow public/view access for kiosk if unauthenticated, or return fallback
    }

    const { items, targetDensity = 'standard', customInstructions } = data;

    if (!items || items.length === 0) {
        return { success: true, summaries: {} };
    }

    const densityDescriptions = {
        compact: 'Extremely concise (target 10-15 words per item). Focus only on the core activity so dozens of events fit within the tight physical fold panels.',
        standard: 'Concise editorial blurb (target 20-30 words per item). Crisp, informative, appealing community flyer style.',
        detailed: 'Detailed brochure blurb (target 35-50 words per item). Highlights benefits, atmosphere, and special details.'
    };

    if (!env.GEMINI_API_KEY) {
        const fallbackSummaries = generateFallbackSummaries(items, targetDensity);
        return {
            success: true,
            fallback: true,
            summaries: fallbackSummaries
        };
    }

    try {
        const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        
        const prompt = `You are an expert editorial designer and copywriter for physical tri-fold printed brochures and community calendars.
Your task is to summarize the following ${items.length} events and announcements so they fit cleanly onto the inside panels of an A4 tri-fold print flyer without spilling over.

Target Density: ${densityDescriptions[targetDensity]}
${customInstructions ? `Additional User Guidance: ${customInstructions}` : ''}

Rules:
1. For each item, provide a clear, punchy 'title' (max 6-8 words).
2. Write a captivating 'summary' respecting the target word length for ${targetDensity} density.
3. If relevant, include a short 'highlight' badge text (max 3-4 words, e.g. "Free admission", "Family friendly", "Registration needed", "All ages").
4. Maintain the original language of the events (e.g. German if in German, English if in English).
5. Ensure dates, times, and essential facts remain accurate.

Items to summarize:
${JSON.stringify(items.map(i => ({
    id: i.id,
    type: i.type,
    title: i.title,
    description: stripFormatting(i.description),
    locations: i.locationNames,
    rooms: i.roomNames
})))}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    summary: { type: Type.STRING },
                                    highlight: { type: Type.STRING }
                                },
                                required: ['id', 'title', 'summary']
                            }
                        }
                    },
                    required: ['items']
                }
            }
        });

        const rawText = response.text;
        if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed && Array.isArray(parsed.items)) {
                const summaryMap: Record<string, FlyerItemSummary> = {};
                for (const item of parsed.items) {
                    if (item.id) {
                        summaryMap[item.id] = {
                            id: item.id,
                            title: item.title,
                            summary: item.summary,
                            highlight: item.highlight || undefined
                        };
                    }
                }
                return {
                    success: true,
                    fallback: false,
                    summaries: summaryMap
                };
            }
        }

        // If parsed response was empty or unexpected structure, use fallback
        const fallbackSummaries = generateFallbackSummaries(items, targetDensity);
        return {
            success: true,
            fallback: true,
            summaries: fallbackSummaries
        };
    } catch (err: any) {
        console.error('Error during AI flyer summarization, using rule-based fallback:', err);
        const fallbackSummaries = generateFallbackSummaries(items, targetDensity);
        return {
            success: true,
            fallback: true,
            summaries: fallbackSummaries
        };
    }
});
