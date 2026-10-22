import { form } from '$app/server';
import { gdprSelfServiceSchema } from '@ac/validations';
import { identifyAndMarkContactForObfuscation } from '@ac/db';

export const submitGdprRequest = form(gdprSelfServiceSchema, async (data) => {
    return await identifyAndMarkContactForObfuscation({
        email: data.email,
        phone: data.phone,
        birthday: data.birthday,
        familyName: data.familyName,
        givenName: data.givenName,
        zip: data.zip,
        city: data.city,
        street: data.street,
        notes: data.notes,
        confirmRequest: data.confirmRequest,
    });
});
