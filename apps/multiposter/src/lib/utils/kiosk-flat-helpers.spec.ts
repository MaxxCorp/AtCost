import { describe, it, expect } from "vitest";
import { formatTimeRange, defaultVisibleComponents } from "./kiosk-flat-helpers.js";

describe("kiosk-flat-helpers", () => {
    describe("formatTimeRange", () => {
        it("returns all day label when isAllDay is true", () => {
            const result = formatTimeRange("2026-11-02T10:00:00Z", "2026-11-02T12:00:00Z", true);
            expect(result.length).toBeGreaterThan(0);
        });

        it("returns empty string when start date is missing", () => {
            expect(formatTimeRange(null, "2026-11-02T12:00:00Z")).toBe("");
            expect(formatTimeRange(undefined, "2026-11-02T12:00:00Z")).toBe("");
        });

        it("formats start and end time when showEndTime is true (default)", () => {
            const start = "2026-11-02T14:00:00";
            const end = "2026-11-02T16:00:00";
            const result = formatTimeRange(start, end, false);
            expect(result).toContain(" – ");
        });

        it("formats only start time when showEndTime is false", () => {
            const start = "2026-11-02T14:00:00";
            const end = "2026-11-02T16:00:00";
            const withEnd = formatTimeRange(start, end, false, true);
            const withoutEnd = formatTimeRange(start, end, false, false);
            expect(withEnd).toContain(" – ");
            expect(withoutEnd).not.toContain(" – ");
            expect(withoutEnd.length).toBeGreaterThan(0);
            expect(withEnd.startsWith(withoutEnd)).toBe(true);
        });

        it("formats only start time when endStr is null or undefined", () => {
            const start = "2026-11-02T14:00:00";
            const resultNull = formatTimeRange(start, null, false);
            const resultUndef = formatTimeRange(start, undefined, false);
            expect(resultNull).not.toContain(" – ");
            expect(resultUndef).not.toContain(" – ");
            expect(resultNull).toBe(resultUndef);
        });
    });

    describe("defaultVisibleComponents", () => {
        it("includes endTimes defaulted to true", () => {
            expect(defaultVisibleComponents.endTimes).toBe(true);
        });
    });
});
