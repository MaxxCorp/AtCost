import { query, form, command } from '$app/server';
import { db, task, getSubordinateTree, getDirectReports, eq, and, or, desc, asc, inArray, isNull } from '@ac/db';
import { getAuthenticatedUser, getOptionalUser, parseRoles } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { getMyTalentIdCore } from '#lib/server/timesheets/service.js';
import {
    updateTaskTypeConfigSchema,
    issueDifferentialContractUpdateSchema,
    triggerMilestoneCheckSchema
} from '@ac/validations';
import {
    getOrSeedTaskTypeConfigs,
    updateTaskTypeConfigCore,
    syncContractMilestoneTasks,
    issueDifferentialContractUpdateCore,
} from '#lib/server/tasks/service.js';
import { syncConditions } from '#lib/server/conditions/service.js';

export const listTasks = query(v.undefined_(), async (): Promise<{
    self: any[];
    direct: any[];
    subordinates: any[];
    shared: any[];
}> => {
    const user = getOptionalUser();
    const talentId = await getMyTalentIdCore();

    const roles = user ? parseRoles(user) : [];
    const isSharedAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');

    let sharedTasks: any[] = [];
    if (isSharedAuthorized) {
        sharedTasks = await db.query.task.findMany({
            where: and(
                eq(task.status, 'pending'),
                or(
                    eq(task.type, 'condition_update_approval'),
                    eq(task.type, 'experience_step_increase'),
                    eq(task.type, 'tenure_anniversary'),
                    isNull(task.assigneeId)
                )
            ),
            orderBy: [asc(task.dueDate), desc(task.createdAt)]
        });
    }

    if (!talentId) {
        return { self: [], direct: [], subordinates: [], shared: sharedTasks };
    }

    const directReports = await getDirectReports(talentId);
    const directReportIds = directReports.map((r) => r.id);
    
    const subordinateTree = await getSubordinateTree(talentId);
    const subordinateIds = subordinateTree.map((r) => r.id).filter((id) => !directReportIds.includes(id) && id !== talentId);

    const allTasks = await db.query.task.findMany({
        where: and(
            eq(task.status, 'pending'),
            or(
                eq(task.assigneeId, talentId),
                directReportIds.length > 0 ? inArray(task.assigneeId, directReportIds) : undefined,
                subordinateIds.length > 0 ? inArray(task.assigneeId, subordinateIds) : undefined
            )
        ),
        with: {
            assignee: {
                with: {
                    contact: true
                }
            }
        },
        orderBy: [asc(task.dueDate), desc(task.createdAt)]
    });

    return {
        self: allTasks.filter((t) => t.assigneeId === talentId),
        direct: allTasks.filter((t) => t.assigneeId !== null && directReportIds.includes(t.assigneeId)),
        subordinates: allTasks.filter((t) => t.assigneeId !== null && subordinateIds.includes(t.assigneeId)),
        shared: sharedTasks
    };
});

export const listCompletedTasks = query(v.undefined_(), async (): Promise<any[]> => {
    const user = getOptionalUser();
    const talentId = await getMyTalentIdCore();
    const roles = user ? parseRoles(user) : [];
    const isSharedAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');

    if (!talentId && !isSharedAuthorized) return [];

    const conditions: any[] = [];
    if (talentId) {
        conditions.push(eq(task.assigneeId, talentId));
    }
    if (isSharedAuthorized) {
        conditions.push(eq(task.type, 'condition_update_approval'));
        conditions.push(eq(task.type, 'experience_step_increase'));
        conditions.push(eq(task.type, 'tenure_anniversary'));
        conditions.push(isNull(task.assigneeId));
    }

    return await db.query.task.findMany({
        where: and(
            eq(task.status, 'completed'),
            conditions.length > 0 ? or(...conditions) : undefined
        ),
        with: {
            assignee: {
                with: {
                    contact: true
                }
            }
        },
        orderBy: [desc(task.updatedAt)],
        limit: 100
    }) as any[];
});

export const listTaskTypeConfigs = query(v.undefined_(), async () => {
    getAuthenticatedUser();
    return await getOrSeedTaskTypeConfigs();
});

export const completeTask = command(v.object({ taskId: v.string() }), async (data): Promise<{ success: boolean; task: any }> => {
    getAuthenticatedUser();

    const [updatedTask] = await db.update(task)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(task.id, data.taskId))
        .returning();

    void listTasks().refresh();
    void listCompletedTasks().refresh();

    return { success: true, task: updatedTask };
});

export const updateTaskConfig = form(updateTaskTypeConfigSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = parseRoles(user);
    const isAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');
    if (!isAuthorized) {
        throw new Error('Forbidden: Only Admins, HR Managers and Top Management can configure task lead times.');
    }

    const updated = await updateTaskTypeConfigCore({
        taskType: data.taskType,
        name: data.name,
        leadTimeDays: data.leadTimeDays,
        isEnabled: data.isEnabled,
        targetRoles: data.targetRoles,
        autoPromptDifferentialUpdate: data.autoPromptDifferentialUpdate,
    });

    void listTaskTypeConfigs().refresh();
    void listTasks().refresh();

    return { success: true, config: updated };
});

export const runTaskCheck = form(triggerMilestoneCheckSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = parseRoles(user);
    const isAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');
    if (!isAuthorized) {
        throw new Error('Forbidden: Only Admins, HR Managers and Top Management can trigger task milestone checks.');
    }

    // Run conditions sync which also invokes contract milestone task checks
    const conditionsResult = await syncConditions({
        force: data.force,
        period: data.period,
    });

    const milestoneResult = await syncContractMilestoneTasks({
        force: data.force,
        leadTimeDaysOverride: data.leadTimeDaysOverride,
    });

    void listTasks().refresh();
    void listCompletedTasks().refresh();
    void listTaskTypeConfigs().refresh();

    return {
        success: true,
        conditionsChecked: conditionsResult.conditionsCount,
        conditionsTasksCount: conditionsResult.tasksCount,
        milestoneCheckedContracts: milestoneResult.checkedContractsCount,
        milestoneTasksCreated: milestoneResult.createdTasksCount,
        message: `Task run completed: ${milestoneResult.checkedContractsCount} active contract(s) inspected. ${milestoneResult.createdTasksCount} new milestone task(s) generated.`,
    };
});

export const issueDifferentialContractUpdate = form(issueDifferentialContractUpdateSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = parseRoles(user);
    const isAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');
    if (!isAuthorized) {
        throw new Error('Forbidden: Only Admins, HR Managers and Top Management can issue differential contract updates.');
    }

    const result = await issueDifferentialContractUpdateCore({
        taskId: data.taskId,
        contractId: data.contractId,
        talentId: data.talentId,
        effectiveDate: data.effectiveDate,
        newEntgeltgruppe: data.newEntgeltgruppe,
        newStufe: data.newStufe,
        newWageAmount: data.newWageAmount,
        notes: data.notes,
        scheduleReport: data.scheduleReport,
        userId: user.id,
        userName: user.name || user.email || 'Management User',
    });

    void listTasks().refresh();
    void listCompletedTasks().refresh();

    return result;
});
