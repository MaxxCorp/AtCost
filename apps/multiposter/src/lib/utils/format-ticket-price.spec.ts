import { describe, it, expect } from "vitest";
import { formatTicketPrice } from "./format-ticket-price";

describe("formatTicketPrice", () => {
    describe("when price is unknown or not set", () => {
        it("returns null when ticketPriceUnknown is true", () => {
            expect(formatTicketPrice("0", true)).toBeNull();
            expect(formatTicketPrice("15 €", true)).toBeNull();
            expect(formatTicketPrice("Kostenlos", true)).toBeNull();
            expect(formatTicketPrice(null, true)).toBeNull();
        });

        it("returns null when ticketPriceUnknown is 'true' or 'on'", () => {
            expect(formatTicketPrice("0", "true")).toBeNull();
            expect(formatTicketPrice("0", "on")).toBeNull();
        });

        it("returns null when ticketPrice is null, undefined, or empty", () => {
            expect(formatTicketPrice(null, false)).toBeNull();
            expect(formatTicketPrice(undefined, false)).toBeNull();
            expect(formatTicketPrice("", false)).toBeNull();
            expect(formatTicketPrice("   ", false)).toBeNull();
        });
    });

    describe("when price is explicitly zero / free in German", () => {
        const opts = { locale: 'de' as const };

        it("evaluates numeric zero in German", () => {
            expect(formatTicketPrice("0", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("0.00", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("0,00", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("0 €", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("0,00 €", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("0.00 EUR", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("0 EUR", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("0 Euro", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("0,-", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("0,- €", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("0.- €", false, opts)).toBe("Kostenlos");
        });

        it("evaluates free text keywords in German", () => {
            expect(formatTicketPrice("kostenlos", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("Kostenlos", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("frei", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("Eintritt frei", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("gratis", false, opts)).toBe("Kostenlos");
            expect(formatTicketPrice("Free", false, opts)).toBe("Kostenlos");
        });
    });

    describe("when price is explicitly zero / free in English", () => {
        const opts = { locale: 'en' as const };

        it("evaluates free in English", () => {
            expect(formatTicketPrice("0", false, opts)).toBe("Free");
            expect(formatTicketPrice("0.00", false, opts)).toBe("Free");
            expect(formatTicketPrice("0 €", false, opts)).toBe("Free");
            expect(formatTicketPrice("free", false, opts)).toBe("Free");
            expect(formatTicketPrice("Free", false, opts)).toBe("Free");
            expect(formatTicketPrice("Kostenlos", false, opts)).toBe("Free");
        });
    });

    describe("when price is a paid amount", () => {
        it("returns the formatted/entered price string unchanged", () => {
            expect(formatTicketPrice("15 €", false)).toBe("15 €");
            expect(formatTicketPrice("12,50 €", false)).toBe("12,50 €");
            expect(formatTicketPrice("10.00 EUR", false)).toBe("10.00 EUR");
            expect(formatTicketPrice("Spende", false)).toBe("Spende");
            expect(formatTicketPrice("ab 5 €", false)).toBe("ab 5 €");
        });
    });
});
