import { describe, it, expect } from 'vitest';
import {
	DEFAULT_SYNC_PREFERRED_LANGUAGE,
	SYNC_PROVIDER_CAPABILITIES,
	providerSupportsHtmlDescription,
	resolveSyncLanguage,
	normalizeSyncLocale,
	getLocalizedSyncSignUpLabels,
	buildEventSignUpUrl,
	buildSyncSignUpPrompt,
	prependSignUpPromptToDescription,
	formatProviderDescription,
	sanitizeEmailDescriptionHtml
} from './signup';
import type { ProviderType } from '../types';

const deLabels = {
	recommended: 'Anmeldung empfohlen',
	req: 'Anmeldung erforderlich',
	reqContact: (contact: string) => `Anmeldung über ${contact}`,
	by: (date: string) => `Anmeldung bis ${date}`,
	viaContact: (contact: string) => ` über ${contact}`,
	closed: 'Anmeldung geschlossen',
	linkKeyword: 'Anmeldung'
};

const enLabels = {
	recommended: 'Sign up recommended',
	req: 'Sign up required',
	reqContact: (contact: string) => `Sign up via ${contact}`,
	by: (date: string) => `Sign up by ${date}`,
	viaContact: (contact: string) => ` via ${contact}`,
	closed: 'Sign up closed',
	linkKeyword: 'Sign up'
};

describe('sync signup utilities', () => {
	describe('language resolution & localization infrastructure', () => {
		it('defaults to German (de) hardcoded in the sync layer', () => {
			expect(DEFAULT_SYNC_PREFERRED_LANGUAGE).toBe('de');
			expect(resolveSyncLanguage(undefined, null, '  ')).toBe('de');
			expect(resolveSyncLanguage('en-US', 'de')).toBe('en-US');
			expect(normalizeSyncLocale('de-DE')).toBe('de');
			expect(normalizeSyncLocale('en-GB')).toBe('en');
			expect(normalizeSyncLocale(undefined)).toBe('de');
		});

		it('resolves Paraglide labels explicitly for German and English without relying on cookie locale', () => {
			const de = getLocalizedSyncSignUpLabels('de-DE');
			expect(de.recommended).toBe('Anmeldung empfohlen');
			expect(de.linkKeyword).toBe('Anmeldung');

			const en = getLocalizedSyncSignUpLabels('en-US');
			expect(en.recommended).toBe('Sign up recommended');
			expect(en.linkKeyword).toBe('Sign up');
		});
	});

	describe('providerSupportsHtmlDescription', () => {
		it('classifies HTML-capable sync providers', () => {
			const htmlProviders: ProviderType[] = [
				'google-calendar',
				'microsoft-calendar',
				'wp-the-events-calendar',
				'eventbrite',
				'meetup',
				'bewegungsatlas-berlin',
				'email',
				'webhook',
				'custom'
			];
			for (const p of htmlProviders) {
				expect(providerSupportsHtmlDescription(p)).toBe(true);
				expect(SYNC_PROVIDER_CAPABILITIES[p].supportsHtmlDescription).toBe(true);
			}
		});

		it('classifies plain-text sync providers', () => {
			const plainProviders: ProviderType[] = [
				'berlin-de-main-calendar',
				'berlin-de-mh-calendar',
				'seniorennetz-berlin',
				'nebenan-de',
				'kultur-ring',
				'instagram'
			];
			for (const p of plainProviders) {
				expect(providerSupportsHtmlDescription(p)).toBe(false);
				expect(SYNC_PROVIDER_CAPABILITIES[p].supportsHtmlDescription).toBe(false);
			}
		});
	});

	describe('buildEventSignUpUrl', () => {
		it('builds canonical event sign-up URL with signup=true', () => {
			expect(buildEventSignUpUrl('https://events.example.org/', 'evt-123')).toBe(
				'https://events.example.org/events/evt-123/view?signup=true'
			);
		});

		it('encodes virtual instance IDs safely', () => {
			expect(
				buildEventSignUpUrl('https://events.example.org', 'evt-1_inst_2026-12-12T10:00:00Z')
			).toBe(
				'https://events.example.org/events/evt-1_inst_2026-12-12T10%3A00%3A00Z/view?signup=true'
			);
		});
	});

	describe('buildSyncSignUpPrompt', () => {
		it('returns null when signUpMode is off or unset', () => {
			expect(
				buildSyncSignUpPrompt(
					{ signUpMode: 'off' },
					{ signUpUrl: 'https://example.org/events/1/view?signup=true', labels: deLabels }
				)
			).toBeNull();
			expect(
				buildSyncSignUpPrompt(
					{ signUpMode: null },
					{ signUpUrl: 'https://example.org/events/1/view?signup=true', labels: deLabels }
				)
			).toBeNull();
		});

		it('links keyword for recommended mode in German and English', () => {
			const de = buildSyncSignUpPrompt(
				{ signUpMode: 'recommended' },
				{
					signUpUrl: 'https://example.org/events/1/view?signup=true',
					locale: 'de',
					labels: deLabels
				}
			);
			expect(de).toEqual({
				text: 'Anmeldung empfohlen',
				html: '<p><a href="https://example.org/events/1/view?signup=true">Anmeldung</a> empfohlen</p>'
			});

			const en = buildSyncSignUpPrompt(
				{ signUpMode: 'recommended' },
				{
					signUpUrl: 'https://example.org/events/1/view?signup=true',
					locale: 'en',
					labels: enLabels
				}
			);
			expect(en).toEqual({
				text: 'Sign up recommended',
				html: '<p><a href="https://example.org/events/1/view?signup=true">Sign up</a> recommended</p>'
			});
		});

		it('formats required mode with closure date (omitting default 23:59) and contact phone without QR phrasing', () => {
			const res = buildSyncSignUpPrompt(
				{
					signUpMode: 'required',
					signUpClosureDate: '2099-12-12T22:59:00.000Z',
					resolvedSignUpContact: { phone: '+49(0)305405659' }
				},
				{
					signUpUrl: 'https://example.org/events/1/view?signup=true',
					locale: 'de',
					timeZone: 'Europe/Berlin',
					labels: deLabels
				}
			);
			expect(res).toEqual({
				text: 'Anmeldung bis 12.12.99 über +49(0)305405659',
				html: '<p><a href="https://example.org/events/1/view?signup=true">Anmeldung</a> bis 12.12.99 über +49(0)305405659</p>'
			});
			expect(res?.text).not.toContain('QR');
		});

		it('includes closing time when it differs from default 23:59', () => {
			const res = buildSyncSignUpPrompt(
				{
					signUpMode: 'required',
					signUpClosureDate: '2099-12-12T11:00:00.000Z',
					resolvedSignUpContact: { email: 'anmeldung@example.org' }
				},
				{
					signUpUrl: 'https://example.org/events/1/view?signup=true',
					locale: 'de',
					timeZone: 'Europe/Berlin',
					labels: deLabels
				}
			);
			expect(res?.text).toBe('Anmeldung bis 12.12.99 12:00 über anmeldung@example.org');
			expect(res?.html).toBe(
				'<p><a href="https://example.org/events/1/view?signup=true">Anmeldung</a> bis 12.12.99 12:00 über anmeldung@example.org</p>'
			);
		});

		it('formats recurring series closure deadline using signUpRecurrence', () => {
			const res = buildSyncSignUpPrompt(
				{
					signUpMode: 'required',
					signUpClosureDate: '2099-11-16T11:00:00.000Z',
					signUpRecurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
					resolvedSignUpContact: { phone: '+4930123456' }
				},
				{
					signUpUrl: 'https://example.org/events/series-1/view?signup=true',
					locale: 'en',
					timeZone: 'Europe/Berlin',
					isRecurringSeries: true,
					labels: enLabels
				}
			);
			expect(res?.text).toContain('Sign up by ');
			expect(res?.text).toContain('12:00');
			expect(res?.text).toContain(' via +4930123456');
			expect(res?.html).toContain(
				'<a href="https://example.org/events/series-1/view?signup=true">Sign up</a> by '
			);
		});

		it('escapes HTML characters in sign-up URL and contact string', () => {
			const res = buildSyncSignUpPrompt(
				{
					signUpMode: 'required',
					resolvedSignUpContact: { email: 'test+<tag>@example.org' }
				},
				{
					signUpUrl: 'https://example.org/events/1/view?signup=true&foo="bar"',
					locale: 'de',
					labels: deLabels
				}
			);
			expect(res?.html).toBe(
				'<p><a href="https://example.org/events/1/view?signup=true&amp;foo=&quot;bar&quot;">Anmeldung</a> über test+&lt;tag&gt;@example.org</p>'
			);
		});
	});

	describe('prependSignUpPromptToDescription', () => {
		const prompt = {
			text: 'Anmeldung empfohlen',
			html: '<p><a href="https://example.org/events/1/view?signup=true">Anmeldung</a> empfohlen</p>'
		};

		it('prepends a separate <p> paragraph when HTML is supported', () => {
			expect(prependSignUpPromptToDescription('<p>Event details</p>', prompt, true)).toBe(
				'<p><a href="https://example.org/events/1/view?signup=true">Anmeldung</a> empfohlen</p><p>Event details</p>'
			);
			expect(prependSignUpPromptToDescription(undefined, prompt, true)).toBe(prompt.html);
		});

		it('prepends a separate blank-line paragraph when only plain text is supported', () => {
			expect(prependSignUpPromptToDescription('Event details', prompt, false)).toBe(
				'Anmeldung empfohlen\n\nEvent details'
			);
			expect(prependSignUpPromptToDescription('', prompt, false)).toBe('Anmeldung empfohlen');
		});
	});

	describe('formatProviderDescription', () => {
		const eventWithSignUp = {
			description: '<p>Weekly meetup details.</p>',
			preferredLanguage: 'en',
			startTimeZone: 'Europe/Berlin',
			signUp: {
				mode: 'required' as const,
				closureDate: '2099-12-12T11:00:00.000Z',
				signUpUrl: 'https://events.example.org/events/evt-1/view?signup=true',
				contact: { phone: '+49305405659' }
			}
		};

		it('translates prompt to event preferredLanguage on multi-language HTML providers', () => {
			const res = formatProviderDescription(eventWithSignUp, { supportsHtml: true });
			expect(res).toBe(
				'<p><a href="https://events.example.org/events/evt-1/view?signup=true">Sign up</a> by 12/12/99 12:00 PM via +49305405659</p><p>Weekly meetup details.</p>'
			);
		});

		it('enforces single-language provider defaultLanguage over event.preferredLanguage', () => {
			const res = formatProviderDescription(eventWithSignUp, {
				supportsHtml: false,
				defaultLanguage: 'de'
			});
			expect(res).toBe(
				'Anmeldung bis 12.12.99 12:00 über +49305405659\n\n<p>Weekly meetup details.</p>'
			);
		});

		it('skips sign-up prompt generation when provider handles sign-ups natively via API', () => {
			const res = formatProviderDescription(eventWithSignUp, {
				supportsHtml: true,
				skipSignUpPrompt: true
			});
			expect(res).toBe('<p>Weekly meetup details.</p>');
		});
	});

	describe('sanitizeEmailDescriptionHtml', () => {
		it('preserves safe links and paragraphs while stripping script and event handlers', () => {
			const dirty =
				'<p><a href="https://example.org/events/1/view?signup=true" onclick="alert(1)">Anmeldung</a> empfohlen</p><script>bad()</script><p>Body <a href="javascript:evil()">bad</a></p>';
			const clean = sanitizeEmailDescriptionHtml(dirty);
			expect(clean).toContain('<p><a href="https://example.org/events/1/view?signup=true">Anmeldung</a> empfohlen</p>');
			expect(clean).not.toContain('<script');
			expect(clean).not.toContain('onclick');
			expect(clean).not.toContain('javascript:');
		});

		it('escapes plain-text descriptions safely', () => {
			expect(sanitizeEmailDescriptionHtml('A < B & C\nNext line')).toBe('A &lt; B &amp; C\nNext line');
		});
	});
});
