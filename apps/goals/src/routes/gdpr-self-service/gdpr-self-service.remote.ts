import { form } from '$app/server';
import { gdprSelfServiceSchema } from '@ac/validations';
import { identifyAndMarkContactForObfuscation } from '@ac/db';
import { ensureGoalsTablesAndSeed } from '#lib/server/goals/service.js';

export const submitGdprRequest = form(gdprSelfServiceSchema, async (data) => {
    await ensureGoalsTablesAndSeed();
    const res = await identifyAndMarkContactForObfuscation(data);

    if (!res.success) {
        return {
            success: false,
            error: {
                message:
                    res.reason ||
                    'Verifikation fehlgeschlagen. Bitte prüfen Sie Ihre Angaben (mind. 3 übereinstimmende Merkmale).',
            },
            alreadyObfuscated: res.alreadyObfuscated,
        };
    }

    return {
        success: true,
        alreadyPending: res.alreadyPending,
        contactDisplayName: res.contactDisplayName,
        identifiedFields: res.identifiedFields,
        gdprRequestId: res.gdprRequestId,
        message: res.alreadyPending
            ? res.reason
            : 'Ihr Antrag auf Datenanonymisierung (Art. 17 DSGVO) wurde erfolgreich verifiziert und an das Datenschutz-Team übermittelt.',
    };
});
