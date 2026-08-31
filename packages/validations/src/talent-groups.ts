import * as v from 'valibot';

export const TALENT_GROUP_TYPES = ['Type1', 'Type2', 'Type3'] as const;
export type TalentGroupType = (typeof TALENT_GROUP_TYPES)[number];

export const talentGroupIdSchema = v.pipe(v.string(), v.uuid('Invalid Group UUID'));
export const talentIdSchema = v.pipe(v.string(), v.uuid('Invalid Talent UUID'));

export const createTalentGroupSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Group name is required')),
  type: v.pipe(v.string(), v.trim(), v.minLength(1, 'Group type is required')),
});

export const updateTalentGroupSchema = v.object({
  id: v.pipe(v.string(), v.uuid('Invalid Group UUID')),
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1, 'Group name cannot be empty'))),
  type: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1, 'Group type cannot be empty'))),
});

export const deleteTalentGroupSchema = v.object({
  id: v.pipe(v.string(), v.uuid('Invalid Group UUID')),
});

export const addTalentToGroupSchema = v.object({
  groupId: v.pipe(v.string(), v.uuid('Invalid Group UUID')),
  talentId: v.pipe(v.string(), v.uuid('Invalid Talent UUID')),
});

export const removeTalentFromGroupSchema = v.object({
  groupId: v.pipe(v.string(), v.uuid('Invalid Group UUID')),
  talentId: v.pipe(v.string(), v.uuid('Invalid Talent UUID')),
});

export const talentGroupPaginationSchema = v.optional(
  v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 500),
    search: v.optional(v.string()),
    type: v.optional(v.string()),
  }),
  {}
);

export interface TalentGroupOverview {
  id: string;
  name: string;
  type: string;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TalentGroupMemberOverview {
  talentId: string;
  displayName: string;
  jobTitle: string | null;
  email: string | null;
  status: string;
  joinedAt: string;
  availableAzvs?: TalentAzvItem[];
  openAzvs?: TalentAzvItem[];
  openAzvCount?: number;
}

export interface TalentGroupDetail extends TalentGroupOverview {
  members: TalentGroupMemberOverview[];
}

export const getGroupWeeklyTimesheetSchema = v.object({
  groupId: v.pipe(v.string(), v.uuid('Invalid Group UUID')),
  weekStartDate: v.string(), // "YYYY-MM-DD"
});

export const updateTimeOffStatusSchema = v.object({
  requestId: v.pipe(v.string(), v.uuid('Invalid Request UUID')),
  status: v.union([v.literal('pending'), v.literal('approved'), v.literal('rejected')]),
  groupId: v.optional(v.string()),
  talentId: v.optional(v.string()),
});

export const deleteTimesheetEntrySchema = v.object({
  entryId: v.pipe(v.string(), v.uuid('Invalid Entry UUID')),
  groupId: v.optional(v.string()),
  talentId: v.optional(v.string()),
});

export const createManualTimesheetEntrySchema = v.object({
  talentId: v.pipe(v.string(), v.uuid('Invalid Talent UUID')),
  startTime: v.string(),
  endTime: v.string(),
  groupId: v.optional(v.string()),
});

export const getTalentMonthlyTimetableSchema = v.object({
  talentId: v.pipe(v.string(), v.uuid('Invalid Talent UUID')),
  year: v.number(),
  month: v.number(),
});

export const TIME_OFF_TYPES = [
  "AZV",
  "Urlaub",
  "Krank",
  "Kind krank",
  "Tel. Krankmeldung",
  "Wichtiger Grund",
  "Unentschuldigt",
] as const;

export type TimeOffType = (typeof TIME_OFF_TYPES)[number];

export const saveTalentDayTimetableSchema = v.object({
  talentId: v.pipe(v.string(), v.uuid('Invalid Talent UUID')),
  date: v.string(), // "YYYY-MM-DD"
  entries: v.array(
    v.object({
      id: v.optional(v.string()),
      startTime: v.string(), // "HH:mm" or ISO
      endTime: v.string(), // "HH:mm" or ISO
    })
  ),
  excuse: v.optional(
    v.object({
      id: v.optional(v.string()),
      type: v.string(),
      note: v.optional(v.string()),
      reason: v.optional(v.string()),
      status: v.optional(v.string()),
      delete: v.optional(v.boolean()),
    })
  ),
  groupId: v.optional(v.string()),
});

export const setDayExcuseSchema = v.object({
  talentId: v.pipe(v.string(), v.uuid('Invalid Talent UUID')),
  date: v.string(), // "YYYY-MM-DD"
  type: v.optional(v.string()),
  note: v.optional(v.string()),
  reason: v.optional(v.string()),
  status: v.optional(v.string()),
  delete: v.optional(v.boolean()),
  groupId: v.optional(v.string()),
});

export interface GroupWeeklyTimesheetTimeEntry {
  id: string;
  startTime: string;
  endTime: string | null;
  durationHours: number;
  status: string;
  type: string;
}

export interface TalentAzvItem {
  id: string;
  talentId: string;
  from: string; // "YYYY-MM-DD"
  formattedFrom: string; // "DD.MM.YYYY"
  usedOn: string | null; // "YYYY-MM-DD" | null
  formattedUsedOn?: string | null;
  createdAt: string;
}

export const createTalentAzvSchema = v.object({
  talentId: v.pipe(v.string(), v.uuid('Invalid Talent UUID')),
  from: v.pipe(v.string(), v.minLength(1, 'Origin date is required')),
  usedOn: v.optional(v.nullable(v.string())),
  groupId: v.optional(v.string()),
});

export const linkAzvToExcuseSchema = v.object({
  azvId: v.pipe(v.string(), v.uuid('Invalid AZV UUID')),
  usedOn: v.pipe(v.string(), v.minLength(1, 'Target excuse date is required')),
  talentId: v.pipe(v.string(), v.uuid('Invalid Talent UUID')),
  groupId: v.optional(v.string()),
});

export const awardWeekSurplusAzvSchema = v.object({
  talentId: v.pipe(v.string(), v.uuid('Invalid Talent UUID')),
  fromDate: v.pipe(v.string(), v.minLength(1, 'Surplus week date is required')),
  groupId: v.optional(v.string()),
});

export const deleteTalentAzvSchema = v.object({
  azvId: v.pipe(v.string(), v.uuid('Invalid AZV UUID')),
  talentId: v.pipe(v.string(), v.uuid('Invalid Talent UUID')),
  groupId: v.optional(v.string()),
});

export interface GroupWeeklyDayEntry {
  date: string; // "YYYY-MM-DD"
  dayName: string; // "Monday"
  formattedDate: string; // "24.08"
  workedHours: number; // rounded 0.5h step
  rawWorkedHours: number;
  timesheetEntries: GroupWeeklyTimesheetTimeEntry[];
  excuse: {
    id: string;
    type: string;
    status: string;
    note: string | null;
    reason?: string | null;
    startDate: string;
    endDate: string;
    azvId?: string | null;
    azvFrom?: string | null; // "YYYY-MM-DD"
    azvFormattedFrom?: string | null; // "DD.MM.YYYY"
  } | null;
  hasConflict: boolean;
  isExcusedDay: boolean;
  hasContract: boolean;
  plannedInterval: {
    startTime: string;
    endTime: string;
    durationHours: number;
  } | null;
  isCurrentOrFutureWeek: boolean;
}

export interface TimetableConflictItem {
  id?: string;
  talentId: string;
  talentName: string;
  type: 'worked_on_excuse' | 'week_deficit' | 'week_surplus' | 'azv_missing_origin' | 'other';
  day: string; // "YYYY-MM-DD" (Monday date if week-conflict)
  formattedDate: string; // "02.09.2026" or "KW 36 (31.08.2026)"
  isWeekConflict: boolean;
  title: string;
  description: string;
  timesheetEntryId?: string;
  excuseId?: string;
  azvId?: string;
  workedHours?: number;
  expectedHours?: number;
  deficitHours?: number;
}

export interface GroupWeeklyTalentRow {
  talentId: string;
  index: number;
  givenName: string;
  familyName: string;
  displayName: string;
  contractStart: string | null;
  contractEnd: string | null;
  jcNumber: string | null;
  dailyExpectedHours: number;
  totalWeeklyExpectedHours: number;
  adjustedWeeklyExpectedHours: number;
  totalWeeklyExcusedHours: number;
  days: GroupWeeklyDayEntry[];
  totalWeeklyWorkedHours: number;
  isUnderTarget: boolean;
  isOverTarget: boolean;
  isExcusedMet: boolean;
  statusMessage: string;
  availableAzvs?: TalentAzvItem[];
  openAzvs?: TalentAzvItem[];
  openAzvCount?: number;
}

export interface GroupWeeklyTimesheetData {
  groupId: string;
  groupName: string;
  groupType: string;
  weekNumber: number;
  year: number;
  weekStartDate: string;
  weekEndDate: string;
  hasAnyJcNumber: boolean;
  totalGroupDailyHours: number;
  talents: GroupWeeklyTalentRow[];
  conflicts: TimetableConflictItem[];
  totalHistoricalConflicts?: TimetableConflictItem[];
}

export interface TalentMonthlyTimetableTimeInterval {
  id?: string;
  startTime: string;
  endTime: string;
  durationHours: number;
}

export interface TalentMonthlyTimetableDay {
  date: string; // "YYYY-MM-DD"
  dayOfWeek: string; // "Monday", "Tuesday"...
  formattedDate: string; // "24.08.2026"
  isWeekend: boolean;
  expectedHours: number;
  adjustedExpectedHours: number;
  intervals: TalentMonthlyTimetableTimeInterval[];
  excuse: {
    id: string;
    type: string;
    status: string;
    note: string | null;
    reason?: string | null;
    azvId?: string | null;
    azvFrom?: string | null;
    azvFormattedFrom?: string | null;
  } | null;
  workedHours: number; // rounded to 0.5h
  rawWorkedHours: number;
  hasConflict: boolean;
  hasContract: boolean;
  plannedInterval: {
    startTime: string;
    endTime: string;
    durationHours: number;
  } | null;
  isCurrentOrFutureWeek: boolean;
  isOutsideMonth?: boolean;
}

export interface TalentMonthlyTimetableWeek {
  weekNumber: number;
  days: TalentMonthlyTimetableDay[];
  totalExpectedHours: number;
  adjustedExpectedHours: number;
  totalWorkedHours: number;
  isTargetMet: boolean;
  isUnderTarget: boolean;
  isOverTarget: boolean;
  differenceHours: number;
  statusMessage: string;
  isPassedWeek?: boolean;
}

export interface TalentMonthlyTimetableData {
  talentId: string;
  displayName: string;
  givenName: string;
  familyName: string;
  jobTitle: string | null;
  year: number;
  month: number;
  monthName: string;
  weeks: TalentMonthlyTimetableWeek[];
  monthlyExpectedHours: number;
  monthlyAdjustedExpectedHours: number;
  monthlyWorkedHours: number;
  conflicts: TimetableConflictItem[];
  groups?: { id: string; name: string; type: string }[];
  availableAzvs?: TalentAzvItem[];
  openAzvs?: TalentAzvItem[];
  openAzvCount?: number;
}

export type CreateTalentGroupInput = v.InferInput<typeof createTalentGroupSchema>;
export type UpdateTalentGroupInput = v.InferInput<typeof updateTalentGroupSchema>;
export type DeleteTalentGroupInput = v.InferInput<typeof deleteTalentGroupSchema>;
export type AddTalentToGroupInput = v.InferInput<typeof addTalentToGroupSchema>;
export type RemoveTalentFromGroupInput = v.InferInput<typeof removeTalentFromGroupSchema>;
export type GetGroupWeeklyTimesheetInput = v.InferInput<typeof getGroupWeeklyTimesheetSchema>;
export type GetTalentMonthlyTimetableInput = v.InferInput<typeof getTalentMonthlyTimetableSchema>;
export type SaveTalentDayTimetableInput = v.InferInput<typeof saveTalentDayTimetableSchema>;