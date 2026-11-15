import { query, command, getRequestEvent, requested } from '$app/server';
import { dev } from '$app/env';
import * as v from 'valibot';
import { goalPaginationSchema } from '@ac/validations';
import { queryGoalCampaigns, getShowcaseData } from '#lib/server/goals/service.js';
import { getOptionalUser, isOperator } from '#lib/server/authorization.js';

export const listGoalCampaigns = query(goalPaginationSchema, async (input) => {
    const user = getOptionalUser();
    const isAuthorizedOperator = isOperator(user);
    return await queryGoalCampaigns(input || {}, {
        currentUserId: user?.id ?? null,
        isAuthorizedOperator
    });
});

export const getShowcaseCampaigns = query(v.optional(v.object({}), {}), async () => {
    const user = getOptionalUser();
    const isAuthorizedOperator = isOperator(user);
    return await getShowcaseData({
        isAuthorizedOperator
    });
});

export const getCurrentSessionUser = query(v.optional(v.object({}), {}), async () => {
    const event = getRequestEvent();
    const user = event.locals.user ?? null;
    const isOperatorFlag = isOperator(user);
    const devPersona = dev
        ? (event.cookies.get('ac_goals_dev_persona') as 'operator' | 'community' | 'guest') ||
          'operator'
        : null;
    return {
        user: user
            ? {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  image: user.image ?? null,
                  roles: Array.isArray((user as any).roles) ? (user as any).roles : [],
                  claims: (user as any).claims ?? {}
              }
            : null,
        isOperator: isOperatorFlag,
        devPersona
    };
});

export const switchDevPersona = command(
    v.picklist(['operator', 'community', 'guest']),
    async (persona) => {
        if (!dev) {
            throw new Error('Forbidden: Dev persona switching is disabled in production.');
        }

        const event = getRequestEvent();
        event.cookies.set('ac_goals_dev_persona', persona, {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30
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
        void getCurrentSessionUser().refresh();
        void getCurrentSessionUser({}).refresh();
        return { success: true, persona };
    }
);
