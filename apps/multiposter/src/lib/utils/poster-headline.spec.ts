import { describe, it, expect } from "vitest";
import { formatPosterProgrammeHeadline, getISOWeekNumber } from "./kiosk-flat-helpers";

describe("formatPosterProgrammeHeadline", () => {
    it("returns custom title if provided and non-empty", () => {
        const kiosk = { rangeMode: "this_month" };
        const result = formatPosterProgrammeHeadline(kiosk, [], "Sonderprogramm Sommer 2026");
        expect(result).toBe("Sonderprogramm Sommer 2026");
    });

    it("formats week range with KW<Weeknumber> when rangeMode is this_week", () => {
        const kiosk = { rangeMode: "this_week" };
        const result = formatPosterProgrammeHeadline(kiosk, []);
        expect(result).toMatch(/^Programm • KW\d+$/);
    });

    it("formats week range with KW<Weeknumber> when fixed 7-day range is selected", () => {
        // Oct 12, 2026 to Oct 18, 2026 is week 42 of 2026
        const kiosk = {
            rangeMode: "fixed",
            startDate: "2026-10-12T00:00:00Z",
            endDate: "2026-10-18T23:59:59Z"
        };
        const result = formatPosterProgrammeHeadline(kiosk, []);
        expect(result).toBe("Programm • KW42");
    });

    it("formats month range with <Month in numbers> <Year> when rangeMode is this_month", () => {
        const kiosk = {
            rangeMode: "fixed",
            startDate: "2026-10-01T00:00:00Z",
            endDate: "2026-10-31T23:59:59Z"
        };
        const result = formatPosterProgrammeHeadline(kiosk, []);
        expect(result).toBe("Programm • 10 2026");
    });

    it("formats quarter range with Q<quarter> <year> when ~90 days is selected", () => {
        const kiosk = {
            rangeMode: "fixed",
            startDate: "2026-10-01T00:00:00Z",
            endDate: "2026-12-31T23:59:59Z"
        };
        const result = formatPosterProgrammeHeadline(kiosk, []);
        expect(result).toBe("Programm • Q4 2026");
    });

    it("formats year range with <year> when ~365 days is selected", () => {
        const kiosk = {
            rangeMode: "fixed",
            startDate: "2026-01-01T00:00:00Z",
            endDate: "2026-12-31T23:59:59Z"
        };
        const result = formatPosterProgrammeHeadline(kiosk, []);
        expect(result).toBe("Programm • 2026");
    });

    it("correctly derives time range from items if kiosk dates are omitted", () => {
        const kiosk = { rangeMode: "rolling" };
        const items = [
            { id: "e1", startDateTime: "2026-10-12T10:00:00Z" },
            { id: "e2", startDateTime: "2026-10-15T14:00:00Z" }
        ];
        // 3 days span -> closest to week
        const result = formatPosterProgrammeHeadline(kiosk, items);
        expect(result).toBe("Programm • KW42");
    });
});

describe("getISOWeekNumber", () => {
    it("calculates correct ISO week numbers", () => {
        expect(getISOWeekNumber(new Date("2026-01-01T00:00:00Z"))).toBe(1); // 2026 starts on Thursday
        expect(getISOWeekNumber(new Date("2026-10-12T00:00:00Z"))).toBe(42);
        expect(getISOWeekNumber(new Date("2026-10-19T00:00:00Z"))).toBe(43);
    });
});
