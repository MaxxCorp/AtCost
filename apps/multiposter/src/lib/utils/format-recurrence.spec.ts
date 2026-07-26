import { describe, it, expect } from "vitest";
import { formatRecurrenceText } from "./format-recurrence";
import { setLocale } from "$lib/paraglide/runtime.js";

describe("formatRecurrenceText", () => {
    describe("English locale", () => {
        it("should format non-consecutive weekly recurrence", () => {
            const text = formatRecurrenceText("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "en");
            expect(text.toLowerCase()).toContain("every 2 weeks");
            expect(text.toLowerCase()).toContain("monday");
        });

        it("should format monthly relative weekday recurrence (e.g. 2nd Monday)", () => {
            const text = formatRecurrenceText("RRULE:FREQ=MONTHLY;BYDAY=2MO", "en");
            expect(text.toLowerCase()).toContain("every month");
            expect(text.toLowerCase()).toContain("2nd monday");
        });

        it("should format 2-month interval with relative weekday (e.g. every 2 months on 2nd Monday)", () => {
            const text = formatRecurrenceText("RRULE:FREQ=MONTHLY;INTERVAL=2;BYDAY=2MO", "en");
            expect(text.toLowerCase()).toContain("every 2 months");
            expect(text.toLowerCase()).toContain("2nd monday");
        });

        it("should format positional weekday rule", () => {
            const text = formatRecurrenceText("RRULE:FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO,TU,WE,TH,FR", "en");
            expect(text.toLowerCase()).toContain("weekday");
        });
    });

    describe("German locale", () => {
        it("should format non-consecutive weekly recurrence in German", () => {
            const text = formatRecurrenceText("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "de");
            expect(text).toContain("alle 2 Wochen");
            expect(text).toContain("Montag");
        });

        it("should format monthly relative weekday recurrence in German (jeden Monat am 2. Montag)", () => {
            const text = formatRecurrenceText("RRULE:FREQ=MONTHLY;BYDAY=2MO", "de");
            expect(text).toContain("jeden Monat");
            expect(text).toContain("2. Montag");
        });

        it("should format 2-month interval with relative weekday in German (alle 2 Monate am 2. Montag)", () => {
            const text = formatRecurrenceText("RRULE:FREQ=MONTHLY;INTERVAL=2;BYDAY=2MO", "de");
            expect(text).toContain("alle 2 Monate");
            expect(text).toContain("2. Montag");
        });

        it("should format positional weekday rule in German (am 1. Wochentag)", () => {
            const text = formatRecurrenceText("RRULE:FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO,TU,WE,TH,FR", "de");
            expect(text).toContain("Wochentag");
        });

        it("should format positional weekend day rule in German (am 2. Wochenendtag)", () => {
            const text = formatRecurrenceText("RRULE:FREQ=MONTHLY;BYSETPOS=2;BYDAY=SA,SU", "de");
            expect(text).toContain("Wochenendtag");
        });

        it("should format last Sunday of the month in German (am letzten Sonntag)", () => {
            const text = formatRecurrenceText("RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=SU", "de");
            expect(text).toContain("letzten Sonntag");
        });
    });
});
