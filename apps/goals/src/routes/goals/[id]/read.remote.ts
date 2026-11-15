import { query } from '$app/server';
import * as v from 'valibot';
import { getGoalCampaignById } from '#lib/server/goals/service.js';
import { getOptionalUser, isOperator } from '#lib/server/authorization.js';
import { PAYMENT_PROVIDER_PROPOSALS } from '#lib/server/payments/provider.js';

export const readGoalCampaign = query(v.string(), async (id) => {
    const user = getOptionalUser();
    const isAuthorizedOperator = isOperator(user);
    return await getGoalCampaignById(id, {
        incrementVisit: true,
        isAuthorizedOperator,
        currentUserId: user?.id ?? null
    });
});

export const getPaymentProviderProposals = query(v.optional(v.object({}), {}), async () => {
    return PAYMENT_PROVIDER_PROPOSALS;
});
