import { form, requested } from '$app/server';
import { createGoalContributionSchema } from '@ac/validations';
import { getAuthenticatedUser, isOperator } from '#lib/server/authorization.js';
import { addGoalContributionRecord, getGoalCampaignById } from '#lib/server/goals/service.js';
import { listGoalCampaigns, getShowcaseCampaigns } from '../list.remote';
import { readGoalCampaign } from './read.remote';

export const contributeToGoalCampaign = form(createGoalContributionSchema, async (data) => {
    const user = getAuthenticatedUser();

    const result = await addGoalContributionRecord(data, {
        id: user.id,
        name: user.name || 'Community Member',
        email: user.email
    });

    const updatedCampaign = await getGoalCampaignById(data.campaignId, {
        incrementVisit: false,
        isAuthorizedOperator: isOperator(user)
    });

    try {
        await requested(listGoalCampaigns, 20).refreshAll();
    } catch {
        // ignore
    }
    void listGoalCampaigns().refresh();
    void listGoalCampaigns({}).refresh();
    void getShowcaseCampaigns().refresh();
    void getShowcaseCampaigns({}).refresh();
    if (updatedCampaign) {
        readGoalCampaign(data.campaignId).set(updatedCampaign);
    } else {
        void readGoalCampaign(data.campaignId).refresh();
    }

    return {
        success: true,
        campaignId: data.campaignId,
        currentTotal: result.newAmount,
        paymentReference: result.paymentReference,
        checkoutReceiptUrl: result.checkoutReceiptUrl
    };
});
