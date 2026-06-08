import { RRule } from "rrule";
import ENGLISH from "rrule/dist/esm/nlp/i18n.js";
import * as m from "$lib/paraglide/messages";
import { getLocale } from "$lib/paraglide/runtime";

export function formatRecurrenceText(ruleStr: string | string[] | null | undefined): string {
    if (!ruleStr) return m.recurrence();
    
    // Extract string if it's an array
    let cleanRule = Array.isArray(ruleStr) ? ruleStr[0] : ruleStr;
    if (!cleanRule) return m.recurrence();

    try {
        if (!cleanRule.startsWith('RRULE:')) {
            cleanRule = 'RRULE:' + cleanRule;
        }

        // Generate English string first
        const textEn = RRule.fromString(cleanRule).toText();

        if (getLocale() === 'de') {
            let textDe = textEn;
            // Singular forms
            textDe = textDe.replace(/every day/g, 'jeden Tag');
            textDe = textDe.replace(/every week/g, 'jede Woche');
            textDe = textDe.replace(/every month/g, 'jeden Monat');
            textDe = textDe.replace(/every year/g, 'jedes Jahr');
            // Plural forms
            textDe = textDe.replace(/every (\d+) days/g, 'alle $1 Tage');
            textDe = textDe.replace(/every (\d+) weeks/g, 'alle $1 Wochen');
            textDe = textDe.replace(/every (\d+) months/g, 'alle $1 Monate');
            textDe = textDe.replace(/every (\d+) years/g, 'alle $1 Jahre');

            // Dates before months to preserve English month names for parsing
            textDe = textDe.replace(/until (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/gi, 'bis zum $2. $1 $3');

            // Months
            const monthsMap: Record<string, string> = {
                'January': 'Januar', 'February': 'Februar', 'March': 'März', 'April': 'April',
                'May': 'Mai', 'June': 'Juni', 'July': 'Juli', 'August': 'August',
                'September': 'September', 'October': 'Oktober', 'November': 'November', 'December': 'Dezember'
            };
            for (const [en, de] of Object.entries(monthsMap)) {
                textDe = textDe.replace(new RegExp(en, 'gi'), de);
                textDe = textDe.replace(new RegExp('in ' + de, 'gi'), 'im ' + de); // English "in January" -> German "im Januar"
            }

            // Days of week
            const daysMap: Record<string, string> = {
                'Monday': 'Montag', 'Tuesday': 'Dienstag', 'Wednesday': 'Mittwoch',
                'Thursday': 'Donnerstag', 'Friday': 'Freitag', 'Saturday': 'Samstag', 'Sunday': 'Sonntag'
            };
            
            // "on Monday" -> "am Montag"
            textDe = textDe.replace(/on (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi, (match, day) => {
                // match might have different casing, so we capitalize first letter
                const d = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
                return `am ${daysMap[d]}`;
            });
            // Replace remaining days (e.g. in lists: "on Monday, Tuesday")
            for (const [en, de] of Object.entries(daysMap)) {
                textDe = textDe.replace(new RegExp(en, 'gi'), de);
            }

            // "on the Xth"
            textDe = textDe.replace(/on the last/gi, 'am letzten');
            textDe = textDe.replace(/on the (\d+)(st|nd|rd|th)/gi, 'am $1.');

            // Structural words
            textDe = textDe.replace(/ until /gi, ' bis ');
            textDe = textDe.replace(/ for (\d+) times/gi, ' $1 mal');
            textDe = textDe.replace(/ for 1 time/gi, ' einmal');
            textDe = textDe.replace(/ and /gi, ' und ');
            textDe = textDe.replace(/ or /gi, ' oder ');
            textDe = textDe.replace(/on weekdays/gi, 'an Wochentagen');
            textDe = textDe.replace(/on a weekday/gi, 'an einem Wochentag');
            
            return textDe;
        }

        // English default formatting (already generated)
        return textEn;
    } catch (e) {
        console.error('Error formatting recurrence rule', e);
        return Array.isArray(ruleStr) ? ruleStr[0] : ruleStr;
    }
}
