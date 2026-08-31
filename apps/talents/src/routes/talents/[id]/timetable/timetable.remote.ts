import { db, talent, contact, contract, timeOffRequest, timesheetEntry, shiftPlanTemplate, shiftPlanTemplateTalent, talentTimetableConflicts, talentAzv, talentGroups, talentGroupMembers, eq, desc, and, inArray, gte, lte } from '@ac/db';
import {
  getTalentMonthlyTimetableSchema,
  saveTalentDayTimetableSchema,
  type TalentMonthlyTimetableData,
  type TalentMonthlyTimetableWeek,
  type TalentMonthlyTimetableDay,
  type TalentMonthlyTimetableTimeInterval,
  type TimetableConflictItem,
  type TalentAzvItem,
} from '@ac/validations';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { query, command } from '$app/server';
import {
  getGroupWeeklyTimesheet,
  getGroupTotalConflicts,
  readTalentGroup,
  listTalentGroups,
} from '../../../talent-groups/talent-groups.remote';

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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const getTalentMonthlyTimetable = query(
  getTalentMonthlyTimetableSchema,
  async (input): Promise<TalentMonthlyTimetableData> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    try {
      // Fetch talent & contact details
      const [talentRow] = await db
        .select({
          id: talent.id,
          jobTitle: talent.jobTitle,
          contactGivenName: contact.givenName,
          contactFamilyName: contact.familyName,
          contactDisplayName: contact.displayName,
        })
        .from(talent)
        .leftJoin(contact, eq(talent.contactId, contact.id))
        .where(eq(talent.id, input.talentId));

      if (!talentRow) {
        throw new Error('Talent not found');
      }

      const displayName = talentRow.contactDisplayName || 'Unnamed Talent';
      const givenName = talentRow.contactGivenName || displayName.split(' ')[0] || '';
      const familyName =
        talentRow.contactFamilyName || displayName.split(' ').slice(1).join(' ') || '';

      const now = new Date();
      const year = Number(input.year) || now.getFullYear();
      const month = Number(input.month) || now.getMonth() + 1;
      const monthIndex = month - 1;
      const daysInMonth = new Date(year, month, 0).getDate();

      // Ensure full calendar weeks from Monday to Sunday
      const firstDayOfMonth = new Date(year, monthIndex, 1);
      const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun
      const offsetBefore = (firstDayOfWeek + 6) % 7; // 0 for Mon, 6 for Sun
      const viewStartDate = new Date(year, monthIndex, 1 - offsetBefore);

      const lastDayOfMonth = new Date(year, monthIndex, daysInMonth);
      const lastDayOfWeek = lastDayOfMonth.getDay(); // 0 is Sun
      const offsetAfter = (7 - ((lastDayOfWeek + 6) % 7) - 1) % 7;
      const viewEndDate = new Date(year, monthIndex, daysInMonth + offsetAfter);

      const viewStartUtc = new Date(Date.UTC(viewStartDate.getFullYear(), viewStartDate.getMonth(), viewStartDate.getDate(), 0, 0, 0));
      const viewEndUtc = new Date(Date.UTC(viewEndDate.getFullYear(), viewEndDate.getMonth(), viewEndDate.getDate(), 23, 59, 59, 999));
      const monthStartUtc = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
      const monthEndUtc = new Date(Date.UTC(year, monthIndex, daysInMonth, 23, 59, 59, 999));

      // Fetch talent's groups
      let groups: { id: string; name: string; type: string }[] = [];
      try {
        groups = await db
          .select({
            id: talentGroups.id,
            name: talentGroups.name,
            type: talentGroups.type,
          })
          .from(talentGroupMembers)
          .innerJoin(talentGroups, eq(talentGroupMembers.groupId, talentGroups.id))
          .where(eq(talentGroupMembers.talentId, input.talentId));
      } catch (gErr) {
        console.warn('Groups fetch warning in timetable.remote:', gErr);
      }

      // Fetch shift plan template safely
      let templateAssignments: {
        validFrom: Date | string;
        schedule: any;
      }[] = [];
      try {
        templateAssignments = await db
          .select({
            validFrom: shiftPlanTemplateTalent.validFrom,
            schedule: shiftPlanTemplate.schedule,
          })
          .from(shiftPlanTemplateTalent)
          .innerJoin(shiftPlanTemplate, eq(shiftPlanTemplateTalent.templateId, shiftPlanTemplate.id))
          .where(eq(shiftPlanTemplateTalent.talentId, input.talentId))
          .orderBy(desc(shiftPlanTemplateTalent.validFrom));
      } catch (tErr) {
        console.warn('Template assignments fetch warning in timetable.remote:', tErr);
      }

      // Fetch contract safely
      let contracts: {
        startDate: Date | string | null;
        endDate: Date | string | null;
        workHoursPerDay: number | null;
        workHoursPerWeek: number | null;
      }[] = [];
      try {
        contracts = await db
          .select({
            startDate: contract.startDate,
            endDate: contract.endDate,
            workHoursPerDay: contract.workHoursPerDay,
            workHoursPerWeek: contract.workHoursPerWeek,
          })
          .from(contract)
          .where(eq(contract.talentId, input.talentId))
          .orderBy(desc(contract.startDate));
      } catch (cErr) {
        console.warn('Contracts fetch warning in timetable.remote:', cErr);
      }

      const talentContract = contracts[0];

      // Fetch timesheet entries in calendar view safely
      let timesheetRows: {
        id: string;
        startTime: Date | string;
        endTime: Date | string | null;
        status: string;
        type: string;
      }[] = [];
      try {
        timesheetRows = await db
          .select({
            id: timesheetEntry.id,
            startTime: timesheetEntry.startTime,
            endTime: timesheetEntry.endTime,
            status: timesheetEntry.status,
            type: timesheetEntry.type,
          })
          .from(timesheetEntry)
          .where(
            and(
              eq(timesheetEntry.talentId, input.talentId),
              gte(timesheetEntry.startTime, viewStartUtc),
              lte(timesheetEntry.startTime, viewEndUtc)
            )
          )
          .orderBy(timesheetEntry.startTime);
      } catch (tsErr) {
        console.warn('Timesheet rows fetch warning in timetable.remote:', tsErr);
      }

      // Fetch time off requests in calendar view safely
      let timeOffRows: {
        id: string;
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
            type: timeOffRequest.type,
            status: timeOffRequest.status,
            note: timeOffRequest.note,
            startDate: timeOffRequest.startDate,
            endDate: timeOffRequest.endDate,
          })
          .from(timeOffRequest)
          .where(
            and(
              eq(timeOffRequest.talentId, input.talentId),
              lte(timeOffRequest.startDate, viewEndUtc),
              gte(timeOffRequest.endDate, viewStartUtc)
            )
          );
      } catch (toErr) {
        console.warn('Time off rows fetch warning in timetable.remote:', toErr);
      }

      // Fetch AZVs for this talent safely
      let azvRows: {
        id: string;
        talentId: string;
        from: Date | string;
        usedOn: Date | string | null;
      }[] = [];
      try {
        azvRows = await db
          .select({
            id: talentAzv.id,
            talentId: talentAzv.talentId,
            from: talentAzv.from,
            usedOn: talentAzv.usedOn,
          })
          .from(talentAzv)
          .where(eq(talentAzv.talentId, input.talentId));
      } catch (azvErr) {
        console.warn('AZV rows fetch warning in timetable.remote:', azvErr);
      }

      // Build day map & calculate daily expected hours per day
      const allDays: TalentMonthlyTimetableDay[] = [];
      const curr = new Date(viewStartDate.getFullYear(), viewStartDate.getMonth(), viewStartDate.getDate());
      const endLimit = new Date(viewEndDate.getFullYear(), viewEndDate.getMonth(), viewEndDate.getDate());

      while (curr <= endLimit) {
        const dateStr = formatDateToYYYYMMDD(curr);
        const dayOfWeekNum = curr.getDay(); // 0 is Sunday
        const dayOfWeek = DAY_NAMES[dayOfWeekNum];
        const isWeekend = dayOfWeekNum === 0 || dayOfWeekNum === 6;
        const isOutsideMonth = curr.getMonth() !== monthIndex;

        const day = String(curr.getDate()).padStart(2, '0');
        const mStr = String(curr.getMonth() + 1).padStart(2, '0');
        const formattedDate = `${day}.${mStr}.${curr.getFullYear()}`;

        // Active template for this date
        const validTemplate =
          templateAssignments.find((t) => {
            const vf = t.validFrom ? new Date(t.validFrom) : null;
            return vf && !isNaN(vf.getTime()) && vf <= curr;
          }) || templateAssignments[0];

        let expectedHours = 0;
        if (validTemplate && Array.isArray(validTemplate.schedule)) {
          const daySchedule = (validTemplate.schedule as any[]).find(
            (s) => s && typeof s === 'object' && s.day?.toLowerCase() === dayOfWeek.toLowerCase()
          );
          if (daySchedule?.isActive && daySchedule?.start && daySchedule?.end && typeof daySchedule.start === 'string' && typeof daySchedule.end === 'string') {
            const [sh, sm] = daySchedule.start.split(':').map(Number);
            const [eh, em] = daySchedule.end.split(':').map(Number);
            if (!isNaN(sh) && !isNaN(eh)) {
              const diff = eh + (em || 0) / 60 - (sh + (sm || 0) / 60);
              if (diff > 0) expectedHours = Math.round(diff * 10) / 10;
            }
          }
        } else if (!isWeekend) {
          if (talentContract?.workHoursPerDay) {
            expectedHours = Number(talentContract.workHoursPerDay);
          } else if (talentContract?.workHoursPerWeek) {
            expectedHours = Math.round((Number(talentContract.workHoursPerWeek) / 5) * 10) / 10;
          } else {
            expectedHours = 7.0;
          }
        }

        // Timesheet intervals for this day
        const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

        const dayTimesheets = timesheetRows.filter((ts) => {
          if (!ts.startTime) return false;
          const st = new Date(ts.startTime);
          return !isNaN(st.getTime()) && st >= dayStart && st <= dayEnd;
        });

        let rawWorkedHours = 0;
        const intervals: TalentMonthlyTimetableTimeInterval[] = dayTimesheets.map((ts) => {
          const st = new Date(ts.startTime);
          const et = ts.endTime ? new Date(ts.endTime) : null;
          const startFormatted = !isNaN(st.getTime())
            ? `${String(st.getUTCHours()).padStart(2, '0')}:${String(st.getUTCMinutes()).padStart(2, '0')}`
            : '08:00';
          const endFormatted = et && !isNaN(et.getTime())
            ? `${String(et.getUTCHours()).padStart(2, '0')}:${String(et.getUTCMinutes()).padStart(2, '0')}`
            : '';

          let duration = 0;
          if (et && !isNaN(et.getTime()) && !isNaN(st.getTime())) {
            duration = Math.max(0, (et.getTime() - st.getTime()) / (1000 * 60 * 60));
          }
          rawWorkedHours += duration;

          return {
            id: ts.id,
            startTime: startFormatted,
            endTime: endFormatted,
            durationHours: Math.round(duration * 10) / 10,
          };
        });

        const workedHours = Math.round(rawWorkedHours * 2) / 2;

        // Excuse for this day
        const matchingExcuse = timeOffRows.find((to) => {
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
          const matchingAzv = azvRows.find((a) => {
            if (!a.usedOn) return false;
            const uDate = new Date(a.usedOn);
            return !isNaN(uDate.getTime()) && formatDateToYYYYMMDD(uDate) === dateStr;
          });

          if (matchingAzv) {
            azvId = matchingAzv.id;
            const fDate = new Date(matchingAzv.from);
            azvFrom = formatDateToYYYYMMDD(fDate);
            const dStr = String(fDate.getUTCDate()).padStart(2, '0');
            const mStr = String(fDate.getUTCMonth() + 1).padStart(2, '0');
            azvFormattedFrom = `${dStr}.${mStr}.${fDate.getUTCFullYear()}`;
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
                const [y, m, d] = azvFrom.split('-');
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
              reason: matchingExcuse.note || matchingExcuse.type,
              azvId,
              azvFrom,
              azvFormattedFrom,
            }
          : null;

        const hasConflict = intervals.length > 0 && excuse !== null;
        const isExcusedDay =
          excuse !== null &&
          excuse.status !== 'rejected' &&
          excuse.type !== 'Unentschuldigt' &&
          excuse.note?.toLowerCase() !== 'unentschuldigt';

        // Contract active check
        let hasContract = false;
        if (talentContract && talentContract.startDate) {
          const cStart = new Date(talentContract.startDate);
          const cEnd = talentContract.endDate ? new Date(talentContract.endDate) : null;
          hasContract = cStart <= dayEnd && (cEnd === null || cEnd >= dayStart);
        }

        // Planned interval from shift plan template
        let plannedInterval: { startTime: string; endTime: string; durationHours: number } | null = null;
        if (validTemplate && Array.isArray(validTemplate.schedule)) {
          const scheduledDay = (validTemplate.schedule as any[]).find(
            (item) => item && typeof item === 'object' && item.day === dayOfWeek && item.isActive && item.start && item.end
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

        const nowUtc = new Date();
        const currentMondayUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() - ((nowUtc.getUTCDay() + 6) % 7), 0, 0, 0));
        const dayMondayUtc = new Date(Date.UTC(curr.getFullYear(), curr.getMonth(), curr.getDate() - ((dayOfWeekNum + 6) % 7), 0, 0, 0));
        const isCurrentOrFutureWeek = dayMondayUtc.getTime() >= currentMondayUtc.getTime();

        const adjustedExpectedHours = (hasContract && !isExcusedDay) ? expectedHours : 0;

        allDays.push({
          date: dateStr,
          dayOfWeek,
          formattedDate,
          isWeekend,
          expectedHours: hasContract ? expectedHours : 0,
          adjustedExpectedHours,
          intervals,
          excuse,
          workedHours,
          rawWorkedHours,
          hasConflict,
          hasContract,
          plannedInterval,
          isCurrentOrFutureWeek,
          isOutsideMonth,
        });

        curr.setDate(curr.getDate() + 1);
      }

      // Group days into weeks by ISO week number
      const weeksMap = new Map<number, TalentMonthlyTimetableDay[]>();
      for (const day of allDays) {
        const [y, m, d] = day.date.split('-').map(Number);
        const wNum = getISOWeekNumber(new Date(y, m - 1, d));
        if (!weeksMap.has(wNum)) {
          weeksMap.set(wNum, []);
        }
        weeksMap.get(wNum)!.push(day);
      }

      const weeks: TalentMonthlyTimetableWeek[] = [];
      let monthlyExpectedHours = 0;
      let monthlyAdjustedExpectedHours = 0;
      let monthlyWorkedHours = 0;
      const conflicts: TimetableConflictItem[] = [];

      const nowUtc = new Date();
      const currentMondayUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() - ((nowUtc.getUTCDay() + 6) % 7), 0, 0, 0));

      for (const [wNum, days] of weeksMap.entries()) {
        let totalExpectedHours = 0;
        let adjustedExpectedHours = 0;
        let totalWorkedHours = 0;

        for (const d of days) {
          totalExpectedHours += d.expectedHours;
          adjustedExpectedHours += d.adjustedExpectedHours;
          totalWorkedHours += d.workedHours;

          // For monthly sums, only include days in this actual month
          if (!d.isOutsideMonth) {
            monthlyExpectedHours += d.expectedHours;
            monthlyAdjustedExpectedHours += d.adjustedExpectedHours;
            monthlyWorkedHours += d.workedHours;
          }

          // Day conflicts
          if (d.hasConflict && d.excuse) {
            conflicts.push({
              talentId: talentRow.id,
              talentName: displayName,
              type: 'worked_on_excuse',
              day: d.date,
              formattedDate: d.formattedDate,
              isWeekConflict: false,
              title: `Worked on Excused Day (${d.excuse.type})`,
              description: `Recorded ${d.workedHours.toFixed(1)}h work on ${d.excuse.type}${d.excuse.note ? ` (${d.excuse.note})` : ''}`,
              timesheetEntryId: d.intervals[0]?.id,
              excuseId: d.excuse.id,
              workedHours: d.workedHours,
            });
          }

          // AZV missing origin
          if (d.excuse?.type === 'AZV' && !d.excuse.azvFrom) {
            conflicts.push({
              talentId: talentRow.id,
              talentName: displayName,
              type: 'azv_missing_origin',
              day: d.date,
              formattedDate: d.formattedDate,
              isWeekConflict: false,
              title: 'AZV from when?',
              description: `AZV excuse recorded on ${d.formattedDate} without origin date.`,
              excuseId: d.excuse.id,
            });
          }
        }

        totalExpectedHours = Math.round(totalExpectedHours * 10) / 10;
        adjustedExpectedHours = Math.round(adjustedExpectedHours * 10) / 10;
        totalWorkedHours = Math.round(totalWorkedHours * 10) / 10;

        const diff = Math.round((totalWorkedHours - adjustedExpectedHours) * 10) / 10;
        const isTargetMet = totalWorkedHours >= adjustedExpectedHours;
        const isUnderTarget = totalWorkedHours < adjustedExpectedHours;
        const isOverTarget = totalWorkedHours > adjustedExpectedHours;

        // Check if week is in the past
        let isPassedWeek = false;
        if (days[0]?.date) {
          const [wy, wm, wd] = days[0].date.split('-').map(Number);
          const wMonUtc = new Date(Date.UTC(wy, wm - 1, wd, 0, 0, 0));
          isPassedWeek = wMonUtc.getTime() < currentMondayUtc.getTime();
        }

        let statusMessage = '';
        if (isUnderTarget) {
          statusMessage = `Deficit: ${totalWorkedHours}h of ${adjustedExpectedHours}h target (${diff}h)`;
          if (adjustedExpectedHours > 0) {
            const deficitHours = Math.round((adjustedExpectedHours - totalWorkedHours) * 10) / 10;
            const mondayDay = days[0]?.date || `${year}-${String(month).padStart(2, '0')}-01`;
            conflicts.push({
              talentId: talentRow.id,
              talentName: displayName,
              type: 'week_deficit',
              day: mondayDay,
              formattedDate: `KW ${wNum}`,
              isWeekConflict: true,
              title: `Weekly Target Deficit`,
              description: `KW ${wNum}: ${totalWorkedHours}h worked of ${adjustedExpectedHours}h target (${deficitHours}h deficit)`,
              expectedHours: adjustedExpectedHours,
              workedHours: totalWorkedHours,
              deficitHours,
            });
          }
        } else if (isOverTarget) {
          statusMessage = `Target exceeded: ${totalWorkedHours}h of ${adjustedExpectedHours}h target (+${diff}h)`;
        } else {
          statusMessage = `Target met: ${totalWorkedHours}h of ${adjustedExpectedHours}h expected`;
        }

        weeks.push({
          weekNumber: wNum,
          days,
          totalExpectedHours,
          adjustedExpectedHours,
          totalWorkedHours,
          isTargetMet,
          isUnderTarget,
          isOverTarget,
          differenceHours: diff,
          statusMessage,
          isPassedWeek,
        });
      }

      monthlyExpectedHours = Math.round(monthlyExpectedHours * 10) / 10;
      monthlyAdjustedExpectedHours = Math.round(monthlyAdjustedExpectedHours * 10) / 10;
      monthlyWorkedHours = Math.round(monthlyWorkedHours * 10) / 10;

      // Persist conflicts into talentTimetableConflicts safely in background
      try {
        await db
          .delete(talentTimetableConflicts)
          .where(
            and(
              eq(talentTimetableConflicts.talentId, talentRow.id),
              gte(talentTimetableConflicts.day, monthStartUtc),
              lte(talentTimetableConflicts.day, monthEndUtc)
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
        console.warn('Conflict persistence warning in timetable.remote:', dbConflictErr);
      }

      const availableAzvs: TalentAzvItem[] = azvRows.map((a) => {
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
          createdAt: new Date().toISOString(),
        };
      });
      const openAzvs = availableAzvs.filter((a) => !a.usedOn);

      return {
        talentId: talentRow.id,
        displayName,
        givenName,
        familyName,
        jobTitle: talentRow.jobTitle,
        year,
        month,
        monthName: MONTH_NAMES[monthIndex] || `Month ${month}`,
        weeks,
        monthlyExpectedHours,
        monthlyAdjustedExpectedHours,
        monthlyWorkedHours,
        conflicts,
        groups,
        availableAzvs,
        openAzvs,
        openAzvCount: openAzvs.length,
      };
    } catch (err: any) {
      console.error('[getTalentMonthlyTimetable Error]:', err);
      throw new Error(err?.message || 'Failed to load talent timetable');
    }
  }
);

export const saveTalentDayTimetable = command(
  saveTalentDayTimetableSchema,
  async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const [year, month, day] = input.date.split('-').map(Number);
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // Delete existing timesheets on that date for this talent
    await db
      .delete(timesheetEntry)
      .where(
        and(
          eq(timesheetEntry.talentId, input.talentId),
          gte(timesheetEntry.startTime, dayStart),
          lte(timesheetEntry.startTime, dayEnd)
        )
      );

    // Insert new intervals
    for (const interval of input.entries) {
      if (interval.startTime && interval.endTime) {
        const [sh, sm] = interval.startTime.split(':').map(Number);
        const [eh, em] = interval.endTime.split(':').map(Number);

        if (!isNaN(sh) && !isNaN(eh)) {
          const st = new Date(Date.UTC(year, month - 1, day, sh, sm || 0, 0));
          const et = new Date(Date.UTC(year, month - 1, day, eh, em || 0, 0));

          await db.insert(timesheetEntry).values({
            talentId: input.talentId,
            startTime: st,
            endTime: et,
            type: 'manual',
            status: 'approved',
          });
        }
      }
    }

    // Handle excuse
    if (input.excuse) {
      if (input.excuse.delete) {
        await db
          .delete(timeOffRequest)
          .where(
            and(
              eq(timeOffRequest.talentId, input.talentId),
              lte(timeOffRequest.startDate, dayEnd),
              gte(timeOffRequest.endDate, dayStart)
            )
          );
      } else if (input.excuse.type) {
        // Remove existing excuse on this day first
        await db
          .delete(timeOffRequest)
          .where(
            and(
              eq(timeOffRequest.talentId, input.talentId),
              lte(timeOffRequest.startDate, dayEnd),
              gte(timeOffRequest.endDate, dayStart)
            )
          );

        await db.insert(timeOffRequest).values({
          talentId: input.talentId,
          type: input.excuse.type as any,
          note: input.excuse.note || input.excuse.reason || null,
          status: (input.excuse.status || 'approved') as any,
          startDate: dayStart,
          endDate: dayEnd,
        });
      }
    }

    void getTalentMonthlyTimetable({
      talentId: input.talentId,
      year,
      month,
    }).refresh();

    // Calculate Monday date string for weekly timesheet refresh
    const dObj = new Date(Date.UTC(year, month - 1, day));
    const dayNr = (dObj.getUTCDay() + 6) % 7;
    const mondayObj = new Date(Date.UTC(year, month - 1, day - dayNr));
    const mondayStr = `${mondayObj.getUTCFullYear()}-${String(mondayObj.getUTCMonth() + 1).padStart(2, '0')}-${String(mondayObj.getUTCDate()).padStart(2, '0')}`;

    try {
      const memberGroups = await db
        .select({ groupId: talentGroupMembers.groupId })
        .from(talentGroupMembers)
        .where(eq(talentGroupMembers.talentId, input.talentId));

      for (const g of memberGroups) {
        void getGroupWeeklyTimesheet({
          groupId: g.groupId,
          weekStartDate: mondayStr,
        }).refresh();
        void getGroupTotalConflicts(g.groupId).refresh();
        void readTalentGroup(g.groupId).refresh();
      }
    } catch (gErr) {
      console.warn('Error refreshing group weekly timesheet on saveTalentDayTimetable:', gErr);
    }

    return { success: true };
  }
);
