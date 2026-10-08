import { describe, it, expect } from "vitest";
import {
    formatForInput,
    getNextWeekRange,
    getThisWeekRange,
    getNextMonthRange,
    getThisMonthRange,
    formatDateRangeDisplay
} from "./kiosk-dates";

describe("kiosk-dates utility", () => {
    describe("formatForInput", () => {
        it("formats date to YYYY-MM-DDTHH:mm", () => {
            const date = new Date(2026, 9, 8, 14, 30); // Oct 8, 2026 14:30
            expect(formatForInput(date)).toBe("2026-10-08T14:30");
        });
    });

    describe("getNextWeekRange", () => {
        it("computes next week Monday to Sunday when now is Thursday", () => {
            const thursday = new Date(2026, 9, 8, 12, 0); // Thursday Oct 8, 2026
            const { start, end } = getNextWeekRange(thursday);

            expect(start.getDay()).toBe(1); // Monday
            expect(start.getFullYear()).toBe(2026);
            expect(start.getMonth()).toBe(9); // October
            expect(start.getDate()).toBe(12); // Monday Oct 12
            expect(start.getHours()).toBe(0);
            expect(start.getMinutes()).toBe(0);

            expect(end.getDay()).toBe(0); // Sunday
            expect(end.getFullYear()).toBe(2026);
            expect(end.getMonth()).toBe(9);
            expect(end.getDate()).toBe(18); // Sunday Oct 18
            expect(end.getHours()).toBe(23);
            expect(end.getMinutes()).toBe(59);
        });

        it("computes next week Monday to Sunday when now is Sunday", () => {
            const sunday = new Date(2026, 9, 11, 20, 0); // Sunday Oct 11, 2026
            const { start, end } = getNextWeekRange(sunday);

            expect(start.getDate()).toBe(12); // Next day Monday Oct 12
            expect(end.getDate()).toBe(18); // Sunday Oct 18
        });

        it("computes next week Monday to Sunday when now is Monday", () => {
            const monday = new Date(2026, 9, 12, 8, 0); // Monday Oct 12, 2026
            const { start, end } = getNextWeekRange(monday);

            expect(start.getDate()).toBe(19); // Monday Oct 19
            expect(end.getDate()).toBe(25); // Sunday Oct 25
        });
    });

    describe("getThisWeekRange", () => {
        it("computes this week Monday to Sunday when now is Thursday", () => {
            const thursday = new Date(2026, 9, 8, 12, 0); // Thursday Oct 8, 2026
            const { start, end } = getThisWeekRange(thursday);

            expect(start.getDate()).toBe(5); // Monday Oct 5
            expect(start.getDay()).toBe(1);
            expect(end.getDate()).toBe(11); // Sunday Oct 11
            expect(end.getDay()).toBe(0);
        });

        it("computes this week Monday to Sunday when now is Sunday", () => {
            const sunday = new Date(2026, 9, 11, 20, 0); // Sunday Oct 11, 2026
            const { start, end } = getThisWeekRange(sunday);

            expect(start.getDate()).toBe(5); // Monday Oct 5
            expect(end.getDate()).toBe(11); // Sunday Oct 11
        });
    });

    describe("getNextMonthRange", () => {
        it("computes 1st to last day of next month", () => {
            const date = new Date(2026, 9, 8); // October 2026
            const { start, end } = getNextMonthRange(date);

            expect(start.getFullYear()).toBe(2026);
            expect(start.getMonth()).toBe(10); // November
            expect(start.getDate()).toBe(1);

            expect(end.getFullYear()).toBe(2026);
            expect(end.getMonth()).toBe(10); // November
            expect(end.getDate()).toBe(30); // 30 days in Nov
        });

        it("handles December to January transition", () => {
            const date = new Date(2026, 11, 15); // December 2026
            const { start, end } = getNextMonthRange(date);

            expect(start.getFullYear()).toBe(2027);
            expect(start.getMonth()).toBe(0); // January
            expect(start.getDate()).toBe(1);

            expect(end.getFullYear()).toBe(2027);
            expect(end.getMonth()).toBe(0);
            expect(end.getDate()).toBe(31);
        });
    });

    describe("getThisMonthRange", () => {
        it("computes 1st to last day of current month", () => {
            const date = new Date(2026, 9, 8); // October 2026
            const { start, end } = getThisMonthRange(date);

            expect(start.getFullYear()).toBe(2026);
            expect(start.getMonth()).toBe(9); // October
            expect(start.getDate()).toBe(1);

            expect(end.getFullYear()).toBe(2026);
            expect(end.getMonth()).toBe(9);
            expect(end.getDate()).toBe(31); // 31 days in Oct
        });
    });

    describe("formatDateRangeDisplay", () => {
        it("formats start and end dates nicely", () => {
            const start = new Date(2026, 9, 12, 0, 0);
            const end = new Date(2026, 9, 18, 23, 59);
            const formatted = formatDateRangeDisplay(start, end, "en");
            expect(formatted).toContain("Oct 12");
            expect(formatted).toContain("Oct 18, 2026");
        });
    });
});
