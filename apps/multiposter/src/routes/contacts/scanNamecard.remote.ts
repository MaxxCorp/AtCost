import { query, command } from '$app/server';
import { env } from '$env/dynamic/private';
import { GoogleGenAI, Type } from '@google/genai';
import * as v from 'valibot';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

export const isScanAvailable = query(v.any(), async () => {
    return !!env.GEMINI_API_KEY;
});

const scanSchema = v.object({
    imageBase64: v.string(),
    mimeType: v.string()
});

export const scanNamecard = command(scanSchema, async ({ imageBase64, mimeType }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    if (!env.GEMINI_API_KEY) {
        return { success: false, error: 'Gemini API key is not configured.' };
    }

    try {
        const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: "Extract contact information from this business card." },
                        { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        displayName: { type: Type.STRING, description: "Full name" },
                        givenName: { type: Type.STRING, description: "First name" },
                        familyName: { type: Type.STRING, description: "Last name" },
                        company: { type: Type.STRING },
                        role: { type: Type.STRING, description: "Job title or position" },
                        emails: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT, 
                                properties: { 
                                    value: { type: Type.STRING }, 
                                    type: { type: Type.STRING, description: "'work', 'home', or 'other'" } 
                                } 
                            } 
                        },
                        phones: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT, 
                                properties: { 
                                    value: { type: Type.STRING }, 
                                    type: { type: Type.STRING, description: "'mobile', 'work', 'home', or 'other'" } 
                                } 
                            } 
                        },
                        addresses: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT, 
                                properties: { 
                                    street: { type: Type.STRING }, 
                                    city: { type: Type.STRING }, 
                                    zip: { type: Type.STRING }, 
                                    country: { type: Type.STRING },
                                    type: { type: Type.STRING, description: "'work', 'home', or 'other'" }
                                } 
                            } 
                        }
                    }
                }
            }
        });
        
        if (response.text) {
            const data = JSON.parse(response.text);
            return { success: true, data };
        }
        return { success: false, error: 'Failed to extract data from image.' };
    } catch (err: any) {
        console.error("Error scanning namecard:", err);
        return { success: false, error: err.message || 'Failed to scan namecard.' };
    }
});
