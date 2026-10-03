import { describe, it, expect } from "vitest";
import {
	isMultiDayEvent,
	getEventDurationDays,
	getEventDateParts,
	formatFriendlyEventTime,
} from "./format-event-date";

describe("format-event-date utility", () => {
	describe("isMultiDayEvent", () => {
		it("returns false for missing dates", () => {
			expect(isMultiDayEvent(null)).toBe(false);
			expect(isMultiDayEvent({})).toBe(false);
			expect(isMultiDayEvent({ startDateTime: "2026-10-10T10:00:00Z" })).toBe(false);
		});

		it("returns false for same-day timed events", () => {
			expect(
				isMultiDayEvent({
					startDateTime: "2026-10-10T10:00:00Z",
					endDateTime: "2026-10-10T18:00:00Z",
				})
			).toBe(false);
		});

		it("returns false for same-day all-day events", () => {
			expect(
				isMultiDayEvent({
					startDateTime: "2026-10-10T00:00:00Z",
					endDateTime: "2026-10-10T23:59:59Z",
					isAllDay: true,
				})
			).toBe(false);
		});

		it("returns false for 24h event ending at midnight next day", () => {
			expect(
				isMultiDayEvent({
					startDateTime: "2026-10-10T00:00:00Z",
					endDateTime: "2026-10-11T00:00:00Z",
				})
			).toBe(false);
		});

		it("returns true for timed event spanning across multiple days", () => {
			expect(
				isMultiDayEvent({
					startDateTime: "2026-10-10T18:00:00Z",
					endDateTime: "2026-10-12T14:00:00Z",
				})
			).toBe(true);
		});

		it("returns true for all-day event spanning multiple days", () => {
			expect(
				isMultiDayEvent({
					startDateTime: "2026-10-10T00:00:00Z",
					endDateTime: "2026-10-13T23:59:59Z",
					isAllDay: true,
				})
			).toBe(true);
		});
	});

	describe("getEventDurationDays", () => {
		it("returns 1 for same-day events", () => {
			expect(
				getEventDurationDays({
					startDateTime: "2026-10-10T10:00:00Z",
					endDateTime: "2026-10-10T14:00:00Z",
				})
			).toBe(1);
		});

		it("returns 3 for 3-day events", () => {
			expect(
				getEventDurationDays({
					startDateTime: "2026-10-10T10:00:00Z",
					endDateTime: "2026-10-12T18:00:00Z",
				})
			).toBe(3);
		});
	});

	describe("getEventDateParts", () => {
		it("correctly identifies single-day event parts", () => {
			const parts = getEventDateParts(
				{
					startDateTime: "2026-10-10T10:00:00Z",
					endDateTime: "2026-10-10T14:00:00Z",
				},
				"en-US"
			);
			expect(parts.isMultiDay).toBe(false);
			expect(parts.totalDays).toBe(1);
			expect(parts.startDay).toBe("10");
			expect(parts.startMonth).toBe("Oct");
		});

		it("correctly formats multi-day event rangeText", () => {
			const parts = getEventDateParts(
				{
					startDateTime: "2026-10-10T10:00:00Z",
					endDateTime: "2026-10-14T14:00:00Z",
				},
				"en-US"
			);
			expect(parts.isMultiDay).toBe(true);
			expect(parts.totalDays).toBe(5);
			expect(parts.startDay).toBe("10");
			expect(parts.endDay).toBe("14");
			expect(parts.rangeText).toBe("10. – 14. Oct");
		});
	});

	describe("formatFriendlyEventTime", () => {
		it("formats multi-day timed event with both start and end date/time", () => {
			const str = formatFriendlyEventTime(
				{
					startDateTime: "2026-10-10T10:00:00Z",
					endDateTime: "2026-10-12T18:00:00Z",
					isAllDay: false,
				},
				{ all_day: "All-day" },
				"en-US"
			);
			expect(str).toContain("Oct 10");
			expect(str).toContain("Oct 12");
			expect(str).toContain("–");
		});

		it("formats multi-day all-day event with day count suffix", () => {
			const startLocal = new Date(2026, 9, 10, 0, 0, 0);
			const endLocal = new Date(2026, 9, 12, 23, 59, 59);
			const str = formatFriendlyEventTime(
				{
					startDateTime: startLocal.toISOString(),
					endDateTime: endLocal.toISOString(),
					isAllDay: true,
				},
				{
					all_day: "All-day",
					days_count: (c) => `${c} days`,
				},
				"en-US"
			);
			expect(str).toContain("All-day:");
			expect(str).toContain("Oct 10");
			expect(str).toContain("Oct 12");
			expect(str).toContain("(3 days)");
		});
	});
});
