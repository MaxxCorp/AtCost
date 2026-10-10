import { describe, it, expect } from "vitest";
import { isSeriesItem, isNonSeriesEvent, isVirtualInstanceId, parseVirtualInstanceId, isSeriesMaster, isSeriesInstance, getSeriesRootId } from "./event-series";

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

    it("identifies virtual instance events as series events", () => {
        const virtualInstance = {
            id: "master-uuid-123_inst_2026-10-01T10:00:00.000Z",
            summary: "Weekly Practice",
            startDateTime: "2026-10-01T10:00:00.000Z",
            endDateTime: "2026-10-01T11:00:00.000Z"
        };

        expect(isSeriesItem(virtualInstance)).toBe(true);
        expect(isNonSeriesEvent(virtualInstance)).toBe(false);
    });

    it("identifies materialized exception events as series events", () => {
        const exceptionEvent = {
            id: "exception-uuid-456",
            summary: "Weekly Practice (Rescheduled)",
            startDateTime: "2026-10-01T14:00:00.000Z",
            endDateTime: "2026-10-01T15:00:00.000Z",
            isException: true,
            originalStartTime: { dateTime: "2026-10-01T10:00:00.000Z" }
        };

        expect(isSeriesItem(exceptionEvent)).toBe(true);
        expect(isNonSeriesEvent(exceptionEvent)).toBe(false);
    });

    it("safely handles null or undefined values", () => {
        expect(isSeriesItem(null)).toBe(false);
        expect(isSeriesItem(undefined)).toBe(false);
        expect(isNonSeriesEvent(null)).toBe(false);
        expect(isNonSeriesEvent(undefined)).toBe(false);
    });

    it("parses and identifies virtual instance IDs correctly", () => {
        expect(isVirtualInstanceId("master-123_inst_2026-10-15T14%3A00%3A00.000Z")).toBe(true);
        expect(isVirtualInstanceId("regular-uuid-456")).toBe(false);
        expect(isVirtualInstanceId(null)).toBe(false);

        const parsed = parseVirtualInstanceId("master-123_inst_2026-10-15T14%3A00%3A00.000Z");
        expect(parsed).toEqual({
            masterId: "master-123",
            iso: "2026-10-15T14:00:00.000Z"
        });
        expect(parseVirtualInstanceId("not-a-virtual-id")).toBeNull();
    });

    it("correctly identifies series masters, instances, and resolves root series ID", () => {
        const master = {
            id: "master-123",
            recurrence: ["RRULE:FREQ=WEEKLY"]
        };
        const virtual = {
            id: "master-123_inst_2026-10-15T14:00:00.000Z"
        };
        const exception = {
            id: "exception-789",
            recurringEventId: "master-123",
            isException: true
        };

        expect(isSeriesMaster(master)).toBe(true);
        expect(isSeriesMaster(virtual)).toBe(false);
        expect(isSeriesMaster(exception)).toBe(false);

        expect(isSeriesInstance(master)).toBe(false);
        expect(isSeriesInstance(virtual)).toBe(true);
        expect(isSeriesInstance(exception)).toBe(true);

        expect(getSeriesRootId(master)).toBe("master-123");
        expect(getSeriesRootId(virtual)).toBe("master-123");
        expect(getSeriesRootId(exception)).toBe("master-123");
        expect(getSeriesRootId("master-123_inst_2026-10-15T14:00:00.000Z")).toBe("master-123");
    });
});

