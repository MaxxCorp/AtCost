import { db, talentGroups, talentGroupMembers, talent, contact, contactEmail, contract, shiftPlanTemplate, shiftPlanTemplateTalent, timesheetEntry, timeOffRequest, talentTimetableConflicts, talentAzv, eq, desc, sql, and, or, ilike, inArray, count, gte, lte } from '@ac/db';
import {
  createTalentGroupSchema,
  updateTalentGroupSchema,
  talentGroupIdSchema,
  talentIdSchema,
  addTalentToGroupSchema,
  removeTalentFromGroupSchema,
  talentGroupPaginationSchema,
  getGroupWeeklyTimesheetSchema,
  updateTimeOffStatusSchema,
  deleteTimesheetEntrySchema,
  createManualTimesheetEntrySchema,
  setDayExcuseSchema,
  createTalentAzvSchema,
  linkAzvToExcuseSchema,
  awardWeekSurplusAzvSchema,
  deleteTalentAzvSchema,
  type TalentGroupOverview,
  type TalentGroupDetail,
  type GroupWeeklyTimesheetData,
  type GroupWeeklyTalentRow,
  type GroupWeeklyDayEntry,
  type GroupWeeklyTimesheetTimeEntry,
  type TimetableConflictItem,
  type TalentAzvItem,
  type PaginatedResult,
} from '@ac/validations';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { query, form, command } from '$app/server';
import { getTalentMonthlyTimetable } from '../talents/[id]/timetable/timetable.remote';

function getMondayDateString(dateInput: string | Date): string {
  let target: Date;
  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      target = new Date(dateInput);
    } else {
      const [y, m, d] = dateInput.split('-').map(Number);
      target = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    }
  } else {
    target = new Date(dateInput);
  }
  const day = target.getUTCDay();
  const diff = (day + 6) % 7; // 0 for Mon, 6 for Sun
  target.setUTCDate(target.getUTCDate() - diff);
  const my = target.getUTCFullYear();
  const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
  const md = String(target.getUTCDate()).padStart(2, '0');
  return `${my}-${mm}-${md}`;
}

async function refreshGroupAndTimetableQueries(opts: {
  talentId?: string;
  groupId?: string;
  dateOrMonday?: string | Date;
}) {
  void listTalentGroups().refresh();

  const targetGroupIds: string[] = [];
  if (opts.groupId) {
    targetGroupIds.push(opts.groupId);
  }
  if (opts.talentId) {
    try {
      const memberRows = await db
        .select({ groupId: talentGroupMembers.groupId })
        .from(talentGroupMembers)
        .where(eq(talentGroupMembers.talentId, opts.talentId));
      for (const m of memberRows) {
        if (!targetGroupIds.includes(m.groupId)) {
          targetGroupIds.push(m.groupId);
        }
      }
    } catch (gErr) {
      console.warn('Error fetching member groups for refresh:', gErr);
    }
  }

  let mondayStr: string | null = null;
  if (opts.dateOrMonday) {
    mondayStr = getMondayDateString(opts.dateOrMonday);
  }

  for (const gid of targetGroupIds) {
    void readTalentGroup(gid).refresh();
    void getGroupTotalConflicts(gid).refresh();
    if (mondayStr) {
      void getGroupWeeklyTimesheet({
        groupId: gid,
        weekStartDate: mondayStr,
      }).refresh();
    }
  }

  if (opts.talentId && opts.dateOrMonday) {
    const d = typeof opts.dateOrMonday === 'string' && !opts.dateOrMonday.includes('T')
      ? new Date(`${opts.dateOrMonday}T00:00:00.000Z`)
      : new Date(opts.dateOrMonday);
    if (!isNaN(d.getTime())) {
      void getTalentMonthlyTimetable({
        talentId: opts.talentId,
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
      }).refresh();
    }
  }
}

export const listTalentGroups = query(
  talentGroupPaginationSchema,
  async (input): Promise<PaginatedResult<TalentGroupOverview>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const { page = 1, limit = 500, search = '', type } = input || {};
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (search) {
      conditions.push(
        or(
          ilike(talentGroups.name, `%${search}%`),
          ilike(talentGroups.type, `%${search}%`)
        )
      );
    }

    if (type) {
      const types = Array.isArray(type) ? type : [type];
      if (types.length > 0) {
        conditions.push(inArray(talentGroups.type, types as any));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ total: count() })
      .from(talentGroups)
      .where(whereClause);

    const total = Number(countResult?.total || 0);

    const rows = await db
      .select({
        id: talentGroups.id,
        name: talentGroups.name,
        type: talentGroups.type,
        createdAt: talentGroups.createdAt,
        updatedAt: talentGroups.updatedAt,
        memberCount: sql<number>`cast(count(${talentGroupMembers.talentId}) as int)`,
      })
      .from(talentGroups)
      .leftJoin(talentGroupMembers, eq(talentGroups.id, talentGroupMembers.groupId))
      .where(whereClause)
      .groupBy(
        talentGroups.id,
        talentGroups.name,
        talentGroups.type,
        talentGroups.createdAt,
        talentGroups.updatedAt
      )
      .orderBy(desc(talentGroups.createdAt))
      .limit(limit)
      .offset(offset);

    const data: TalentGroupOverview[] = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total };
  }
);

export const readTalentGroup = query(
  talentGroupIdSchema,
  async (id): Promise<TalentGroupDetail | null> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const [groupRow] = await db
      .select({
        id: talentGroups.id,
        name: talentGroups.name,
        type: talentGroups.type,
        createdAt: talentGroups.createdAt,
        updatedAt: talentGroups.updatedAt,
        memberCount: sql<number>`cast(count(${talentGroupMembers.talentId}) as int)`,
      })
      .from(talentGroups)
      .leftJoin(talentGroupMembers, eq(talentGroups.id, talentGroupMembers.groupId))
      .where(eq(talentGroups.id, id))
      .groupBy(
        talentGroups.id,
        talentGroups.name,
        talentGroups.type,
        talentGroups.createdAt,
        talentGroups.updatedAt
      );

    if (!groupRow) {
      return null;
    }

    const memberRows = await db
      .select({
        talentId: talentGroupMembers.talentId,
        displayName: contact.displayName,
        jobTitle: talent.jobTitle,
        email: contactEmail.value,
        status: talent.status,
        joinedAt: talentGroupMembers.createdAt,
      })
      .from(talentGroupMembers)
      .innerJoin(talent, eq(talentGroupMembers.talentId, talent.id))
      .leftJoin(contact, eq(talent.contactId, contact.id))
      .leftJoin(
        contactEmail,
        and(eq(contactEmail.contactId, contact.id), eq(contactEmail.primary, true))
      )
      .where(eq(talentGroupMembers.groupId, id))
      .orderBy(desc(talentGroupMembers.createdAt));

    let memberAzvs: {
      id: string;
      talentId: string;
      from: Date | string;
      usedOn: Date | string | null;
      createdAt: Date | string;
    }[] = [];
    if (memberRows.length > 0) {
      const talentIds = memberRows.map((m) => m.talentId);
      try {
        memberAzvs = await db
          .select({
            id: talentAzv.id,
            talentId: talentAzv.talentId,
            from: talentAzv.from,
            usedOn: talentAzv.usedOn,
            createdAt: talentAzv.createdAt,
          })
          .from(talentAzv)
          .where(inArray(talentAzv.talentId, talentIds));
      } catch (azvErr) {
        console.warn('AZV rows fetch warning in readTalentGroup:', azvErr);
      }
    }

    const members = memberRows.map((m) => {
      const azvsForMember = memberAzvs.filter((a) => a.talentId === m.talentId);
      const availableAzvs: TalentAzvItem[] = azvsForMember.map((a) => {
        const fDate = new Date(a.from);
        const dStr = String(fDate.getUTCDate()).padStart(2, '0');
        const mStr = String(fDate.getUTCMonth() + 1).padStart(2, '0');
        const uDate = a.usedOn ? new Date(a.usedOn) : null;
        return {
          id: a.id,
          talentId: a.talentId,
          from: formatDateToYYYYMMDD(fDate),
          formattedFrom: `${dStr}.${mStr}.${fDate.getUTCFullYear()}`,
          usedOn: uDate ? formatDateToYYYYMMDD(uDate) : null,
          formattedUsedOn: uDate
            ? `${String(uDate.getUTCDate()).padStart(2, '0')}.${String(uDate.getUTCMonth() + 1).padStart(2, '0')}.${uDate.getUTCFullYear()}`
            : null,
          createdAt: new Date(a.createdAt).toISOString(),
        };
      });
      const openAzvs = availableAzvs.filter((a) => !a.usedOn);

      return {
        talentId: m.talentId,
        displayName: m.displayName || 'Unnamed Talent',
        jobTitle: m.jobTitle || null,
        email: m.email || null,
        status: m.status || 'unknown',
        joinedAt: m.joinedAt.toISOString(),
        availableAzvs,
        openAzvs,
        openAzvCount: openAzvs.length,
      };
    });

    return {
      id: groupRow.id,
      name: groupRow.name,
      type: groupRow.type,
      memberCount: memberRows.length,
      createdAt: groupRow.createdAt.toISOString(),
      updatedAt: groupRow.updatedAt.toISOString(),
      members,
    };
  }
);

export const createTalentGroup = form(
  createTalentGroupSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const existingGroup = await db.query.talentGroups.findFirst({
      where: and(
        eq(talentGroups.name, input.name),
        eq(talentGroups.type, input.type)
      ),
    });

    if (existingGroup) {
      // Throw an error so submit() rejects and hits the catch block
      throw new Error(`A group of type "${input.type}" with the name "${input.name}" already exists.`);
    }

    const [newGroup] = await db
      .insert(talentGroups)
      .values({
        name: input.name,
        type: input.type,
      })
      .returning();

    void listTalentGroups().refresh();

    return {
      success: true,
      id: newGroup.id,
      group: {
        ...newGroup,
        memberCount: 0,
        createdAt: newGroup.createdAt.toISOString(),
        updatedAt: newGroup.updatedAt.toISOString(),
      },
    };
  }
);

export const updateTalentGroup = form(
  updateTalentGroupSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const updateValues: { name?: string; type?: string } = {};
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.type !== undefined) updateValues.type = input.type;

    const [updated] = await db
      .update(talentGroups)
      .set(updateValues)
      .where(eq(talentGroups.id, input.id))
      .returning();

    if (!updated) {
      throw new Error('Talent group not found');
    }

    void listTalentGroups().refresh();
    void readTalentGroup(input.id).refresh();

    return {
      success: true,
      id: updated.id,
      group: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }
);

export const deleteTalentGroup = command(
  talentGroupIdSchema,
  async (id) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    await db.delete(talentGroups).where(eq(talentGroups.id, id));

    void listTalentGroups().refresh();
    return { success: true };
  }
);

export const addTalentToGroup = command(
  addTalentToGroupSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const [existing] = await db
      .select()
      .from(talentGroupMembers)
      .where(
        and(
          eq(talentGroupMembers.groupId, input.groupId),
          eq(talentGroupMembers.talentId, input.talentId)
        )
      );

    if (!existing) {
      await db.insert(talentGroupMembers).values({
        groupId: input.groupId,
        talentId: input.talentId,
      });
    }

    void listTalentGroups().refresh();
    void readTalentGroup(input.groupId).refresh();

    return { success: true };
  }
);

export const removeTalentFromGroup = command(
  removeTalentFromGroupSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    await db
      .delete(talentGroupMembers)
      .where(
        and(
          eq(talentGroupMembers.groupId, input.groupId),
          eq(talentGroupMembers.talentId, input.talentId)
        )
      );

    void listTalentGroups().refresh();
    void readTalentGroup(input.groupId).refresh();

    return { success: true };
  }
);

function getISOWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function formatDateToYYYYMMDD(d: Date): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff, 0, 0, 0));
}

export const getGroupWeeklyTimesheet = query(
  getGroupWeeklyTimesheetSchema,
  async (input): Promise<GroupWeeklyTimesheetData> => {
    try {
      const user = getAuthenticatedUser();
      ensureAccess(user, 'talents');

      const [group] = await db
        .select()
        .from(talentGroups)
        .where(eq(talentGroups.id, input.groupId));

      if (!group) {
        throw new Error('Talent group not found');
      }

      // Parse weekStartDate (expected to be Monday)
      let mondayDate: Date;
      if (input?.weekStartDate && /^\d{4}-\d{2}-\d{2}$/.test(input.weekStartDate)) {
        const [startYear, startMonth, startDay] = input.weekStartDate.split('-').map(Number);
        mondayDate = new Date(startYear, startMonth - 1, startDay);
      } else {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        mondayDate = new Date(now.getFullYear(), now.getMonth(), diff);
      }
      
      // Generate 7 days: Monday to Sunday
      const weekDays: { dateStr: string; dayName: string; formattedDate: string; dateObj: Date }[] = [];
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      for (let i = 0; i < 7; i++) {
        const d = new Date(mondayDate);
        d.setDate(mondayDate.getDate() + i);
        const dateStr = formatDateToYYYYMMDD(d);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        weekDays.push({
          dateStr,
          dayName: dayNames[i],
          formattedDate: `${day}.${month}`,
          dateObj: d,
        });
      }

      const sundayDate = weekDays[6].dateObj;
      const weekStartUtc = new Date(`${weekDays[0].dateStr}T00:00:00.000Z`);
      const weekEndUtc = new Date(`${weekDays[6].dateStr}T23:59:59.999Z`);

      const weekNumber = getISOWeekNumber(mondayDate);
      const year = mondayDate.getFullYear();

      // Fetch talents in this group
      const memberRows = await db
        .select({
          talentId: talentGroupMembers.talentId,
          talentJcNumber: talent.jcNumber,
          contactGivenName: contact.givenName,
          contactFamilyName: contact.familyName,
          contactDisplayName: contact.displayName,
        })
        .from(talentGroupMembers)
        .innerJoin(talent, eq(talentGroupMembers.talentId, talent.id))
        .leftJoin(contact, eq(talent.contactId, contact.id))
        .where(eq(talentGroupMembers.groupId, input.groupId))
        .orderBy(talentGroupMembers.createdAt);

      if (memberRows.length === 0) {
        return {
          groupId: group.id,
          groupName: group.name,
          groupType: group.type,
          weekNumber,
          year,
          weekStartDate: weekDays[0].dateStr,
          weekEndDate: weekDays[6].dateStr,
          hasAnyJcNumber: false,
          totalGroupDailyHours: 0,
          talents: [],
          conflicts: [],
        };
      }

      const talentIds = memberRows.map((m) => m.talentId);

      // Fetch contracts for these talents safely
      let contracts: {
        talentId: string;
        startDate: Date | string;
        endDate: Date | string | null;
        workHoursPerDay: number | null;
        workHoursPerWeek: number | null;
      }[] = [];
      try {
        contracts = await db
          .select({
            talentId: contract.talentId,
            startDate: contract.startDate,
            endDate: contract.endDate,
            workHoursPerDay: contract.workHoursPerDay,
            workHoursPerWeek: contract.workHoursPerWeek,
          })
          .from(contract)
          .where(inArray(contract.talentId, talentIds))
          .orderBy(desc(contract.startDate));
      } catch (cErr) {
        console.warn('Contracts fetch warning in getGroupWeeklyTimesheet:', cErr);
      }

      // Fetch shift plan templates for talents safely
      let templateAssignments: {
        talentId: string;
        validFrom: Date | string;
        schedule: any;
      }[] = [];
      try {
        templateAssignments = await db
          .select({
            talentId: shiftPlanTemplateTalent.talentId,
            validFrom: shiftPlanTemplateTalent.validFrom,
            schedule: shiftPlanTemplate.schedule,
          })
          .from(shiftPlanTemplateTalent)
          .innerJoin(shiftPlanTemplate, eq(shiftPlanTemplateTalent.templateId, shiftPlanTemplate.id))
          .where(inArray(shiftPlanTemplateTalent.talentId, talentIds))
          .orderBy(desc(shiftPlanTemplateTalent.validFrom));
      } catch (tErr) {
        console.warn('Template assignments fetch warning:', tErr);
      }

      // Fetch timesheet entries for the week safely
      let timesheetRows: {
        id: string;
        talentId: string;
        startTime: Date | string;
        endTime: Date | string | null;
        status: string;
        type: string;
      }[] = [];
      try {
        timesheetRows = await db
          .select({
            id: timesheetEntry.id,
            talentId: timesheetEntry.talentId,
            startTime: timesheetEntry.startTime,
            endTime: timesheetEntry.endTime,
            status: timesheetEntry.status,
            type: timesheetEntry.type,
          })
          .from(timesheetEntry)
          .where(
            and(
              inArray(timesheetEntry.talentId, talentIds),
              gte(timesheetEntry.startTime, weekStartUtc),
              lte(timesheetEntry.startTime, weekEndUtc)
            )
          )
          .orderBy(timesheetEntry.startTime);
      } catch (tsErr) {
        console.warn('Timesheet rows fetch warning:', tsErr);
      }

      // Fetch time off requests overlapping the week safely
      let timeOffRows: {
        id: string;
        talentId: string;
        type: string;
        status: string;
        note: string | null;
        startDate: Date | string;
        endDate: Date | string;
      }[] = [];
      try {
        timeOffRows = await db
          .select({
            id: timeOffRequest.id,
            talentId: timeOffRequest.talentId,
            type: timeOffRequest.type,
            status: timeOffRequest.status,
            note: timeOffRequest.note,
            startDate: timeOffRequest.startDate,
            endDate: timeOffRequest.endDate,
          })
          .from(timeOffRequest)
          .where(
            and(
              inArray(timeOffRequest.talentId, talentIds),
              lte(timeOffRequest.startDate, weekEndUtc),
              gte(timeOffRequest.endDate, weekStartUtc)
            )
          );
      } catch (toErr) {
        console.warn('Time off rows fetch warning:', toErr);
      }

      // Fetch AZV records for group members
      let azvRows: {
        id: string;
        talentId: string;
        from: Date | string;
        usedOn: Date | string | null;
        createdAt: Date | string;
      }[] = [];
      try {
        azvRows = await db
          .select({
            id: talentAzv.id,
            talentId: talentAzv.talentId,
            from: talentAzv.from,
            usedOn: talentAzv.usedOn,
            createdAt: talentAzv.createdAt,
          })
          .from(talentAzv)
          .where(inArray(talentAzv.talentId, talentIds));
      } catch (azvErr) {
        console.warn('AZV rows fetch warning in talent-groups.remote:', azvErr);
      }

      let hasAnyJcNumber = false;
      let totalGroupDailyHours = 0;

      const nowUtc = new Date();
      const currentMondayUtc = getMonday(new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate())));
      const isCurrentOrFutureWeek = mondayDate.getTime() >= currentMondayUtc.getTime();

      const talentRows: GroupWeeklyTalentRow[] = memberRows.map((member, idx) => {
        const jcNumber = member.talentJcNumber ? member.talentJcNumber.trim() : null;
        if (jcNumber) hasAnyJcNumber = true;

        // Given / family / display names
        const displayName = member.contactDisplayName || 'Unnamed Talent';
        const givenName =
          member.contactGivenName || displayName.split(' ')[0] || '';
        const familyName =
          member.contactFamilyName ||
          displayName.split(' ').slice(1).join(' ') ||
          '';

        // Latest contract
        const talentContract = contracts.find((c) => c.talentId === member.talentId);
        const contractStart = talentContract?.startDate
          ? formatDateToYYYYMMDD(new Date(talentContract.startDate))
          : null;
        const contractEnd = talentContract?.endDate
          ? formatDateToYYYYMMDD(new Date(talentContract.endDate))
          : null;

        // Daily hours from template
        const talentTemplates = templateAssignments.filter(
          (t) => t.talentId === member.talentId
        );
        const validTemplate =
          talentTemplates.find((t) => {
            const vf = t.validFrom ? new Date(t.validFrom) : null;
            return vf && !isNaN(vf.getTime()) && vf <= sundayDate;
          }) || talentTemplates[0];

        let dailyExpectedHours = 7.0; // fallback default
        if (validTemplate && Array.isArray(validTemplate.schedule)) {
          let scheduleWeeklyHours = 0;
          for (const item of validTemplate.schedule as any[]) {
            if (item && typeof item === 'object' && item.isActive && item.start && item.end && typeof item.start === 'string' && typeof item.end === 'string') {
              const [sh, sm] = item.start.split(':').map(Number);
              const [eh, em] = item.end.split(':').map(Number);
              if (!isNaN(sh) && !isNaN(eh)) {
                const diff = eh + (em || 0) / 60 - (sh + (sm || 0) / 60);
                if (diff > 0) scheduleWeeklyHours += diff;
              }
            }
          }
          if (scheduleWeeklyHours > 0) {
            dailyExpectedHours = Math.round((scheduleWeeklyHours / 5) * 10) / 10;
          }
        } else if (talentContract?.workHoursPerDay) {
          dailyExpectedHours = Number(talentContract.workHoursPerDay);
        } else if (talentContract?.workHoursPerWeek) {
          dailyExpectedHours = Math.round((Number(talentContract.workHoursPerWeek) / 5) * 10) / 10;
        }

        totalGroupDailyHours += dailyExpectedHours;

        // Filter timesheet entries and excuses for this talent
        const talentTimesheets = timesheetRows.filter(
          (t) => t.talentId === member.talentId
        );
        const talentTimeOffs = timeOffRows.filter(
          (t) => t.talentId === member.talentId
        );
        const memberAzvs = azvRows.filter(
          (a) => a.talentId === member.talentId
        );

        // Build 7 days
        const days: GroupWeeklyDayEntry[] = weekDays.map((wDay) => {
          const dayStart = new Date(`${wDay.dateStr}T00:00:00.000Z`);
          const dayEnd = new Date(`${wDay.dateStr}T23:59:59.999Z`);

          // Contract active check
          let hasContract = false;
          if (talentContract && talentContract.startDate) {
            const cStart = new Date(talentContract.startDate);
            const cEnd = talentContract.endDate ? new Date(talentContract.endDate) : null;
            hasContract = cStart <= dayEnd && (cEnd === null || cEnd >= dayStart);
          }

          // Planned Interval from shift plan template schedule
          let plannedInterval: { startTime: string; endTime: string; durationHours: number } | null = null;
          if (validTemplate && Array.isArray(validTemplate.schedule)) {
            const scheduledDay = (validTemplate.schedule as any[]).find(
              (item) => item && typeof item === 'object' && item.day === wDay.dayName && item.isActive && item.start && item.end
            );
            if (scheduledDay) {
              const [sh, sm] = scheduledDay.start.split(':').map(Number);
              const [eh, em] = scheduledDay.end.split(':').map(Number);
              if (!isNaN(sh) && !isNaN(eh)) {
                const duration = Math.max(0, (eh + (em || 0) / 60) - (sh + (sm || 0) / 60));
                plannedInterval = {
                  startTime: scheduledDay.start,
                  endTime: scheduledDay.end,
                  durationHours: Math.round(duration * 10) / 10,
                };
              }
            }
          }

          // Find timesheets on this day
          const dayTimesheets = talentTimesheets.filter((ts) => {
            if (!ts.startTime) return false;
            const st = new Date(ts.startTime);
            return !isNaN(st.getTime()) && st >= dayStart && st <= dayEnd;
          });

          let rawWorkedHours = 0;
          const timesheetEntries: GroupWeeklyTimesheetTimeEntry[] = dayTimesheets.map((ts) => {
            let duration = 0;
            const st = new Date(ts.startTime);
            if (ts.endTime) {
              const et = new Date(ts.endTime);
              if (!isNaN(et.getTime()) && !isNaN(st.getTime())) {
                const diffMs = et.getTime() - st.getTime();
                duration = Math.max(0, diffMs / (1000 * 60 * 60));
              }
            }
            rawWorkedHours += duration;
            return {
              id: ts.id,
              startTime: !isNaN(st.getTime()) ? st.toISOString() : String(ts.startTime),
              endTime: ts.endTime ? (new Date(ts.endTime).toISOString()) : null,
              durationHours: Math.round(duration * 10) / 10,
              status: ts.status || 'pending',
              type: ts.type || 'manual',
            };
          });

          const workedHours = Math.round(rawWorkedHours * 2) / 2;

          // Find excuse for this day
          const matchingExcuse = talentTimeOffs.find((to) => {
            if (!to.startDate || !to.endDate) return false;
            const st = new Date(to.startDate);
            const et = new Date(to.endDate);
            if (isNaN(st.getTime()) || isNaN(et.getTime())) return false;
            return st <= dayEnd && et >= dayStart;
          });

          let azvId: string | null = null;
          let azvFrom: string | null = null;
          let azvFormattedFrom: string | null = null;

          if (matchingExcuse && matchingExcuse.type === 'AZV') {
            const matchingAzv = memberAzvs.find((a) => {
              if (!a.usedOn) return false;
              const uDate = new Date(a.usedOn);
              return !isNaN(uDate.getTime()) && formatDateToYYYYMMDD(uDate) === wDay.dateStr;
            });

            if (matchingAzv) {
              azvId = matchingAzv.id;
              const fDate = new Date(matchingAzv.from);
              azvFrom = formatDateToYYYYMMDD(fDate);
              const dayStr = String(fDate.getUTCDate()).padStart(2, '0');
              const monStr = String(fDate.getUTCMonth() + 1).padStart(2, '0');
              azvFormattedFrom = `${dayStr}.${monStr}.${fDate.getUTCFullYear()}`;
            } else if (matchingExcuse.note && /vom\s+(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})/i.test(matchingExcuse.note)) {
              const match = matchingExcuse.note.match(/vom\s+(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})/i);
              if (match) {
                const datePart = match[1];
                if (datePart.includes('.')) {
                  azvFormattedFrom = datePart;
                  const [d, m, y] = datePart.split('.');
                  azvFrom = `${y}-${m}-${d}`;
                } else {
                  azvFrom = datePart;
                  const [y, m, d] = datePart.split('-');
                  azvFormattedFrom = `${d}.${m}.${y}`;
                }
              }
            }
          }

          const excuse = matchingExcuse
            ? {
                id: matchingExcuse.id,
                type: matchingExcuse.type,
                status: matchingExcuse.status || 'pending',
                note: matchingExcuse.note || null,
                startDate: matchingExcuse.startDate ? new Date(matchingExcuse.startDate).toISOString() : '',
                endDate: matchingExcuse.endDate ? new Date(matchingExcuse.endDate).toISOString() : '',
                azvId,
                azvFrom,
                azvFormattedFrom,
              }
            : null;

          const hasConflict = dayTimesheets.length > 0 && excuse !== null;
          const isExcusedDay =
            excuse !== null &&
            excuse.status !== 'rejected' &&
            excuse.type !== 'Unentschuldigt' &&
            excuse.note?.toLowerCase() !== 'unentschuldigt';

          return {
            date: wDay.dateStr,
            dayName: wDay.dayName,
            formattedDate: wDay.formattedDate,
            workedHours,
            rawWorkedHours,
            timesheetEntries,
            excuse,
            hasConflict,
            isExcusedDay,
            hasContract,
            plannedInterval,
            isCurrentOrFutureWeek,
          };
        });

        let totalWeeklyExpectedHours = 0;
        let totalWeeklyWorkedHours = 0;
        let totalWeeklyExcusedHours = 0;

        for (const d of days) {
          totalWeeklyWorkedHours += d.workedHours;
          if (d.hasContract) {
            totalWeeklyExpectedHours += dailyExpectedHours;
            if (d.isExcusedDay) {
              totalWeeklyExcusedHours += dailyExpectedHours;
            }
          }
        }

        totalWeeklyExpectedHours = Math.round(totalWeeklyExpectedHours * 10) / 10;
        totalWeeklyWorkedHours = Math.round(totalWeeklyWorkedHours * 10) / 10;
        totalWeeklyExcusedHours = Math.round(totalWeeklyExcusedHours * 10) / 10;

        // Excuses reduce the expected total hours of work
        const adjustedWeeklyExpectedHours = Math.max(
          0,
          Math.round((totalWeeklyExpectedHours - totalWeeklyExcusedHours) * 10) / 10
        );

        const isUnderTarget = totalWeeklyWorkedHours < adjustedWeeklyExpectedHours && totalWeeklyExpectedHours > 0;
        const isOverTarget = totalWeeklyWorkedHours > adjustedWeeklyExpectedHours && totalWeeklyExpectedHours > 0;
        const isExcusedMet = totalWeeklyWorkedHours >= adjustedWeeklyExpectedHours;

        let statusMessage = '';
        if (totalWeeklyExpectedHours === 0) {
          statusMessage = 'No active contract for this week (0h expected)';
        } else if (isUnderTarget) {
          const deficit = (adjustedWeeklyExpectedHours - totalWeeklyWorkedHours).toFixed(1);
          if (totalWeeklyExcusedHours > 0) {
            statusMessage = `Under target: ${totalWeeklyWorkedHours}h worked of ${adjustedWeeklyExpectedHours}h target (${totalWeeklyExcusedHours}h excused from ${totalWeeklyExpectedHours}h base) — Deficit: ${deficit}h`;
          } else {
            statusMessage = `Under target: ${totalWeeklyWorkedHours}h worked of ${totalWeeklyExpectedHours}h target — Deficit: ${deficit}h`;
          }
        } else if (isOverTarget) {
          const surplus = (totalWeeklyWorkedHours - adjustedWeeklyExpectedHours).toFixed(1);
          statusMessage = `Over target: ${totalWeeklyWorkedHours}h worked of ${adjustedWeeklyExpectedHours}h target (+${surplus}h surplus)`;
        } else {
          statusMessage = `Target reached: ${totalWeeklyWorkedHours}h of ${adjustedWeeklyExpectedHours}h expected`;
        }

        const availableAzvs: TalentAzvItem[] = memberAzvs.map((a) => {
          const fDate = new Date(a.from);
          const dStr = String(fDate.getUTCDate()).padStart(2, '0');
          const mStr = String(fDate.getUTCMonth() + 1).padStart(2, '0');
          const uDate = a.usedOn ? new Date(a.usedOn) : null;
          return {
            id: a.id,
            talentId: a.talentId,
            from: formatDateToYYYYMMDD(fDate),
            formattedFrom: `${dStr}.${mStr}.${fDate.getUTCFullYear()}`,
            usedOn: uDate ? formatDateToYYYYMMDD(uDate) : null,
            formattedUsedOn: uDate ? `${String(uDate.getUTCDate()).padStart(2, '0')}.${String(uDate.getUTCMonth() + 1).padStart(2, '0')}.${uDate.getUTCFullYear()}` : null,
            createdAt: new Date(a.createdAt).toISOString(),
          };
        });

        const openAzvs = availableAzvs.filter((a) => !a.usedOn);

        return {
          talentId: member.talentId,
          index: idx + 1,
          givenName,
          familyName,
          displayName,
          contractStart,
          contractEnd,
          jcNumber,
          dailyExpectedHours,
          totalWeeklyExpectedHours,
          adjustedWeeklyExpectedHours,
          totalWeeklyExcusedHours,
          days,
          totalWeeklyWorkedHours,
          isUnderTarget,
          isOverTarget,
          isExcusedMet,
          statusMessage,
          availableAzvs,
          openAzvs,
          openAzvCount: openAzvs.length,
        };
      });

      totalGroupDailyHours = Math.round(totalGroupDailyHours * 10) / 10;

      // Collect all conflicts / warnings across the group
      const conflicts: TimetableConflictItem[] = [];
      for (const tRow of talentRows) {
        // Day conflicts
        for (const day of tRow.days) {
          if (day.hasConflict && day.excuse) {
            conflicts.push({
              talentId: tRow.talentId,
              talentName: tRow.displayName,
              type: 'worked_on_excuse',
              day: day.date,
              formattedDate: day.formattedDate,
              isWeekConflict: false,
              title: `Worked on Excused Day (${day.excuse.type})`,
              description: `${tRow.displayName} worked ${day.workedHours.toFixed(1)}h on an excused absence day (${day.excuse.type}${day.excuse.note ? `: ${day.excuse.note}` : ''}).`,
              timesheetEntryId: day.timesheetEntries[0]?.id,
              excuseId: day.excuse.id,
              workedHours: day.workedHours,
            });
          }

          // AZV missing origin conflict: "AZV from when?"
          if (day.excuse?.type === 'AZV' && !day.excuse.azvFrom) {
            conflicts.push({
              talentId: tRow.talentId,
              talentName: tRow.displayName,
              type: 'azv_missing_origin',
              day: day.date,
              formattedDate: day.formattedDate,
              isWeekConflict: false,
              title: 'AZV from when?',
              description: `${tRow.displayName} has an AZV excuse on ${day.formattedDate}, but no origin date is linked. Click to select or create an AZV.`,
              excuseId: day.excuse.id,
            });
          }
        }

        // Week conflicts / warnings
        if (tRow.isUnderTarget && tRow.adjustedWeeklyExpectedHours > 0) {
          const deficit = Math.round((tRow.adjustedWeeklyExpectedHours - tRow.totalWeeklyWorkedHours) * 10) / 10;
          conflicts.push({
            talentId: tRow.talentId,
            talentName: tRow.displayName,
            type: 'week_deficit',
            day: weekDays[0].dateStr, // Monday date
            formattedDate: `KW ${weekNumber} (${weekDays[0].formattedDate} – ${weekDays[6].formattedDate})`,
            isWeekConflict: true,
            title: `Weekly Target Deficit`,
            description: `${tRow.displayName}: ${tRow.totalWeeklyWorkedHours.toFixed(1)}h worked of ${tRow.adjustedWeeklyExpectedHours.toFixed(1)}h expected (${deficit.toFixed(1)}h deficit).`,
            expectedHours: tRow.adjustedWeeklyExpectedHours,
            workedHours: tRow.totalWeeklyWorkedHours,
            deficitHours: deficit,
          });
        }
      }

      // Persist conflicts into talentTimetableConflicts safely in background
      try {
        const mondayDate = new Date(`${weekDays[0].dateStr}T00:00:00.000Z`);
        const sundayDate = new Date(`${weekDays[6].dateStr}T23:59:59.999Z`);
        
        await db
          .delete(talentTimetableConflicts)
          .where(
            and(
              inArray(talentTimetableConflicts.talentId, talentIds),
              gte(talentTimetableConflicts.day, mondayDate),
              lte(talentTimetableConflicts.day, sundayDate)
            )
          );

        if (conflicts.length > 0) {
          const toInsert = conflicts.map((c) => ({
            talentId: c.talentId,
            type: c.type,
            day: new Date(`${c.day}T00:00:00.000Z`),
            note: c.description,
          }));
          await db.insert(talentTimetableConflicts).values(toInsert);
        }
      } catch (dbConflictErr) {
        console.warn('Conflict persistence warning in talent-groups.remote:', dbConflictErr);
      }

      // Fetch total historical conflicts across timeline from earliest contract start to current week
      let totalHistoricalConflicts: TimetableConflictItem[] = [];
      try {
        let earliestContractDate = new Date();
        for (const c of contracts) {
          if (c.startDate) {
            const d = new Date(c.startDate);
            if (!isNaN(d.getTime()) && d < earliestContractDate) {
              earliestContractDate = d;
            }
          }
        }

        const currentSundayUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() + (7 - ((nowUtc.getUTCDay() + 6) % 7)), 23, 59, 59, 999));

        const allConflictRows = await db
          .select({
            id: talentTimetableConflicts.id,
            talentId: talentTimetableConflicts.talentId,
            type: talentTimetableConflicts.type,
            day: talentTimetableConflicts.day,
            note: talentTimetableConflicts.note,
            talentDisplayName: contact.displayName,
          })
          .from(talentTimetableConflicts)
          .innerJoin(talent, eq(talentTimetableConflicts.talentId, talent.id))
          .leftJoin(contact, eq(talent.contactId, contact.id))
          .where(
            and(
              inArray(talentTimetableConflicts.talentId, talentIds),
              gte(talentTimetableConflicts.day, earliestContractDate),
              lte(talentTimetableConflicts.day, currentSundayUtc)
            )
          )
          .orderBy(desc(talentTimetableConflicts.day));

        totalHistoricalConflicts = allConflictRows.map((row) => {
          const d = new Date(row.day);
          const dayStr = !isNaN(d.getTime()) ? formatDateToYYYYMMDD(d) : '';
          const isWeek = row.type === 'week_deficit' || row.type === 'week_surplus';
          const wNum = !isNaN(d.getTime()) ? getISOWeekNumber(d) : 1;
          return {
            id: row.id,
            talentId: row.talentId,
            talentName: row.talentDisplayName || 'Talent',
            type: row.type as any,
            day: dayStr,
            formattedDate: isWeek ? `KW ${wNum} (${dayStr})` : dayStr,
            isWeekConflict: isWeek,
            title: isWeek ? 'Weekly Target Deficit' : 'Day Absence Conflict',
            description: row.note || '',
          };
        });
      } catch (histErr) {
        console.warn('Total historical conflicts fetch warning:', histErr);
      }

      return {
        groupId: group.id,
        groupName: group.name,
        groupType: group.type,
        weekNumber,
        year,
        weekStartDate: weekDays[0].dateStr,
        weekEndDate: weekDays[6].dateStr,
        hasAnyJcNumber,
        totalGroupDailyHours,
        talents: talentRows,
        conflicts,
        totalHistoricalConflicts,
      };
    } catch (err: any) {
      console.error('[getGroupWeeklyTimesheet Error]:', err);
      throw new Error(err?.message || 'Failed to load weekly attendance data');
    }
  }
);

export const updateTimeOffStatus = command(
  updateTimeOffStatusSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const { timeOffRequest } = await import('@ac/db');
    const [existing] = await db
      .select({ startDate: timeOffRequest.startDate, talentId: timeOffRequest.talentId })
      .from(timeOffRequest)
      .where(eq(timeOffRequest.id, input.requestId));

    await db
      .update(timeOffRequest)
      .set({ status: input.status })
      .where(eq(timeOffRequest.id, input.requestId));

    await refreshGroupAndTimetableQueries({
      talentId: input.talentId || existing?.talentId,
      groupId: input.groupId,
      dateOrMonday: existing?.startDate || new Date(),
    });

    return { success: true };
  }
);

export const deleteTimesheetEntryCommand = command(
  deleteTimesheetEntrySchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const { timesheetEntry } = await import('@ac/db');
    const [existing] = await db
      .select({ startTime: timesheetEntry.startTime, talentId: timesheetEntry.talentId })
      .from(timesheetEntry)
      .where(eq(timesheetEntry.id, input.entryId));

    await db.delete(timesheetEntry).where(eq(timesheetEntry.id, input.entryId));

    await refreshGroupAndTimetableQueries({
      talentId: input.talentId || existing?.talentId,
      groupId: input.groupId,
      dateOrMonday: existing?.startTime || new Date(),
    });

    return { success: true };
  }
);

export const createManualTimesheetEntry = command(
  createManualTimesheetEntrySchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const { timesheetEntry } = await import('@ac/db');
    const [newEntry] = await db
      .insert(timesheetEntry)
      .values({
        talentId: input.talentId,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        type: 'manual',
        status: 'approved',
      })
      .returning();

    await refreshGroupAndTimetableQueries({
      talentId: input.talentId,
      groupId: input.groupId,
      dateOrMonday: input.startTime,
    });

    return { success: true, id: newEntry.id };
  }
);

export const setDayExcuseCommand = command(
  setDayExcuseSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const [year, month, day] = input.date.split('-').map(Number);
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // Delete existing time off requests overlapping this day
    await db
      .delete(timeOffRequest)
      .where(
        and(
          eq(timeOffRequest.talentId, input.talentId),
          lte(timeOffRequest.startDate, dayEnd),
          gte(timeOffRequest.endDate, dayStart)
        )
      );

    if (!input.delete && input.type) {
      await db.insert(timeOffRequest).values({
        talentId: input.talentId,
        type: input.type as any,
        note: input.note || input.reason || null,
        status: (input.status || 'approved') as any,
        startDate: dayStart,
        endDate: dayEnd,
      });
    }

    await refreshGroupAndTimetableQueries({
      talentId: input.talentId,
      groupId: input.groupId,
      dateOrMonday: input.date,
    });

    return { success: true };
  }
);

export const getGroupTotalConflicts = query(
  talentGroupIdSchema,
  async (groupId): Promise<TimetableConflictItem[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const memberRows = await db
      .select({ talentId: talentGroupMembers.talentId })
      .from(talentGroupMembers)
      .where(eq(talentGroupMembers.groupId, groupId));

    if (memberRows.length === 0) return [];

    const talentIds = memberRows.map((m) => m.talentId);

    let earliestDate = new Date();
    try {
      const contractRows = await db
        .select({ startDate: contract.startDate })
        .from(contract)
        .where(inArray(contract.talentId, talentIds));

      for (const c of contractRows) {
        if (c.startDate) {
          const d = new Date(c.startDate);
          if (!isNaN(d.getTime()) && d < earliestDate) {
            earliestDate = d;
          }
        }
      }
    } catch (cErr) {
      console.warn('Contracts fetch error in getGroupTotalConflicts:', cErr);
    }

    const now = new Date();
    const currentWeekSunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (7 - ((now.getUTCDay() + 6) % 7)), 23, 59, 59, 999));

    try {
      const conflictRows = await db
        .select({
          id: talentTimetableConflicts.id,
          talentId: talentTimetableConflicts.talentId,
          type: talentTimetableConflicts.type,
          day: talentTimetableConflicts.day,
          note: talentTimetableConflicts.note,
          talentDisplayName: contact.displayName,
        })
        .from(talentTimetableConflicts)
        .innerJoin(talent, eq(talentTimetableConflicts.talentId, talent.id))
        .leftJoin(contact, eq(talent.contactId, contact.id))
        .where(
          and(
            inArray(talentTimetableConflicts.talentId, talentIds),
            gte(talentTimetableConflicts.day, earliestDate),
            lte(talentTimetableConflicts.day, currentWeekSunday)
          )
        )
        .orderBy(desc(talentTimetableConflicts.day));

      return conflictRows.map((row) => {
        const d = new Date(row.day);
        const dayStr = !isNaN(d.getTime()) ? formatDateToYYYYMMDD(d) : '';
        const isWeek = row.type === 'week_deficit' || row.type === 'week_surplus';
        const wNum = !isNaN(d.getTime()) ? getISOWeekNumber(d) : 1;
        let conflictTitle = 'Day Absence Conflict';
        if (row.type === 'azv_missing_origin') {
          conflictTitle = 'AZV from when?';
        } else if (isWeek) {
          conflictTitle = 'Weekly Target Deficit';
        }

        return {
          id: row.id,
          talentId: row.talentId,
          talentName: row.talentDisplayName || 'Talent',
          type: row.type as any,
          day: dayStr,
          formattedDate: isWeek ? `KW ${wNum} (${dayStr})` : dayStr,
          isWeekConflict: isWeek,
          title: conflictTitle,
          description: row.note || '',
        };
      });
    } catch (confErr) {
      console.warn('Total conflicts query error:', confErr);
      return [];
    }
  }
);

export const createTalentAzvCommand = command(
  createTalentAzvSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const fromDate = new Date(`${input.from.trim()}T00:00:00.000Z`);
    const usedOnStr = input.usedOn && input.usedOn.trim() ? input.usedOn.trim() : null;
    const usedOnDate = usedOnStr ? new Date(`${usedOnStr}T00:00:00.000Z`) : null;

    const [newAzv] = await db
      .insert(talentAzv)
      .values({
        talentId: input.talentId,
        from: fromDate,
        usedOn: usedOnDate,
      })
      .returning();

    if (usedOnDate && usedOnStr) {
      const fDay = String(fromDate.getUTCDate()).padStart(2, '0');
      const fMonth = String(fromDate.getUTCMonth() + 1).padStart(2, '0');
      const formattedFrom = `${fDay}.${fMonth}.${fromDate.getUTCFullYear()}`;
      
      const dayStart = new Date(`${usedOnStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${usedOnStr}T23:59:59.999Z`);
      
      await db
        .update(timeOffRequest)
        .set({ note: `AZV vom ${formattedFrom}` })
        .where(
          and(
            eq(timeOffRequest.talentId, input.talentId),
            eq(timeOffRequest.type, 'AZV'),
            gte(timeOffRequest.startDate, dayStart),
            lte(timeOffRequest.startDate, dayEnd)
          )
        );
    }

    await refreshGroupAndTimetableQueries({
      talentId: input.talentId,
      groupId: input.groupId,
      dateOrMonday: usedOnStr || input.from,
    });

    return {
      success: true,
      azv: newAzv,
    };
  }
);

export const linkAzvToExcuseCommand = command(
  linkAzvToExcuseSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const usedOnDate = new Date(`${input.usedOn}T00:00:00.000Z`);

    const [updatedAzv] = await db
      .update(talentAzv)
      .set({ usedOn: usedOnDate })
      .where(eq(talentAzv.id, input.azvId))
      .returning();

    if (updatedAzv) {
      const fromDate = new Date(updatedAzv.from);
      const fDay = String(fromDate.getUTCDate()).padStart(2, '0');
      const fMonth = String(fromDate.getUTCMonth() + 1).padStart(2, '0');
      const formattedFrom = `${fDay}.${fMonth}.${fromDate.getUTCFullYear()}`;

      const dayStart = new Date(`${input.usedOn}T00:00:00.000Z`);
      const dayEnd = new Date(`${input.usedOn}T23:59:59.999Z`);

      await db
        .update(timeOffRequest)
        .set({ note: `AZV vom ${formattedFrom}` })
        .where(
          and(
            eq(timeOffRequest.talentId, input.talentId),
            eq(timeOffRequest.type, 'AZV'),
            gte(timeOffRequest.startDate, dayStart),
            lte(timeOffRequest.startDate, dayEnd)
          )
        );
    }

    await refreshGroupAndTimetableQueries({
      talentId: input.talentId,
      groupId: input.groupId,
      dateOrMonday: input.usedOn,
    });

    return { success: true, azv: updatedAzv };
  }
);

export const awardWeekSurplusAzvCommand = command(
  awardWeekSurplusAzvSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const fromDate = new Date(`${input.fromDate}T00:00:00.000Z`);

    const [newAzv] = await db
      .insert(talentAzv)
      .values({
        talentId: input.talentId,
        from: fromDate,
        usedOn: null,
      })
      .returning();

    await refreshGroupAndTimetableQueries({
      talentId: input.talentId,
      groupId: input.groupId,
      dateOrMonday: input.fromDate,
    });

    return { success: true, azv: newAzv };
  }
);

export const deleteTalentAzvCommand = command(
  deleteTalentAzvSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const [existing] = await db
      .select()
      .from(talentAzv)
      .where(eq(talentAzv.id, input.azvId));

    if (existing) {
      if (existing.usedOn) {
        const dStr = formatDateToYYYYMMDD(new Date(existing.usedOn));
        const dayStart = new Date(`${dStr}T00:00:00.000Z`);
        const dayEnd = new Date(`${dStr}T23:59:59.999Z`);
        await db
          .update(timeOffRequest)
          .set({ note: null })
          .where(
            and(
              eq(timeOffRequest.talentId, input.talentId),
              eq(timeOffRequest.type, 'AZV'),
              gte(timeOffRequest.startDate, dayStart),
              lte(timeOffRequest.startDate, dayEnd)
            )
          );
      }

      await db.delete(talentAzv).where(eq(talentAzv.id, input.azvId));
    }

    await refreshGroupAndTimetableQueries({
      talentId: input.talentId,
      groupId: input.groupId,
      dateOrMonday: existing?.usedOn || existing?.from,
    });

    return { success: true };
  }
);

export const listTalentAzvs = query(
  talentIdSchema,
  async (id): Promise<TalentAzvItem[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const azvRows = await db
      .select({
        id: talentAzv.id,
        talentId: talentAzv.talentId,
        from: talentAzv.from,
        usedOn: talentAzv.usedOn,
        createdAt: talentAzv.createdAt,
      })
      .from(talentAzv)
      .where(eq(talentAzv.talentId, id))
      .orderBy(desc(talentAzv.from));

    return azvRows.map((a) => {
      const fDate = new Date(a.from);
      const dStr = String(fDate.getUTCDate()).padStart(2, '0');
      const mStr = String(fDate.getUTCMonth() + 1).padStart(2, '0');
      const uDate = a.usedOn ? new Date(a.usedOn) : null;
      return {
        id: a.id,
        talentId: a.talentId,
        from: formatDateToYYYYMMDD(fDate),
        formattedFrom: `${dStr}.${mStr}.${fDate.getUTCFullYear()}`,
        usedOn: uDate ? formatDateToYYYYMMDD(uDate) : null,
        formattedUsedOn: uDate
          ? `${String(uDate.getUTCDate()).padStart(2, '0')}.${String(uDate.getUTCMonth() + 1).padStart(2, '0')}.${uDate.getUTCFullYear()}`
          : null,
        createdAt: new Date(a.createdAt).toISOString(),
      };
    });
  }
);