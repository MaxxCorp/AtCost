import * as v from 'valibot';
import { FilterableIdSchema } from './pagination.js';
import type { SocialInsuranceConditionInput } from './conditions.js';

// --- ENUMS & PICKLISTS ---

export const payrollJurisdictionPicklist = v.picklist(['DE', 'AT', 'CH', 'OTHER']);
export type PayrollJurisdiction = v.InferOutput<typeof payrollJurisdictionPicklist>;

export const payrollStatusPicklist = v.picklist(['draft', 'calculated', 'approved', 'finalized', 'cancelled']);
export type PayrollStatus = v.InferOutput<typeof payrollStatusPicklist>;

export const taxClassPicklist = v.picklist(['1', '2', '3', '4', '5', '6']);
export type TaxClass = v.InferOutput<typeof taxClassPicklist>;

export const churchTaxPicklist = v.picklist(['none', 'ev', 'rk']);
export type ChurchTaxType = v.InferOutput<typeof churchTaxPicklist>;

export const employmentTypePicklist = v.picklist(['regular', 'minijob', 'midijob', 'student', 'freelance', 'sgb2_16d', 'sgb2_16i']);
export type EmploymentType = v.InferOutput<typeof employmentTypePicklist>;

export const fundingProgramPicklist = v.picklist(['none', 'sgb2_16d', 'sgb2_16i']);
export type FundingProgram = v.InferOutput<typeof fundingProgramPicklist>;

export const healthInsuranceTypePicklist = v.picklist(['statutory', 'private']);
export type HealthInsuranceType = v.InferOutput<typeof healthInsuranceTypePicklist>;

// --- SGB II PRESETS ---
export const PAYROLL_PROFILE_SGB2_16I_PRESET = {
    employmentType: 'sgb2_16i' as const,
    fundingProgram: 'sgb2_16i' as const,
    fundingSubsidyPercentage: 100, // 100% in Year 1 & 2
    fundingYear: 1,
    jobcenterName: 'Jobcenter Berlin',
    jobcenterReference: '§ 16i SGB II - TaAM',
    furtherTrainingBudget: 3000.0,
    furtherTrainingUsed: 0.0,
    coachingHoursPerMonth: 2.0,
    unemploymentInsuranceExempt: true, // ALV-frei gem. § 27 Abs. 3 Nr. 5 SGB III
    pensionInsuranceExempt: false,
    deuevPersonengruppe: '101',
    deuevBeitragsgruppe: '1101',
    healthInsuranceType: 'statutory' as const,
    taxClass: '1' as const,
};

export const PAYROLL_PROFILE_SGB2_16D_PRESET = {
    employmentType: 'sgb2_16d' as const,
    fundingProgram: 'sgb2_16d' as const,
    fundingSubsidyPercentage: 100,
    fundingYear: 1,
    jobcenterName: 'Jobcenter Berlin',
    jobcenterReference: '§ 16d SGB II - AGH',
    furtherTrainingBudget: 0.0,
    furtherTrainingUsed: 0.0,
    coachingHoursPerMonth: 0.0,
    unemploymentInsuranceExempt: true,
    pensionInsuranceExempt: true,
    deuevPersonengruppe: '190',
    deuevBeitragsgruppe: '0000',
    healthInsuranceType: 'statutory' as const,
    taxClass: '1' as const,
};

// --- VALIDATION SCHEMAS ---

export const payrollTargetGroupPicklist = v.picklist(['all', 'tagged', 'salaried', 'hourly']);
export type PayrollTargetGroup = v.InferOutput<typeof payrollTargetGroupPicklist>;

export const payrollCycleTypePicklist = v.picklist(['monthly', 'weekly', 'biweekly', 'custom']);
export type PayrollCycleType = v.InferOutput<typeof payrollCycleTypePicklist>;

export const payrollRunPaginationSchema = v.optional(
    v.object({
        page: v.optional(v.number(), 1),
        limit: v.optional(v.number(), 50),
        search: v.optional(v.string(), ''),
        status: v.optional(v.string()),
        period: v.optional(v.string()),
        jurisdiction: v.optional(v.string()),
        targetGroup: v.optional(v.string()),
        tagId: v.optional(v.string()),
    }),
    {}
);

export const createPayrollRunSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    period: v.pipe(v.string(), v.minLength(1, 'Period is required')),
    jurisdiction: v.optional(payrollJurisdictionPicklist, 'DE'),
    targetGroup: v.optional(payrollTargetGroupPicklist, 'all'),
    tagIds: v.optional(v.array(v.string()), []),
    cycleType: v.optional(payrollCycleTypePicklist, 'monthly'),
    paymentDueDate: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    notes: v.optional(v.string()),
});

export type CreatePayrollRunInput = v.InferOutput<typeof createPayrollRunSchema>;

export const updatePayrollRunSchema = v.object({
    id: v.pipe(v.string(), v.minLength(1, 'Payroll run ID is required')),
    name: v.optional(v.string()),
    status: v.optional(payrollStatusPicklist),
    targetGroup: v.optional(payrollTargetGroupPicklist),
    tagIds: v.optional(v.array(v.string())),
    cycleType: v.optional(payrollCycleTypePicklist),
    paymentDueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
});

export const payrollProfileSchema = v.object({
    id: v.optional(v.string()),
    talentId: v.pipe(v.string(), v.minLength(1, 'Talent ID is required')),
    taxId: v.optional(v.string()),
    taxClass: v.optional(taxClassPicklist, '1'),
    childCount: v.optional(v.number(), 0),
    churchTax: v.optional(churchTaxPicklist, 'none'),
    state: v.optional(v.string(), 'BE'), // German state: BE, BY, NW, etc.
    socialSecurityNumber: v.optional(v.string()),
    hmoId: v.optional(v.string()),
    accidentHmoId: v.optional(v.string()),
    accidentAdditionalApplicable: v.optional(v.boolean(), true),
    pensionHmoId: v.optional(v.string()),
    u1CompensationPercent: v.optional(v.number(), 70.0),
    u1Exempt: v.optional(v.boolean(), false),
    u3Exempt: v.optional(v.boolean(), false),
    healthInsuranceName: v.optional(v.string(), 'Techniker Krankenkasse (TK)'),
    healthInsuranceType: v.optional(healthInsuranceTypePicklist, 'statutory'),
    healthInsuranceAdditionalContributionPercent: v.optional(v.number(), 2.5),
    pensionInsuranceExempt: v.optional(v.boolean(), false),
    unemploymentInsuranceExempt: v.optional(v.boolean(), false),
    hasChildren: v.optional(v.boolean(), false),
    employmentType: v.optional(employmentTypePicklist, 'regular'),
    fundingProgram: v.optional(fundingProgramPicklist, 'none'),
    fundingSubsidyPercentage: v.optional(v.number(), 100),
    fundingYear: v.optional(v.number(), 1),
    jobcenterName: v.optional(v.string()),
    jobcenterReference: v.optional(v.string()),
    furtherTrainingBudget: v.optional(v.number(), 3000),
    furtherTrainingUsed: v.optional(v.number(), 0),
    coachingHoursPerMonth: v.optional(v.number(), 2),
    deuevPersonengruppe: v.optional(v.string(), '101'),
    deuevBeitragsgruppe: v.optional(v.string(), '1111'),
    iban: v.optional(v.string()),
    bic: v.optional(v.string()),
    bankName: v.optional(v.string()),
});

export type PayrollProfileInput = v.InferOutput<typeof payrollProfileSchema>;

export const payslipPaginationSchema = v.optional(
    v.object({
        page: v.optional(v.number(), 1),
        limit: v.optional(v.number(), 50),
        search: v.optional(v.string(), ''),
        payrollRunId: FilterableIdSchema,
        talentId: FilterableIdSchema,
        status: v.optional(v.string()),
    }),
    {}
);

// --- CALCULATION TYPES ---

export interface PayrollLineItem {
    code: string;
    name: string;
    category: 'earning' | 'deduction' | 'employer_contribution';
    hours?: number;
    rate?: number;
    amount: number;
    taxExempt: boolean;
    socialSecurityExempt: boolean;
    legalReference?: string;
}

export interface PayrollCalculationInput {
    talentId: string;
    talentName: string;
    period: string; // "YYYY-MM"
    startDate: Date;
    endDate: Date;
    contract: any | null; // effective resolved contract
    payrollProfile: any | null;
    socialInsuranceConditions?: SocialInsuranceConditionInput | null;
    timesheetEntries: Array<{
        startTime: Date | string;
        endTime?: Date | string | null;
        status: string;
    }>;
    timeOffRequests: Array<{
        type: string;
        status: string;
        startDate: Date | string;
        endDate: Date | string;
    }>;
}


export interface PayrollCalculationResult {
    jurisdiction: string;
    contractHours: number;
    workedHours: number;
    overtimeHours: number;
    nightHours: number;
    sundayHours: number;
    holidayHours: number;
    paidLeaveHours: number;

    // Gross components
    baseSalary: number;
    hourlyWage: number;
    overtimePay: number;
    overtimeSurcharges: number;
    nightSurchargesTaxFree: number;
    sundaySurchargesTaxFree: number;
    holidaySurchargesTaxFree: number;
    allowances: number;
    employerVl: number;
    bonus: number;
    otherAdditions: number;
    grossSalary: number;
    taxableGross: number;
    socialSecurityGross: number;
    pensionGross: number;

    // Taxes
    wageTax: number;
    solidaritySurcharge: number;
    churchTax: number;
    totalTax: number;

    // Employee SV
    employeeHealthInsurance: number;
    employeePensionInsurance: number;
    employeeUnemploymentInsurance: number;
    employeeLongTermCareInsurance: number;
    totalEmployeeSocialSecurity: number;

    // Net & payout
    netSalary: number;
    netDeductions: number;
    payoutAmount: number;

    // Employer SV & cost
    employerHealthInsurance: number;
    employerPensionInsurance: number;
    employerUnemploymentInsurance: number;
    employerLongTermCareInsurance: number;
    employerLevies: number;
    employerAccidentInsurance: number;
    employerPensionFund: number;
    employeePensionFund: number;
    u1Levy: number;
    u2Levy: number;
    u3Levy: number;
    totalEmployerSocialSecurity: number;
    totalEmployerCost: number;

    // SGB II Funding & Subsidies (§ 16d / § 16i)
    fundingProgram: 'none' | 'sgb2_16d' | 'sgb2_16i';
    jobcenterSubsidy: number;
    netEmployerCost: number;
    furtherTrainingBudget: number;
    furtherTrainingUsed: number;
    furtherTrainingRemaining: number;
    coachingHoursPerMonth: number;
    deuevPersonengruppe: string;
    deuevBeitragsgruppe: string;

    lineItems: PayrollLineItem[];
    calculationDetails: Record<string, any>;
}

export interface PayrollJurisdictionEngine {
    jurisdiction: string;
    calculate(input: PayrollCalculationInput): PayrollCalculationResult;
}

// --- GERMAN PUBLIC HOLIDAY HELPERS ---

/**
 * Calculates Gregorian Easter Sunday for a given year using Meeus/Jones/Butcher algorithm.
 */
export function getEasterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed month
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month, day));
}

function addDays(d: Date, days: number): Date {
    const res = new Date(d);
    res.setUTCDate(res.getUTCDate() + days);
    return res;
}

function formatDateKey(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Returns a map of German public holidays for a given year and state.
 */
export function getGermanPublicHolidays(year: number, state: string = 'BE'): Map<string, string> {
    const holidays = new Map<string, string>();
    const easter = getEasterSunday(year);

    // Fixed national holidays
    holidays.set(`${year}-01-01`, 'Neujahr');
    holidays.set(`${year}-05-01`, 'Tag der Arbeit');
    holidays.set(`${year}-10-03`, 'Tag der Deutschen Einheit');
    holidays.set(`${year}-12-25`, '1. Weihnachtstag');
    holidays.set(`${year}-12-26`, '2. Weihnachtstag');

    // Moveable national holidays (relative to Easter)
    holidays.set(formatDateKey(addDays(easter, -2)), 'Karfreitag');
    holidays.set(formatDateKey(addDays(easter, 1)), 'Ostermontag');
    holidays.set(formatDateKey(addDays(easter, 39)), 'Christi Himmelfahrt');
    holidays.set(formatDateKey(addDays(easter, 50)), 'Pfingstmontag');

    // State specific holidays
    if (state === 'BE' || state === 'MV') {
        holidays.set(`${year}-03-08`, 'Internationaler Frauentag');
    }
    if (['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].includes(state)) {
        holidays.set(formatDateKey(addDays(easter, 60)), 'Fronleichnam');
    }
    if (['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'].includes(state)) {
        holidays.set(`${year}-10-31`, 'Reformationstag');
    }
    if (['BW', 'BY', 'NW', 'RP', 'SL'].includes(state)) {
        holidays.set(`${year}-11-01`, 'Allerheiligen');
    }

    return holidays;
}

// --- TIMESHEET HOUR BREAKDOWN (Night, Sunday, Holiday) ---

export interface WorkTimeBreakdown {
    totalHours: number;
    nightHours: number;
    sundayHours: number;
    holidayHours: number;
    saturdayHours: number;
}

/**
 * Breaks down worked time into standard, night (20:00 - 06:00), Sunday, and public holiday hours.
 */
export function calculateWorkTimeBreakdown(
    entries: Array<{ startTime: Date | string; endTime?: Date | string | null }>,
    state: string = 'BE'
): WorkTimeBreakdown {
    let totalMinutes = 0;
    let nightMinutes = 0;
    let sundayMinutes = 0;
    let holidayMinutes = 0;
    let saturdayMinutes = 0;

    const holidaysCache = new Map<number, Map<string, string>>();

    for (const entry of entries) {
        if (!entry.startTime || !entry.endTime) continue;
        const start = new Date(entry.startTime);
        const end = new Date(entry.endTime);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) continue;

        // Iterate through time in 15-minute segments
        const stepMs = 15 * 60 * 1000;
        let cur = start.getTime();
        const endMs = end.getTime();

        while (cur < endMs) {
            const next = Math.min(cur + stepMs, endMs);
            const durationMin = (next - cur) / (60 * 1000);
            const dateObj = new Date(cur);

            const year = dateObj.getFullYear();
            if (!holidaysCache.has(year)) {
                holidaysCache.set(year, getGermanPublicHolidays(year, state));
            }
            const holidays = holidaysCache.get(year)!;

            const dateKey = `${year}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            const hour = dateObj.getHours();
            const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday

            totalMinutes += durationMin;

            // Night work: 20:00 to 06:00
            if (hour >= 20 || hour < 6) {
                nightMinutes += durationMin;
            }

            // Sunday work
            if (dayOfWeek === 0) {
                sundayMinutes += durationMin;
            }

            // Saturday work
            if (dayOfWeek === 6) {
                saturdayMinutes += durationMin;
            }

            // Public holiday
            if (holidays.has(dateKey)) {
                holidayMinutes += durationMin;
            }

            cur = next;
        }
    }

    return {
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        nightHours: Math.round((nightMinutes / 60) * 100) / 100,
        sundayHours: Math.round((sundayMinutes / 60) * 100) / 100,
        holidayHours: Math.round((holidayMinutes / 60) * 100) / 100,
        saturdayHours: Math.round((saturdayMinutes / 60) * 100) / 100,
    };
}

// --- GERMAN PAYROLL ENGINE IMPLEMENTATION ---

export class GermanPayrollEngine implements PayrollJurisdictionEngine {
    jurisdiction = 'DE';

    // 2026 German Statutory Constants
    static readonly BBG_KV_PV_MONTHLY = 5812.50; // Beitragsbemessungsgrenze KV/PV 2026
    static readonly BBG_RV_AV_MONTHLY = 8450.00; // Beitragsbemessungsgrenze RV/AV 2026
    static readonly MINIJOB_LIMIT = 538.00;      // Geringfügigkeitsgrenze

    // Social Security Contribution Rates (Employee & Employer)
    static readonly RV_RATE_TOTAL = 0.186;  // 18.6% Rentenversicherung
    static readonly RV_RATE_HALF = 0.093;   // 9.3% each
    static readonly AV_RATE_TOTAL = 0.026;  // 2.6% Arbeitslosenversicherung
    static readonly AV_RATE_HALF = 0.013;   // 1.3% each
    static readonly KV_BASE_RATE_HALF = 0.073; // 7.3% base KV each

    // Employer Levies (Umlagen)
    static readonly U1_RATE = 0.015;        // 1.5% Lohnfortzahlung
    static readonly U2_RATE = 0.0045;       // 0.45% Mutterschutz
    static readonly INSOLVENZ_RATE = 0.0006;// 0.06% Insolvenzgeldumlage

    calculate(input: PayrollCalculationInput): PayrollCalculationResult {
        const {
            contract,
            payrollProfile,
            timesheetEntries,
            timeOffRequests,
            period,
        } = input;

        const state = payrollProfile?.state || 'BE';
        const breakdown = calculateWorkTimeBreakdown(timesheetEntries, state);

        const wageType = contract?.wageType || 'monthly';
        const effectiveWageAmount = Number(contract?.effectiveWageAmount ?? contract?.wageAmount ?? 0);
        const workHoursPerMonth = Number(contract?.workHoursPerMonth ?? 169.65);
        const workHoursPerWeek = Number(contract?.workHoursPerWeek ?? 39);
        const workHoursPerDay = Number(contract?.workHoursPerDay ?? (workHoursPerWeek / (contract?.workDaysPerWeek ?? 5)));

        // Basic hourly wage calculation
        const hourlyWage = wageType === 'hourly'
            ? effectiveWageAmount
            : workHoursPerMonth > 0
                ? Math.round((effectiveWageAmount / workHoursPerMonth) * 100) / 100
                : 0;

        // Paid Leave (Vacation & Paid Sick Leave under § 3 EntgFG)
        let paidLeaveDays = 0;
        for (const req of timeOffRequests) {
            if (req.status === 'approved' && (req.type === 'vacation' || req.type === 'sick')) {
                const s = new Date(req.startDate);
                const e = new Date(req.endDate);
                const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (24 * 3600 * 1000)) + 1);
                paidLeaveDays += diffDays;
            }
        }
        const paidLeaveHours = Math.round(paidLeaveDays * workHoursPerDay * 100) / 100;

        // Contract regular hours
        const contractHours = wageType === 'monthly' ? workHoursPerMonth : Math.round(workHoursPerWeek * 4.33 * 100) / 100;
        const workedHours = breakdown.totalHours;

        // Overtime calculation
        const totalCreditedHours = workedHours + paidLeaveHours;
        const overtimeHours = Math.max(0, Math.round((totalCreditedHours - contractHours) * 100) / 100);

        // Base salary
        let baseSalary = 0;
        if (wageType === 'monthly') {
            baseSalary = effectiveWageAmount;
        } else {
            baseSalary = Math.round((workedHours + paidLeaveHours) * hourlyWage * 100) / 100;
        }

        // Surcharges (SFN nach § 3b EStG & Overtime)
        const overtimePercent = Number(contract?.overtimeSurchargePercent ?? 30);
        const nightPercent = Number(contract?.nightSurchargePercent ?? 20);
        const sundayPercent = Number(contract?.sundaySurchargePercent ?? 25);
        const holidayPercent = Number(contract?.holidaySurchargePercent ?? 35);

        const overtimePay = wageType === 'monthly' ? Math.round(overtimeHours * hourlyWage * 100) / 100 : 0;
        const overtimeSurcharges = Math.round(overtimeHours * hourlyWage * (overtimePercent / 100) * 100) / 100;

        // § 3b EStG: SFN-Zuschläge are tax-free up to statutory ceilings (as long as base hourly wage <= 50 €/h)
        // Night: up to 25% (or 40% between 00:00-06:00) is tax-free
        const nightSurchargesTaxFree = Math.round(breakdown.nightHours * hourlyWage * (nightPercent / 100) * 100) / 100;
        // Sunday: up to 50% is tax-free
        const sundaySurchargesTaxFree = Math.round(breakdown.sundayHours * hourlyWage * (sundayPercent / 100) * 100) / 100;
        // Holiday: up to 125% is tax-free
        const holidaySurchargesTaxFree = Math.round(breakdown.holidayHours * hourlyWage * (holidayPercent / 100) * 100) / 100;

        // Allowances: Capital Allowance (Hauptstadtzulage)
        const allowances = Number(contract?.capitalAllowance ?? 0);

        // Capital-forming benefits (VL - Vermögenswirksame Leistungen)
        const employerVl = Number(contract?.capitalFormingBenefits ?? 0);

        // Yearly bonus (Jahressonderzahlung / Weihnachtsgeld)
        let bonus = 0;
        const [yearStr, monthStr] = period.split('-');
        const periodMonth = parseInt(monthStr, 10);
        const bonusMonth = Number(contract?.yearlyBonusMonth ?? 11);
        if (periodMonth === bonusMonth && contract?.yearlyBonusPercentage) {
            bonus = Math.round(effectiveWageAmount * (Number(contract.yearlyBonusPercentage) / 100) * 100) / 100;
        }

        // Total Gross (Gesamtbrutto)
        const grossSalary = Math.round((
            baseSalary +
            overtimePay +
            overtimeSurcharges +
            nightSurchargesTaxFree +
            sundaySurchargesTaxFree +
            holidaySurchargesTaxFree +
            allowances +
            employerVl +
            bonus
        ) * 100) / 100;

        // Taxable Gross (Steuer-Brutto: Gesamtbrutto minus § 3b EStG tax-free surcharges)
        const totalTaxFreeSFN = nightSurchargesTaxFree + sundaySurchargesTaxFree + holidaySurchargesTaxFree;
        const taxableGross = Math.max(0, Math.round((grossSalary - totalTaxFreeSFN) * 100) / 100);

        // Social Security Gross (SV-Brutto: SFN is SV-free if base hourly wage <= 25 €/h)
        const isSfnSvFree = hourlyWage <= 25.0;
        const rawSvGross = isSfnSvFree ? taxableGross : grossSalary;

        const employmentType = payrollProfile?.employmentType || 'regular';
        const fundingProgram: 'none' | 'sgb2_16d' | 'sgb2_16i' = (
            payrollProfile?.fundingProgram === 'sgb2_16d' ||
            payrollProfile?.employmentType === 'sgb2_16d' ||
            contract?.fundingProgram === 'sgb2_16d'
        ) ? 'sgb2_16d' : (
            payrollProfile?.fundingProgram === 'sgb2_16i' ||
            payrollProfile?.employmentType === 'sgb2_16i' ||
            contract?.fundingProgram === 'sgb2_16i'
        ) ? 'sgb2_16i' : 'none';

        // Social Insurance conditions (dynamic from approved version or statutory fallback)
        const cond = input.socialInsuranceConditions;
        const bbgKvPv = Number(cond?.bbgKvPvMonthly ?? GermanPayrollEngine.BBG_KV_PV_MONTHLY);
        const bbgRvAv = Number(cond?.bbgRvAvMonthly ?? GermanPayrollEngine.BBG_RV_AV_MONTHLY);
        const minijobLimit = Number(cond?.minijobLimit ?? GermanPayrollEngine.MINIJOB_LIMIT);
        const rvRateHalf = Number(cond?.rvRateHalf ?? GermanPayrollEngine.RV_RATE_HALF);
        const avRateHalf = Number(cond?.avRateHalf ?? GermanPayrollEngine.AV_RATE_HALF);
        const kvBaseRateHalf = Number(cond?.kvBaseRateHalf ?? GermanPayrollEngine.KV_BASE_RATE_HALF);
        const u1Rate = Number(cond?.u1Rate ?? GermanPayrollEngine.U1_RATE);
        const u2Rate = Number(cond?.u2Rate ?? GermanPayrollEngine.U2_RATE);
        const insolvenzRate = Number(cond?.insolvenzRate ?? GermanPayrollEngine.INSOLVENZ_RATE);

        const isMinijob = fundingProgram === 'none' && (employmentType === 'minijob' || (grossSalary <= minijobLimit && employmentType !== 'regular'));

        let wageTax = 0;
        let solidaritySurcharge = 0;
        let churchTax = 0;
        let employeeHealthInsurance = 0;
        let employeePensionInsurance = 0;
        let employeeUnemploymentInsurance = 0;
        let employeeLongTermCareInsurance = 0;

        let employerHealthInsurance = 0;
        let employerPensionInsurance = 0;
        let employerUnemploymentInsurance = 0;
        let employerLongTermCareInsurance = 0;
        let employerLevies = 0;
        let employerAccidentInsurance = 0;
        let accidentInsuranceBase = 0;
        let accidentInsuranceAdditional = 0;
        let employerPensionFund = 0;
        let employeePensionFund = 0;
        let u1Levy = 0;
        let u2Levy = 0;
        let u3Levy = 0;
        let effectiveU1Rate = 0.021;
        let effectiveU2Rate = 0.0044;
        let effectiveU3Rate = 0.0015;
        let u1Tier = 70.0;

        let socialSecurityGross = 0;
        let pensionGross = 0;

        // Resolve HMO contribution rate and insurance type upfront from loaded HMO record or profile
        let addContribPercent = 2.5;
        let insuranceType = payrollProfile?.healthInsuranceType ?? 'statutory';

        if (payrollProfile?.hmo) {
            addContribPercent = Number(payrollProfile.hmo.additionalContributionPercent ?? 2.5);
            if (payrollProfile.hmo.type) {
                insuranceType = payrollProfile.hmo.type;
            }
        } else if (payrollProfile?.healthInsuranceAdditionalContributionPercent !== undefined && payrollProfile?.healthInsuranceAdditionalContributionPercent !== null) {
            addContribPercent = Number(payrollProfile.healthInsuranceAdditionalContributionPercent);
        } else if (cond?.hmoRates && payrollProfile?.healthInsuranceName) {
            const targetName = payrollProfile.healthInsuranceName.toLowerCase().trim();
            const matchedHmo = cond.hmoRates.find((h) => {
                const hName = h.name.toLowerCase().trim();
                return hName === targetName || targetName.includes(hName) || hName.includes(targetName);
            });
            if (matchedHmo && typeof matchedHmo.additionalContributionPercent === 'number') {
                addContribPercent = matchedHmo.additionalContributionPercent;
            }
        }

        if (fundingProgram === 'sgb2_16d') {
            // SGB II § 16d Arbeitsgelegenheit (AGH): Mehraufwandsentschädigung (MAE)
            // Steuerfrei nach § 3 Nr. 2 EStG und sozialversicherungsfrei (kein Arbeitsverhältnis gem. § 16d Abs. 7 SGB II)
            socialSecurityGross = 0;
            pensionGross = 0;
            wageTax = 0;
            solidaritySurcharge = 0;
            churchTax = 0;
            employeeHealthInsurance = 0;
            employeePensionInsurance = 0;
            employeeUnemploymentInsurance = 0;
            employeeLongTermCareInsurance = 0;
            employerHealthInsurance = 0;
            employerPensionInsurance = 0;
            employerUnemploymentInsurance = 0;
            employerLongTermCareInsurance = 0;
            employerLevies = 0;
        } else if (isMinijob) {
            socialSecurityGross = Math.min(rawSvGross, bbgKvPv);
            pensionGross = Math.min(rawSvGross, bbgRvAv);
            // Minijob rules (§ 8 SGB IV):
            // Employee pays 0% wage tax (pauschal by employer) and 0% SV (if exempt from RV)
            if (payrollProfile?.pensionInsuranceExempt === false) {
                // RV mandatory unless opted out: employee pays 3.6%
                employeePensionInsurance = Math.round(grossSalary * 0.036 * 100) / 100;
            }
            // Employer pays flat-rate contributions:
            // 15% RV, 13% KV, 2% Pauschalsteuer, U1/U2/Insolvenz
            employerPensionInsurance = Math.round(grossSalary * 0.15 * 100) / 100;
            employerHealthInsurance = Math.round(grossSalary * 0.13 * 100) / 100;
            const employerFlatTax = Math.round(grossSalary * 0.02 * 100) / 100;
            employerLevies = Math.round(grossSalary * (u1Rate + u2Rate + insolvenzRate) * 100) / 100 + employerFlatTax;
        } else {
            socialSecurityGross = Math.min(rawSvGross, bbgKvPv);
            pensionGross = Math.min(rawSvGross, bbgRvAv);

            // Standard employment or SGB II § 16i taxation
            const taxClass = (payrollProfile?.taxClass || '1') as TaxClass;
            const churchTaxType = payrollProfile?.churchTax || 'none';
            const childCount = Number(payrollProfile?.childCount || 0);

            // Calculate German Lohnsteuer (§ 32a EStG approximation for 2026)
            wageTax = this.calculateGermanWageTax(taxableGross, taxClass, childCount);

            // Solidarity Surcharge (Solidaritätszuschlag): 5.5% if annual tax > €18,130 (for single ~€1,510/mo)
            const annualWageTaxEst = wageTax * 12;
            const soliThreshold = taxClass === '3' ? 36260 : 18130;
            if (annualWageTaxEst > soliThreshold) {
                solidaritySurcharge = Math.round(wageTax * 0.055 * 100) / 100;
            }

            // Church tax (Kirchensteuer): 8% in BY/BW, 9% in other states
            if (churchTaxType !== 'none') {
                const kistRate = (state === 'BY' || state === 'BW') ? 0.08 : 0.09;
                churchTax = Math.round(wageTax * kistRate * 100) / 100;
            }

            // Health Insurance (KV): 7.3% base + half of additional contribution (Zusatzbeitrag)
            const kvHalfRate = kvBaseRateHalf + (addContribPercent / 100 / 2);

            if (insuranceType !== 'private') {
                employeeHealthInsurance = Math.round(socialSecurityGross * kvHalfRate * 100) / 100;
                employerHealthInsurance = Math.round(socialSecurityGross * kvHalfRate * 100) / 100;
            }

            // Pension Insurance (RV): 9.3% each (or dynamic rvRateHalf)
            if (!payrollProfile?.pensionInsuranceExempt) {
                employeePensionInsurance = Math.round(pensionGross * rvRateHalf * 100) / 100;
                employerPensionInsurance = Math.round(pensionGross * rvRateHalf * 100) / 100;
            }

            // Unemployment Insurance (AV):
            // CRITICAL: In § 16i SGB II, the employee is EXEMPT from ALV gem. § 27 Abs. 3 Nr. 5 SGB III!
            const isAvExempt = fundingProgram === 'sgb2_16i' || !!payrollProfile?.unemploymentInsuranceExempt;
            if (!isAvExempt) {
                employeeUnemploymentInsurance = Math.round(pensionGross * avRateHalf * 100) / 100;
                employerUnemploymentInsurance = Math.round(pensionGross * avRateHalf * 100) / 100;
            }

            // Long-Term Care Insurance (Pflegeversicherung PV):
            // Base: 4.0% total. Standard states: AN 2.2%, AG 1.8%.
            // Saxony (SN): AN 2.7%, AG 1.3%.
            // Childless surcharge: +0.6% for employees without children over age 23.
            let anPvRate = state === 'SN' ? 0.027 : Number(cond?.pvBaseRateAn ?? 0.022);
            let agPvRate = state === 'SN' ? 0.013 : Number(cond?.pvBaseRateAg ?? 0.018);
            const childlessSurcharge = Number(cond?.pvChildlessSurcharge ?? 0.006);

            const hasChildren = payrollProfile?.hasChildren || childCount > 0;
            if (!hasChildren) {
                anPvRate += childlessSurcharge; // Kinderlosenzuschlag
            } else if (childCount >= 2) {
                // Discount of 0.25% per child from 2nd to 5th child
                const discountedChildren = Math.min(childCount - 1, 4);
                anPvRate = Math.max(0.012, anPvRate - (discountedChildren * 0.0025));
            }

            employeeLongTermCareInsurance = Math.round(socialSecurityGross * anPvRate * 100) / 100;
            employerLongTermCareInsurance = Math.round(socialSecurityGross * agPvRate * 100) / 100;

            // Health Insurer (Einzugsstelle) employer levies: U1, U2, U3
            const healthHmo = payrollProfile?.hmo;
            const isU1Exempt = Boolean(payrollProfile?.u1Exempt);
            u1Tier = Number(payrollProfile?.u1CompensationPercent ?? healthHmo?.u1DefaultCompensationPercent ?? 70.0);

            effectiveU1Rate = Number(cond?.u1Rate ?? 0.021); // Default 2.10%
            if (healthHmo?.u1Rates && Array.isArray(healthHmo.u1Rates) && healthHmo.u1Rates.length > 0) {
                const matchedTier = healthHmo.u1Rates.find((t: any) => Math.abs(Number(t.compensationPercent) - u1Tier) < 1);
                if (matchedTier) {
                    effectiveU1Rate = Number(matchedTier.contributionPercent) / 100;
                } else {
                    effectiveU1Rate = Number(healthHmo.u1Rates[0].contributionPercent) / 100;
                }
            }

            effectiveU2Rate = healthHmo?.u2Rate ? (Number(healthHmo.u2Rate) / 100) : Number(cond?.u2Rate ?? 0.0044);
            const isU3Exempt = Boolean(payrollProfile?.u3Exempt);
            effectiveU3Rate = healthHmo?.u3Rate ? (Number(healthHmo.u3Rate) / 100) : Number(cond?.insolvenzRate ?? 0.0015);

            u1Levy = isU1Exempt ? 0 : Math.round(socialSecurityGross * effectiveU1Rate * 100) / 100;
            u2Levy = Math.round(socialSecurityGross * effectiveU2Rate * 100) / 100;
            u3Levy = isU3Exempt ? 0 : Math.round(pensionGross * effectiveU3Rate * 100) / 100;
            employerLevies = Math.round((u1Levy + u2Levy + u3Levy) * 100) / 100;

            // Accident Insurance (Gesetzliche Unfallversicherung - Berufsgenossenschaft / DGUV)
            const accidentHmo = payrollProfile?.accidentHmo;
            if (accidentHmo) {
                const gefahrklasse = Number(accidentHmo.accidentGefahrklasse ?? 1.25);
                const beitragsfuss = Number(accidentHmo.accidentBeitragsfuss ?? 3.50);
                accidentInsuranceBase = Math.round(((socialSecurityGross * gefahrklasse * beitragsfuss) / 1000) * 100) / 100;

                const additionalRate = Number(accidentHmo.accidentAdditionalRate ?? 0);
                const isAdditionalApplicable = payrollProfile?.accidentAdditionalApplicable !== false && additionalRate > 0;
                if (isAdditionalApplicable) {
                    accidentInsuranceAdditional = Math.round(((socialSecurityGross * additionalRate) / 1000) * 100) / 100;
                }

                employerAccidentInsurance = Math.round((accidentInsuranceBase + accidentInsuranceAdditional) * 100) / 100;
            }

            // Supplementary Pension Fund (Zusatzversorgungskasse - ZVK / VBL / bAV)
            const pensionHmo = payrollProfile?.pensionHmo;
            if (pensionHmo) {
                const agPensionRate = Number(pensionHmo.pensionEmployerPercent ?? 4.0) / 100;
                const anPensionRate = Number(pensionHmo.pensionEmployeePercent ?? 1.81) / 100;
                employerPensionFund = Math.round(grossSalary * agPensionRate * 100) / 100;
                employeePensionFund = Math.round(grossSalary * anPensionRate * 100) / 100;
            }
        }

        const totalTax = Math.round((wageTax + solidaritySurcharge + churchTax) * 100) / 100;
        const totalEmployeeSocialSecurity = Math.round((
            employeeHealthInsurance +
            employeePensionInsurance +
            employeeUnemploymentInsurance +
            employeeLongTermCareInsurance
        ) * 100) / 100;

        const netSalary = Math.round((grossSalary - totalTax - totalEmployeeSocialSecurity - employeePensionFund) * 100) / 100;

        // Net deductions: e.g. full VL transfer (standard 40.00 € total savings transfer)
        let netDeductions = 0;
        if (employerVl > 0) {
            // If employee has a VL contract, commonly €40.00 is transferred to the savings plan
            const fullVlSavingsRate = 40.00;
            netDeductions = Math.min(netSalary, fullVlSavingsRate);
        }

        const payoutAmount = Math.max(0, Math.round((netSalary - netDeductions) * 100) / 100);

        const totalEmployerSocialSecurity = Math.round((
            employerHealthInsurance +
            employerPensionInsurance +
            employerUnemploymentInsurance +
            employerLongTermCareInsurance +
            employerLevies +
            employerAccidentInsurance +
            employerPensionFund
        ) * 100) / 100;

        const totalEmployerCost = Math.round((grossSalary + totalEmployerSocialSecurity) * 100) / 100;

        // SGB II Subsidies & DEÜV Classifications
        let jobcenterSubsidy = 0;
        let netEmployerCost = totalEmployerCost;
        let furtherTrainingBudget = 0;
        let furtherTrainingUsed = 0;
        let furtherTrainingRemaining = 0;
        let coachingHoursPerMonth = 0;
        let deuevPersonengruppe = payrollProfile?.deuevPersonengruppe || '101';
        let deuevBeitragsgruppe = isMinijob ? '0100' : (payrollProfile?.deuevBeitragsgruppe || '1111');

        if (fundingProgram === 'sgb2_16d') {
            jobcenterSubsidy = baseSalary;
            netEmployerCost = 0;
            deuevPersonengruppe = '190';
            deuevBeitragsgruppe = '0000';
            furtherTrainingBudget = 0;
            furtherTrainingUsed = 0;
            furtherTrainingRemaining = 0;
            coachingHoursPerMonth = 0;
        } else if (fundingProgram === 'sgb2_16i') {
            const subsidyPercent = Number(payrollProfile?.fundingSubsidyPercentage ?? contract?.fundingSubsidyPercentage ?? 100);
            const wageSubsidy = Math.round(baseSalary * (subsidyPercent / 100) * 100) / 100;
            const svSubsidy = Math.round((employerHealthInsurance + employerPensionInsurance + employerLongTermCareInsurance) * (subsidyPercent / 100) * 100) / 100;
            jobcenterSubsidy = Math.round((wageSubsidy + svSubsidy) * 100) / 100;
            netEmployerCost = Math.max(0, Math.round((totalEmployerCost - jobcenterSubsidy) * 100) / 100);
            furtherTrainingBudget = Number(payrollProfile?.furtherTrainingBudget ?? contract?.furtherTrainingBudget ?? 3000);
            furtherTrainingUsed = Number(payrollProfile?.furtherTrainingUsed ?? contract?.furtherTrainingUsed ?? 0);
            furtherTrainingRemaining = Math.max(0, Math.round((furtherTrainingBudget - furtherTrainingUsed) * 100) / 100);
            coachingHoursPerMonth = Number(payrollProfile?.coachingHoursPerMonth ?? contract?.coachingHoursPerMonth ?? 2);
            deuevPersonengruppe = '101';
            deuevBeitragsgruppe = '1101'; // KV: 1, RV: 1, AV: 0, PV: 1
        }

        // Assemble line items for detailed payslip display
        let lineItems: PayrollLineItem[] = [];

        if (fundingProgram === 'sgb2_16d') {
            lineItems = [
                {
                    code: 'SGB2_16D_MAE',
                    name: 'Mehraufwandsentschädigung gem. § 16d SGB II (Arbeitsgelegenheit)',
                    category: 'earning',
                    hours: workedHours > 0 ? workedHours : contractHours,
                    rate: hourlyWage,
                    amount: baseSalary,
                    taxExempt: true,
                    socialSecurityExempt: true,
                    legalReference: '§ 16d Abs. 7 SGB II / § 3 Nr. 2 EStG',
                },
                {
                    code: 'SGB2_16D_SUBSIDY',
                    name: 'Jobcenter Erstattung Mehraufwandsentschädigung (100%)',
                    category: 'employer_contribution',
                    amount: baseSalary,
                    taxExempt: true,
                    socialSecurityExempt: true,
                    legalReference: '§ 16d SGB II',
                },
            ];
        } else {
            lineItems.push({
                code: 'BASE_SALARY',
                name: wageType === 'monthly' ? 'Grundvergütung (Monatsgehalt)' : 'Grundvergütung (Stundenlohn)',
                category: 'earning',
                hours: wageType === 'monthly' ? contractHours : workedHours,
                rate: hourlyWage,
                amount: baseSalary,
                taxExempt: false,
                socialSecurityExempt: false,
            });

            if (overtimeHours > 0) {
                if (overtimePay > 0) {
                    lineItems.push({
                        code: 'OVERTIME_BASE',
                        name: 'Überstunden Grundvergütung',
                        category: 'earning',
                        hours: overtimeHours,
                        rate: hourlyWage,
                        amount: overtimePay,
                        taxExempt: false,
                        socialSecurityExempt: false,
                    });
                }
                if (overtimeSurcharges > 0) {
                    lineItems.push({
                        code: 'OVERTIME_SURCHARGE',
                        name: `Überstundenzuschlag (${overtimePercent}%)`,
                        category: 'earning',
                        hours: overtimeHours,
                        amount: overtimeSurcharges,
                        taxExempt: false,
                        socialSecurityExempt: false,
                    });
                }
            }

            if (breakdown.nightHours > 0 && nightSurchargesTaxFree > 0) {
                lineItems.push({
                    code: 'SURCHARGE_NIGHT',
                    name: `Nachtarbeitszuschlag (${nightPercent}%)`,
                    category: 'earning',
                    hours: breakdown.nightHours,
                    rate: hourlyWage,
                    amount: nightSurchargesTaxFree,
                    taxExempt: true,
                    socialSecurityExempt: isSfnSvFree,
                    legalReference: '§ 3b Abs. 1 Nr. 1 EStG',
                });
            }

            if (breakdown.sundayHours > 0 && sundaySurchargesTaxFree > 0) {
                lineItems.push({
                    code: 'SURCHARGE_SUNDAY',
                    name: `Sonntagszuschlag (${sundayPercent}%)`,
                    category: 'earning',
                    hours: breakdown.sundayHours,
                    rate: hourlyWage,
                    amount: sundaySurchargesTaxFree,
                    taxExempt: true,
                    socialSecurityExempt: isSfnSvFree,
                    legalReference: '§ 3b Abs. 1 Nr. 2 EStG',
                });
            }

            if (breakdown.holidayHours > 0 && holidaySurchargesTaxFree > 0) {
                lineItems.push({
                    code: 'SURCHARGE_HOLIDAY',
                    name: `Feiertagszuschlag (${holidayPercent}%)`,
                    category: 'earning',
                    hours: breakdown.holidayHours,
                    rate: hourlyWage,
                    amount: holidaySurchargesTaxFree,
                    taxExempt: true,
                    socialSecurityExempt: isSfnSvFree,
                    legalReference: '§ 3b Abs. 1 Nr. 3 EStG',
                });
            }

            if (allowances > 0) {
                lineItems.push({
                    code: 'ALLOWANCE_CAPITAL',
                    name: 'Hauptstadtzulage / Zulage',
                    category: 'earning',
                    amount: allowances,
                    taxExempt: false,
                    socialSecurityExempt: false,
                });
            }

            if (employerVl > 0) {
                lineItems.push({
                    code: 'VL_EMPLOYER',
                    name: 'Vermögenswirksame Leistungen (AG-Zuschuss)',
                    category: 'earning',
                    amount: employerVl,
                    taxExempt: false,
                    socialSecurityExempt: false,
                    legalReference: '5. VermBG',
                });
            }

            if (bonus > 0) {
                lineItems.push({
                    code: 'YEARLY_BONUS',
                    name: `Jahressonderzahlung (${contract?.yearlyBonusPercentage ?? 80}%)`,
                    category: 'earning',
                    amount: bonus,
                    taxExempt: false,
                    socialSecurityExempt: false,
                    legalReference: 'TVöD / AWO MTV § 20',
                });
            }

            if (fundingProgram === 'sgb2_16i') {
                const subsidyPercent = Number(payrollProfile?.fundingSubsidyPercentage ?? contract?.fundingSubsidyPercentage ?? 100);
                lineItems.push({
                    code: 'SGB2_16I_SUBSIDY',
                    name: `Jobcenter Lohnkostenzuschuss gem. § 16i SGB II (${subsidyPercent}% Lohn + AG-SV)`,
                    category: 'employer_contribution',
                    amount: jobcenterSubsidy,
                    taxExempt: true,
                    socialSecurityExempt: true,
                    legalReference: '§ 16i Abs. 2 SGB II',
                });
                lineItems.push({
                    code: 'SGB2_16I_AV_EXEMPT',
                    name: 'Arbeitslosenversicherung: Beitragsfrei gem. § 27 Abs. 3 Nr. 5 SGB III (DEÜV BGR 1101)',
                    category: 'deduction',
                    amount: 0,
                    taxExempt: true,
                    socialSecurityExempt: true,
                    legalReference: '§ 27 Abs. 3 Nr. 5 SGB III',
                });
            }

            if (u1Levy > 0) {
                lineItems.push({
                    code: 'U1_LEVY',
                    name: `U1-Umlage Entgeltfortzahlung (Erstattung ${u1Tier}%, Satz ${(effectiveU1Rate * 100).toFixed(2)}%)`,
                    category: 'employer_contribution',
                    amount: u1Levy,
                    taxExempt: true,
                    socialSecurityExempt: true,
                    legalReference: 'AAG § 1',
                });
            }

            if (u2Levy > 0) {
                lineItems.push({
                    code: 'U2_LEVY',
                    name: `U2-Umlage Mutterschutz (${(effectiveU2Rate * 100).toFixed(2)}%)`,
                    category: 'employer_contribution',
                    amount: u2Levy,
                    taxExempt: true,
                    socialSecurityExempt: true,
                    legalReference: 'AAG § 1 / MuSchG',
                });
            }

            if (u3Levy > 0) {
                lineItems.push({
                    code: 'U3_LEVY',
                    name: `U3-Insolvenzgeldumlage (${(effectiveU3Rate * 100).toFixed(2)}%)`,
                    category: 'employer_contribution',
                    amount: u3Levy,
                    taxExempt: true,
                    socialSecurityExempt: true,
                    legalReference: '§ 358 SGB III',
                });
            }

            if (employerAccidentInsurance > 0) {
                const bgName = payrollProfile?.accidentHmo?.name || 'Berufsgenossenschaft';
                lineItems.push({
                    code: 'ACCIDENT_INSURANCE',
                    name: `Gesetzliche Unfallversicherung Grundbeitrag (${bgName} - GK ${Number(payrollProfile?.accidentHmo?.accidentGefahrklasse ?? 1.25).toFixed(2)}, Fuß ${Number(payrollProfile?.accidentHmo?.accidentBeitragsfuss ?? 3.50).toFixed(2)} €)`,
                    category: 'employer_contribution',
                    amount: accidentInsuranceBase,
                    taxExempt: true,
                    socialSecurityExempt: true,
                    legalReference: '§ 153 SGB VII',
                });

                if (accidentInsuranceAdditional > 0) {
                    const addLabel = payrollProfile?.accidentHmo?.accidentAdditionalLabel || 'Ausgleichsumlage Wohlfahrtspflege';
                    const addRate = Number(payrollProfile?.accidentHmo?.accidentAdditionalRate ?? 0.08);
                    lineItems.push({
                        code: 'ACCIDENT_INSURANCE_ADDITIONAL',
                        name: `${addLabel} (${addRate.toFixed(2)} € / 1.000 € Entgelt)`,
                        category: 'employer_contribution',
                        amount: accidentInsuranceAdditional,
                        taxExempt: true,
                        socialSecurityExempt: true,
                        legalReference: '§ 2 Abs. 1 Nr. 9 SGB VII',
                    });
                }
            }

            if (employerPensionFund > 0) {
                lineItems.push({
                    code: 'PENSION_FUND_AG',
                    name: `Zusatzversorgung AG-Umlage (${payrollProfile?.pensionHmo?.name || 'ZVK/VBL'})`,
                    category: 'employer_contribution',
                    amount: employerPensionFund,
                    taxExempt: true,
                    socialSecurityExempt: true,
                    legalReference: 'BetrAVG / TVöD',
                });
            }

            if (employeePensionFund > 0) {
                lineItems.push({
                    code: 'PENSION_FUND_AN',
                    name: `Zusatzversorgung AN-Eigenanteil (${payrollProfile?.pensionHmo?.name || 'ZVK/VBL'})`,
                    category: 'deduction',
                    amount: employeePensionFund,
                    taxExempt: true,
                    socialSecurityExempt: true,
                    legalReference: 'BetrAVG / TVöD',
                });
            }
        }

        return {
            jurisdiction: this.jurisdiction,
            contractHours,
            workedHours,
            overtimeHours,
            nightHours: breakdown.nightHours,
            sundayHours: breakdown.sundayHours,
            holidayHours: breakdown.holidayHours,
            paidLeaveHours,

            baseSalary,
            hourlyWage,
            overtimePay,
            overtimeSurcharges,
            nightSurchargesTaxFree,
            sundaySurchargesTaxFree,
            holidaySurchargesTaxFree,
            allowances,
            employerVl,
            bonus,
            otherAdditions: 0,
            grossSalary,
            taxableGross,
            socialSecurityGross,
            pensionGross,

            wageTax,
            solidaritySurcharge,
            churchTax,
            totalTax,

            employeeHealthInsurance,
            employeePensionInsurance,
            employeeUnemploymentInsurance,
            employeeLongTermCareInsurance,
            totalEmployeeSocialSecurity,

            netSalary,
            netDeductions,
            payoutAmount,

            employerHealthInsurance,
            employerPensionInsurance,
            employerUnemploymentInsurance,
            employerLongTermCareInsurance,
            employerLevies,
            employerAccidentInsurance,
            employerPensionFund,
            employeePensionFund,
            u1Levy,
            u2Levy,
            u3Levy,
            totalEmployerSocialSecurity,
            totalEmployerCost,

            // SGB II Funding & Subsidies (§ 16d / § 16i)
            fundingProgram,
            jobcenterSubsidy,
            netEmployerCost,
            furtherTrainingBudget,
            furtherTrainingUsed,
            furtherTrainingRemaining,
            coachingHoursPerMonth,
            deuevPersonengruppe,
            deuevBeitragsgruppe,

            lineItems,
            calculationDetails: {
                taxClass: payrollProfile?.taxClass || '1',
                churchTaxType: payrollProfile?.churchTax || 'none',
                state,
                isMinijob,
                isSfnSvFree,
                effectiveWageAmount,
                wageType,
                breakdown,
                fundingProgram,
                jobcenterSubsidy,
                netEmployerCost,
                furtherTrainingBudget,
                furtherTrainingRemaining,
                coachingHoursPerMonth,
                deuevPersonengruppe,
                deuevBeitragsgruppe,
                hmoId: payrollProfile?.hmoId || payrollProfile?.hmo?.id || null,
                hmoName: payrollProfile?.hmo?.name || payrollProfile?.healthInsuranceName || 'Techniker Krankenkasse (TK)',
                hmoAdditionalContributionPercent: addContribPercent,
                hmoType: insuranceType,
                u1Levy,
                u1RateUsed: effectiveU1Rate,
                u1TierPercent: u1Tier,
                isU1Exempt: Boolean(payrollProfile?.u1Exempt),
                u2Levy,
                u2RateUsed: effectiveU2Rate,
                u3Levy,
                u3RateUsed: effectiveU3Rate,
                isU3Exempt: Boolean(payrollProfile?.u3Exempt),
                employerAccidentInsurance,
                accidentInsuranceBase,
                accidentInsuranceAdditional,
                accidentAdditionalRate: Number(payrollProfile?.accidentHmo?.accidentAdditionalRate ?? 0),
                accidentAdditionalLabel: payrollProfile?.accidentHmo?.accidentAdditionalLabel || null,
                isAccidentAdditionalApplicable: payrollProfile?.accidentAdditionalApplicable !== false,
                accidentInsurerName: payrollProfile?.accidentHmo?.name || null,
                employerPensionFund,
                employeePensionFund,
                pensionFundName: payrollProfile?.pensionHmo?.name || null,
            },
        };
    }

    /**
     * Calculates German wage tax based on progressive income tax formula (§ 32a EStG 2026).
     */
    private calculateGermanWageTax(monthlyTaxableGross: number, taxClass: TaxClass, childCount: number): number {
        if (monthlyTaxableGross <= 0) return 0;

        // Annualized taxable income estimate (zu versteuerndes Einkommen)
        const annualGross = monthlyTaxableGross * 12;

        // Basic personal allowance (Grundfreibetrag 2026: €12,348)
        const GFB = 12348;

        let annualZvE = annualGross;

        // Apply employee lump sum allowance (Arbeitnehmer-Pauschbetrag €1,230)
        annualZvE = Math.max(0, annualZvE - 1230);

        // Apply special expenses lump sum (Sonderausgaben-Pauschbetrag €36)
        annualZvE = Math.max(0, annualZvE - 36);

        // Adjust based on Tax Class
        switch (taxClass) {
            case '1':
            case '4':
                // Single or married equal earner
                break;
            case '2':
                // Single parent: Entlastungsbetrag für Alleinerziehende (€4,260)
                annualZvE = Math.max(0, annualZvE - 4260);
                break;
            case '3':
                // Married higher earner (splitting table approximation)
                annualZvE = Math.max(0, annualZvE / 2);
                break;
            case '5':
                // Married lower earner: no GFB applied in base bracket, accelerated progression
                annualZvE = annualZvE * 1.5;
                break;
            case '6':
                // Secondary employment: tax from first Euro, higher bracket
                annualZvE = annualZvE * 1.3 + GFB;
                break;
        }

        // Apply 2026 progressive rate formula (§ 32a EStG)
        let annualTax = 0;
        if (taxClass === '6') {
            // Flat progressive withholding starting immediately
            annualTax = annualZvE * 0.25;
        } else if (annualZvE <= GFB) {
            annualTax = 0;
        } else if (annualZvE <= 17005) {
            const y = (annualZvE - GFB) / 10000;
            annualTax = (995.21 * y + 1400) * y;
        } else if (annualZvE <= 66760) {
            const z = (annualZvE - 17005) / 10000;
            annualTax = (208.85 * z + 2397) * z + 1015.51;
        } else if (annualZvE <= 277825) {
            annualTax = 0.42 * annualZvE - 10636.31;
        } else {
            annualTax = 0.45 * annualZvE - 18971.06;
        }

        // Double tax for splitting in class 3
        if (taxClass === '3') {
            annualTax = annualTax * 2;
        }

        const monthlyTax = Math.max(0, Math.round((annualTax / 12) * 100) / 100);
        return monthlyTax;
    }
}

// --- JURISDICTION ENGINE REGISTRY ---

const engineRegistry = new Map<string, PayrollJurisdictionEngine>();
engineRegistry.set('DE', new GermanPayrollEngine());

export function registerPayrollEngine(engine: PayrollJurisdictionEngine) {
    engineRegistry.set(engine.jurisdiction.toUpperCase(), engine);
}

export function getPayrollEngine(jurisdiction: string = 'DE'): PayrollJurisdictionEngine {
    const key = (jurisdiction || 'DE').toUpperCase();
    const engine = engineRegistry.get(key);
    if (!engine) {
        // Fallback to German engine as default
        return engineRegistry.get('DE')!;
    }
    return engine;
}
