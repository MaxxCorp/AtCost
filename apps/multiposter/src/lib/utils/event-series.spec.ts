import { describe, it, expect } from "vitest";
import { isSeriesItem, isNonSeriesEvent } from "./event-series";

describe("event-series helper", () => {
    it("identifies standard single one-off events as non-series events", () => {
        const singleEvent = {
            id: "evt-1",
            summary: "Special Guest Concert",
            startDateTime: "2026-10-15T19:00:00Z",
            endDateTime: "2026-10-15T21:00:00Z"
        };

        expect(isSeriesItem(singleEvent)).toBe(false);
        expect(isNonSeriesEvent(singleEvent)).toBe(true);
    });

    it("identifies events with recurrence array as series events", () => {
        const recurringEvent = {
            id: "evt-master",
            summary: "Weekly Choir Rehearsal",
            startDateTime: "2026-10-01T18:00:00Z",
            recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=TH"]
        };

        expect(isSeriesItem(recurringEvent)).toBe(true);
        expect(isNonSeriesEvent(recurringEvent)).toBe(false);
    });

    it("identifies events with recurringEventId as series events", () => {
        const instanceEvent = {
            id: "evt-inst-1",
            summary: "Weekly Choir Rehearsal",
            startDateTime: "2026-10-08T18:00:00Z",
            recurringEventId: "evt-master"
        };

        expect(isSeriesItem(instanceEvent)).toBe(true);
        expect(isNonSeriesEvent(instanceEvent)).toBe(false);
    });

    it("identifies events with seriesId as series events", () => {
        const seriesEvent = {
            id: "evt-2",
            summary: "Bible Study Group",
            startDateTime: "2026-10-02T19:00:00Z",
            seriesId: "series-uuid-123"
        };

        expect(isSeriesItem(seriesEvent)).toBe(true);
        expect(isNonSeriesEvent(seriesEvent)).toBe(false);
    });

    it("identifies events with isSeries flag as series events", () => {
        const flagEvent = {
            id: "evt-3",
            summary: "Regular Service",
            startDateTime: "2026-10-04T10:00:00Z",
            isSeries: true
        };

        expect(isSeriesItem(flagEvent)).toBe(true);
        expect(isNonSeriesEvent(flagEvent)).toBe(false);
    });

    it("identifies compressed series items as series events", () => {
        const compressed = {
            id: "series-group-1",
            summary: "Weekly Meditation",
            startDateTime: "2026-10-01T08:00:00Z",
            isCompressedSeries: true,
            seriesDates: ["2026-10-01T08:00:00Z", "2026-10-08T08:00:00Z"]
        };

        expect(isSeriesItem(compressed)).toBe(true);
        expect(isNonSeriesEvent(compressed)).toBe(false);
    });

    it("identifies events tagged with 'Series' as series events", () => {
        const stringTagged = {
            id: "evt-4",
            summary: "Youth Gathering",
            startDateTime: "2026-10-05T17:00:00Z",
            tags: ["Series", "Youth"]
        };
        const objectTagged = {
            id: "evt-5",
            summary: "Youth Gathering",
            startDateTime: "2026-10-05T17:00:00Z",
            tags: [{ id: "tag-1", name: "Series" }]
        };

        expect(isSeriesItem(stringTagged)).toBe(true);
        expect(isNonSeriesEvent(stringTagged)).toBe(false);
        expect(isSeriesItem(objectTagged)).toBe(true);
        expect(isNonSeriesEvent(objectTagged)).toBe(false);
    });

    it("does not treat announcements as non-series events", () => {
        const announcement = {
            id: "ann-1",
            title: "Roof Renovation Notice",
            content: "Please be aware of scaffolding in courtyard."
        };

        expect(isSeriesItem(announcement)).toBe(false);
        expect(isNonSeriesEvent(announcement)).toBe(false);
    });

    it("safely handles null or undefined values", () => {
        expect(isSeriesItem(null)).toBe(false);
        expect(isSeriesItem(undefined)).toBe(false);
        expect(isNonSeriesEvent(null)).toBe(false);
        expect(isNonSeriesEvent(undefined)).toBe(false);
    });
});
