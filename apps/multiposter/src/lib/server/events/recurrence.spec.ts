import { describe, it, expect } from 'vitest';
import { expandRecurrence } from './recurrence';
import { RRule } from '$lib/utils/rrule-compat';

describe('Recurrence Expansion', () => {
    const start = new Date('2024-03-01T10:00:00Z');
    const end = new Date('2024-03-01T11:00:00Z');

    it('should expand basic weekly recurrence', () => {
        const rrule = 'FREQ=WEEKLY;COUNT=3';
        const instances = expandRecurrence(rrule, start, end, 50, false);
        
        expect(instances).toHaveLength(2); // master instance is skipped in expandRecurrence
        expect(instances[0].date.toISOString()).toBe('2024-03-08T10:00:00.000Z');
        expect(instances[1].date.toISOString()).toBe('2024-03-15T10:00:00.000Z');
    });

    it('should expand complex weekly recurrence (Mon, Wed, Fri)', () => {
        const rrule = 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6';
        const instances = expandRecurrence(rrule, start, end, 50, false);
        
        // Friday March 1st is the start (skipped)
        // Next are Mon March 4th, Wed March 6th, Fri March 8th, Mon March 11th, Wed March 13th
        expect(instances).toHaveLength(5);
        expect(instances[0].date.toISOString()).toBe('2024-03-04T10:00:00.000Z');
        expect(instances[1].date.toISOString()).toBe('2024-03-06T10:00:00.000Z');
        expect(instances[2].date.toISOString()).toBe('2024-03-08T10:00:00.000Z');
    });

    it('should expand absolute monthly recurrence (15th of every month)', () => {
        const rrule = 'FREQ=MONTHLY;BYMONTHDAY=15;COUNT=3';
        const instances = expandRecurrence(rrule, start, end, 50, false);
        
        expect(instances).toHaveLength(3); // Start date is March 1st, so it doesn't match March 15th
        expect(instances[0].date.toISOString()).toBe('2024-03-15T10:00:00.000Z');
        expect(instances[1].date.toISOString()).toBe('2024-04-15T10:00:00.000Z');
        expect(instances[2].date.toISOString()).toBe('2024-05-15T10:00:00.000Z');
    });

    it('should expand relative monthly recurrence (second Tuesday)', () => {
        // March 2024: 2nd Tuesday is March 12th
        // April 2024: 2nd Tuesday is April 9th
        const rrule = 'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2;COUNT=3';
        const instances = expandRecurrence(rrule, start, end, 50, false);
        
        expect(instances).toHaveLength(3);
        expect(instances[0].date.toISOString()).toBe('2024-03-12T10:00:00.000Z');
        expect(instances[1].date.toISOString()).toBe('2024-04-09T10:00:00.000Z');
        expect(instances[2].date.toISOString()).toBe('2024-05-14T10:00:00.000Z');
    });

    it('should expand relative yearly recurrence (last Friday of August)', () => {
        const rrule = 'FREQ=YEARLY;BYDAY=FR;BYSETPOS=-1;BYMONTH=8;COUNT=2';
        const instances = expandRecurrence(rrule, start, end, 50, false);
        
        // 2024-08-30 is last Friday
        // 2025-08-29 is last Friday
        expect(instances).toHaveLength(2);
        expect(instances[0].date.toISOString()).toBe('2024-08-30T10:00:00.000Z');
        expect(instances[1].date.toISOString()).toBe('2025-08-29T10:00:00.000Z');
    });

    it('should respect UNTIL date', () => {
        const rrule = 'FREQ=DAILY;UNTIL=20240304T000000Z';
        const instances = expandRecurrence(rrule, start, end, 50, false);
        
        // Start: March 1st (skipped)
        // Others: March 2nd, 3rd. March 4th is after/at until. 
        expect(instances).toHaveLength(2);
        expect(instances[0].date.toISOString()).toBe('2024-03-02T10:00:00.000Z');
        expect(instances[1].date.toISOString()).toBe('2024-03-03T10:00:00.000Z');
    });
});
