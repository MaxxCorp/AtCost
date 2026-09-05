import { RRule } from "rrule";
import ENGLISH from "rrule/dist/esm/nlp/i18n.js";
import * as m from "$lib/paraglide/messages";
import { getLocale } from "$lib/paraglide/runtime";

export interface FormatRecurrenceOptions {
    omitLength?: boolean;
}

export function formatRecurrenceText(
    ruleStr: string | string[] | null | undefined,
    localeOverride?: string,
    options?: FormatRecurrenceOptions | boolean
): string {
    if (!ruleStr) return m.recurrence();
    
    const omitLength = options === true || (typeof options === 'object' && Boolean(options?.omitLength));

    // Extract string if it's an array
    let cleanRule = Array.isArray(ruleStr) ? ruleStr[0] : ruleStr;
    if (!cleanRule) return m.recurrence();

    try {
        if (!cleanRule.startsWith('RRULE:')) {
            cleanRule = 'RRULE:' + cleanRule;
        }

        // Generate English string first
        let textEn = RRule.fromString(cleanRule).toText();

        if (omitLength) {
            textEn = textEn.replace(/,?\s+until\s+.*$/i, '').trim();
            textEn = textEn.replace(/,?\s+for\s+\d+\s+times?$/i, '').trim();
        }

        if (cleanRule.includes('BYSETPOS=')) {
            const setposMatch = cleanRule.match(/BYSETPOS=(-?\d+)/);
            if (setposMatch) {
                const pos = parseInt(setposMatch[1], 10);
                const posStr = pos === 1 ? '1st' : pos === 2 ? '2nd' : pos === 3 ? '3rd' : pos === 4 ? '4th' : pos === -1 ? 'last' : `${pos}th`;
                
                if (textEn.includes('Monday, Tuesday, Wednesday, Thursday, Friday')) {
                    textEn = textEn.replace(/on Monday, Tuesday, Wednesday, Thursday, Friday/gi, `on the ${posStr} weekday`);
                    textEn = textEn.replace(/Monday, Tuesday, Wednesday, Thursday, Friday/gi, `${posStr} weekday`);
                } else if (textEn.includes('Saturday, Sunday')) {
                    textEn = textEn.replace(/on Saturday, Sunday/gi, `on the ${posStr} weekend day`);
                    textEn = textEn.replace(/Saturday, Sunday/gi, `${posStr} weekend day`);
                } else if (textEn.includes('Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday')) {
                    textEn = textEn.replace(/on Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday/gi, `on the ${posStr} day`);
                } else if (!/1st|2nd|3rd|4th|last/i.test(textEn)) {
                    textEn = textEn.replace(/on (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi, `on the ${posStr} $1`);
                }
            }
        }

        const currentLocale = localeOverride || getLocale();
        if (currentLocale === 'de') {
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

            // Ordinals and relative terms
            textDe = textDe.replace(/on the last/gi, 'am letzten');
            textDe = textDe.replace(/on the (\d+)(st|nd|rd|th)/gi, 'am $1.');

            textDe = textDe.replace(/weekend days/gi, 'Wochenendtagen');
            textDe = textDe.replace(/weekend day/gi, 'Wochenendtag');
            textDe = textDe.replace(/on weekdays/gi, 'an Wochentagen');
            textDe = textDe.replace(/on a weekday/gi, 'an einem Wochentag');
            textDe = textDe.replace(/weekdays/gi, 'Wochentagen');
            textDe = textDe.replace(/weekday/gi, 'Wochentag');
            textDe = textDe.replace(/(am (?:letzten|\d+\.))\s+day\b/gi, '$1 Tag');

            // Structural words
            textDe = textDe.replace(/ until /gi, ' bis ');
            textDe = textDe.replace(/ for (\d+) times/gi, ' $1 mal');
            textDe = textDe.replace(/ for 1 time/gi, ' einmal');
            textDe = textDe.replace(/ and /gi, ' und ');
            textDe = textDe.replace(/ or /gi, ' oder ');

            if (omitLength) {
                textDe = textDe.replace(/,?\s+bis\s+(?:zum\s+)?.*$/i, '').trim();
                textDe = textDe.replace(/,?\s+\d+\s*mal.*$/i, '').trim();
                textDe = textDe.replace(/,?\s+einmal.*$/i, '').trim();
            }
            
            return textDe;
        }

        // English default formatting (already generated)
        return textEn;
    } catch (e) {
        console.error('Error formatting recurrence rule', e);
        let fallback = Array.isArray(ruleStr) ? ruleStr[0] : ruleStr;
        if (typeof fallback === 'string' && omitLength) {
            fallback = fallback.replace(/,?\s+(?:until|bis(?:\s+zum)?)\s+.*$/i, '').trim();
            fallback = fallback.replace(/,?\s+(?:for\s+\d+\s+times?|\d+\s*mal).*$/i, '').trim();
        }
        return fallback;
    }
}
