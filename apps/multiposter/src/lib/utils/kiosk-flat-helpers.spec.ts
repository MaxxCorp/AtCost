import { describe, it, expect } from "vitest";
import { formatTimeRange, defaultVisibleComponents, compressSeriesEvents, type EnrichedEvent } from "./kiosk-flat-helpers.js";

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

    describe("compressSeriesEvents", () => {
        const makeEvent = (overrides: Partial<EnrichedEvent> = {}): EnrichedEvent => ({
            id: "evt-1",
            userId: "user-1",
            seriesId: null,
            summary: "Weekly Meetup",
            description: null,
            internalNotes: null,
            startDateTime: "2026-12-01T18:00:00.000Z",
            startTimeZone: "Europe/Berlin",
            endDateTime: "2026-12-01T20:00:00.000Z",
            endTimeZone: "Europe/Berlin",
            isAllDay: false,
            prepMinutes: 0,
            teardownMinutes: 0,
            status: "confirmed",
            recurrence: null,
            exdates: [],
            recurringEventId: null,
            originalStartTime: null,
            isException: false,
            isPublic: true,
            guestsCanInviteOthers: true,
            guestsCanModify: false,
            guestsCanSeeOtherGuests: true,
            campaignId: null,
            ticketPrice: null,
            ticketPriceUnknown: false,
            currency: "EUR",
            categoryBerlinDotDe: null,
            qrCodePath: null,
            iCalPath: null,
            iCalUID: null,
            heroImage: null,
            attendees: null,
            participantsCount: 0,
            signUpMode: "off",
            signUpClosureDate: null,
            signUpRecurrence: null,
            signUpContactId: null,
            signUpContactOverridden: false,
            reminders: null,
            fingerprints: {},
            createdAt: "2026-11-01T00:00:00.000Z",
            updatedAt: "2026-11-01T00:00:00.000Z",
            ...overrides,
        });

        it("groups multiple occurrences of a recurring series into one compressed entry and preserves heroImage", () => {
            const master = makeEvent({
                id: "master-1",
                recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=TU"],
                startDateTime: "2026-12-01T18:00:00.000Z",
                endDateTime: "2026-12-01T20:00:00.000Z",
                heroImage: "/media/poster.png",
                qrCodeDataUrl: "data:image/png;base64,abc",
            });
            const inst2 = makeEvent({
                id: "master-1_inst_2026-12-08T18:00:00.000Z",
                recurringEventId: "master-1",
                startDateTime: "2026-12-08T18:00:00.000Z",
                endDateTime: "2026-12-08T20:00:00.000Z",
                heroImage: null,
            });
            const standalone = makeEvent({
                id: "single-1",
                summary: "Special Concert",
                startDateTime: "2026-12-05T19:00:00.000Z",
                endDateTime: "2026-12-05T21:00:00.000Z",
            });

            const result = compressSeriesEvents([inst2, standalone, master], "none", { short: false, includeEnd: true });
            expect(result).toHaveLength(2);

            const compressed = result.find((e) => e.isCompressedSeries);
            const nonSeries = result.find((e) => !e.isCompressedSeries);

            expect(compressed).toBeDefined();
            expect(compressed!.instanceCount).toBe(2);
            expect(compressed!.seriesInstances?.map((i) => i.startDateTime)).toEqual([
                "2026-12-01T18:00:00.000Z",
                "2026-12-08T18:00:00.000Z",
            ]);
            expect(compressed!.heroImage).toBe("/media/poster.png");
            expect(compressed!.qrCodeDataUrl).toBe("data:image/png;base64,abc");
            expect(compressed!.recurrenceText).toBeTruthy();

            expect(nonSeries?.id).toBe("single-1");
        });

        it("reflects partial vs full cancelled status across seriesInstances", () => {
            const inst1 = makeEvent({
                id: "master-2",
                recurrence: ["RRULE:FREQ=WEEKLY"],
                startDateTime: "2026-12-01T10:00:00.000Z",
                status: "confirmed",
            });
            const inst2 = makeEvent({
                id: "master-2_inst_2026-12-08T10:00:00.000Z",
                recurringEventId: "master-2",
                startDateTime: "2026-12-08T10:00:00.000Z",
                status: "cancelled",
            });

            const partial = compressSeriesEvents([inst1, inst2], "none");
            expect(partial[0].status).toBe("confirmed");
            expect(partial[0].seriesInstances?.filter((i) => i.status === "cancelled")).toHaveLength(1);

            const full = compressSeriesEvents(
                [
                    { ...inst1, status: "cancelled" },
                    inst2,
                ],
                "none"
            );
            expect(full[0].status).toBe("cancelled");
        });
    });
});
