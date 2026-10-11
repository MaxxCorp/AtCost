import { query, form } from '$app/server';
import { db, task, getSubordinateTree, getDirectReports } from '@ac/db';
import { getAuthenticatedUser, getOptionalUser, parseRoles } from '#lib/server/authorization.js';
import { eq, and, or, desc, inArray, isNull } from '@ac/db';
import * as v from 'valibot';
import { getMyTalentIdCore } from '#lib/server/timesheets/service.js';

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
                    isNull(task.assigneeId)
                )
            ),
            orderBy: [desc(task.createdAt)]
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
        orderBy: [desc(task.createdAt)]
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
        limit: 50
    }) as any[];
});

export const completeTask = form(v.object({ taskId: v.string() }), async (data): Promise<{ success: boolean; task: any }> => {
    getAuthenticatedUser(); // Authorization check

    const [updatedTask] = await db.update(task)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(task.id, data.taskId))
        .returning();

    void listTasks().refresh();
    void listCompletedTasks().refresh();

    return { success: true, task: updatedTask };
});
