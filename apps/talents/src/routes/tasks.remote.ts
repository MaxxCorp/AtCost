import { query, form } from '$app/server';
import { db, task, getSubordinateTree, getDirectReports } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { eq, and, or, desc, inArray } from '@ac/db';
import * as v from 'valibot';
import { getMyTalentIdCore } from '$lib/server/timesheets/service';
import type { RemoteQuery } from '@sveltejs/kit';

export const listTasks = query(v.undefined_(), async (): Promise<{ self: any[]; direct: any[]; subordinates: any[] }> => {
    const talentId = await getMyTalentIdCore();
    if (!talentId) return { self: [], direct: [], subordinates: [] };

    const directReports = await getDirectReports(talentId);
    const directReportIds = directReports.map(r => r.id);
    
    const subordinateTree = await getSubordinateTree(talentId);
    const subordinateIds = subordinateTree.map(r => r.id).filter(id => !directReportIds.includes(id) && id !== talentId);

    const allTasks = await db.query.task.findMany({
        where: or(
            eq(task.assigneeId, talentId),
            directReportIds.length > 0 ? inArray(task.assigneeId, directReportIds) : undefined,
            subordinateIds.length > 0 ? inArray(task.assigneeId, subordinateIds) : undefined
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
        self: allTasks.filter(t => t.assigneeId === talentId),
        direct: allTasks.filter(t => directReportIds.includes(t.assigneeId)),
        subordinates: allTasks.filter(t => subordinateIds.includes(t.assigneeId))
    };
});

export const listCompletedTasks = query(v.undefined_(), async (): Promise<any[]> => {
    const talentId = await getMyTalentIdCore();
    if (!talentId) return [];

    return await db.query.task.findMany({
        where: and(eq(task.assigneeId, talentId), eq(task.status, 'completed')),
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

    return { success: true, task: updatedTask };
});
