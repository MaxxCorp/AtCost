import { query, form } from '$app/server';
import * as v from 'valibot';
import {
    approveConditionSchema,
    rejectConditionSchema,
    syncConditionsSchema
} from '@ac/validations';
import {
    listConditionHistory,
    listPendingConditionReviews,
    syncConditions,
    approveCondition as approveConditionCore,
    rejectCondition as rejectConditionCore
} from '#lib/server/conditions/service.js';
import { getAuthenticatedUser, parseRoles } from '#lib/server/authorization.js';
import { listTasks, listCompletedTasks } from './tasks.remote.js';

import { db, socialInsuranceCondition, unionContractCondition, eq } from '@ac/db';

export const listConditionsHistory = query(v.undefined_(), async () => {
    getAuthenticatedUser();
    return await listConditionHistory();
});

export const listPendingConditions = query(v.undefined_(), async () => {
    getAuthenticatedUser();
    return await listPendingConditionReviews();
});

export const readCondition = query(
    v.object({
        id: v.string(),
        type: v.picklist(['social_insurance', 'union_contract'])
    }),
    async ({ id, type }) => {
        getAuthenticatedUser();
        if (type === 'social_insurance') {
            const row = await db.query.socialInsuranceCondition.findFirst({
                where: eq(socialInsuranceCondition.id, id)
            });
            if (!row) throw new Error('Social insurance condition not found');
            return row;
        } else {
            const row = await db.query.unionContractCondition.findFirst({
                where: eq(unionContractCondition.id, id)
            });
            if (!row) throw new Error('Union contract condition not found');
            return row;
        }
    }
);


export const triggerSync = form(syncConditionsSchema, async (input) => {
    const user = getAuthenticatedUser();
    const roles = parseRoles(user);
    const isAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');
    if (!isAuthorized) {
        throw new Error('Forbidden: Only Admins, HR Managers and Top Management can trigger rate sync.');
    }

    const result = await syncConditions({
        force: input.force,
        period: input.period,
        simulateChange: input.simulateChange,
        userId: user.id
    });

    void listPendingConditions().refresh();
    void listConditionsHistory().refresh();
    void listTasks().refresh();

    return result;
});

export const approveConditionUpdate = form(approveConditionSchema, async (input) => {
    const user = getAuthenticatedUser();
    const roles = parseRoles(user);
    const isAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');
    if (!isAuthorized) {
        throw new Error('Forbidden: Only Admins, HR Managers and Top Management can approve condition updates.');
    }

    const result = await approveConditionCore({
        id: input.id,
        type: input.type,
        userId: user.id,
        userName: user.name || user.email || 'Management User',
    });

    void listPendingConditions().refresh();
    void listConditionsHistory().refresh();
    void listTasks().refresh();
    void listCompletedTasks().refresh();

    return result;
});

export const rejectConditionUpdate = form(rejectConditionSchema, async (input) => {
    const user = getAuthenticatedUser();
    const roles = parseRoles(user);
    const isAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');
    if (!isAuthorized) {
        throw new Error('Forbidden: Only Admins, HR Managers and Top Management can reject condition updates.');
    }

    const result = await rejectConditionCore({
        id: input.id,
        type: input.type,
        reason: input.reason,
        userId: user.id
    });

    void listPendingConditions().refresh();
    void listConditionsHistory().refresh();
    void listTasks().refresh();
    void listCompletedTasks().refresh();

    return result;
});
