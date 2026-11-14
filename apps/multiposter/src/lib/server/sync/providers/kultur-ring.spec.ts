import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	KulturRingProvider,
	formatBerlinDate,
	formatBerlinTimeSlot,
	mapCategoryToKulturRing,
	parsePricingForKulturRing,
	parseSelectOptionsFromHtml,
	resolveEinrichtungId,
	truncateWithEllipsis
} from './kultur-ring';
import type { ExternalEvent, SyncConfig } from '../types';

const SAMPLE_CREATE_HTML = `
<!DOCTYPE html>
<html>
<body>
<form>
  <button id="btnspeichern" type="submit" formaction="https://db.kulturring.berlin/db/db.php?view=kulturkalender&tab=daten" name="speichern" value="speichern">Speichern</button>
  <input type="hidden" name="art" id="art" value="2">
  <select required id="einrichtung" name="einrichtung" class="form-select">
    <option value=""> </option>
    <option value="210">B&uuml;rgerhaus S&uuml;dspitze</option>
    <option value="219">Stadtteilzentrum Biesdorf</option>
  </select>
  <select required id="kategorie" name="kategorie">
    <option value=""> </option>
    <option value="9">Ausstellung</option>
    <option value="4">Interdisziplin&auml;r</option>
    <option value="14">Workshop</option>
  </select>
</form>
</body>
</html>
`;

const SAMPLE_EDIT_HTML = `
<!DOCTYPE html>
<html>
<body>
<form>
  <input type="hidden" name="mview" value="kulturkalender">
  <input type="hidden" name="mtab" value="daten">
  <input type="hidden" name="mid" value="11249">
  <input type="hidden" name="art" id="art" value="2">
  <select required id="einrichtung" name="einrichtung">
    <option value="210">B&uuml;rgerhaus S&uuml;dspitze</option>
    <option value="219" selected>Stadtteilzentrum Biesdorf</option>
  </select>
  <input type="text" name="beginn" value="19.11.2026">
  <input type="text" name="ende" value="">
  <select id="zeitVon" name="zeitVon"><option value="10.00" selected>10.00 Uhr</option></select>
  <select id="zeitBis" name="zeitBis"><option value="13.00" selected>13.00 Uhr</option></select>
  <input type="text" name="titel" id="titel" value="Test Workshop">
  <textarea name="text" id="text">Existing description</textarea>
  <input type="text" name="eintritt" id="eintritt" value="frei">
  <select required id="kategorie" name="kategorie">
    <option value="4">Interdisziplin&auml;r</option>
    <option value="14" selected>Workshop</option>
  </select>
  <input type="text" name="beginnVern" value="">
  <select id="zeitVern" name="zeitVern"><option value="" selected></option></select>
  <input type="text" name="laudatioVern" value="">
  <input type="text" name="musikVern" value="">
  <input type="text" name="beginnFin" value="">
  <select id="zeitFin" name="zeitFin"><option value="" selected></option></select>
  <input type="text" name="laudatioFin" value="">
  <input type="text" name="musikFin" value="">
</form>
</body>
</html>
`;

const SAMPLE_LIST_HTML = `
<div class="media media-einrichtung">
  <div class="media-body">
    <h5 class="mt-0">
      <a href="/db/db.php?view=kulturkalender&tab=daten&id=11249">Sehr langer Veranstaltungstitel der...</a>
    </h5>
    <p>Do 19.11.2026, 10.00-13.00 Uhr #Workshop</p>
  </div>
</div>
`;

const LOGIN_PAGE_HTML = `<form action="login.php" method="post"><input name="benutzername"><input name="passwort"></form>`;

function makeConfig(overrides: Partial<SyncConfig> = {}): SyncConfig {
	return {
		id: 'sync-kr-1',
		userId: 'user-1',
		providerId: 'kultur-ring',
		providerType: 'kultur-ring',
		direction: 'push',
		enabled: true,
		credentials: {
			username: 'Ball-EV-berlin.de',
			password: 'secret-password'
		},
		settings: {
			einrichtungId: '219'
		},
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	};
}

function makeEvent(overrides: Partial<ExternalEvent> = {}): ExternalEvent {
	return {
		externalId: '',
		providerId: 'kultur-ring',
		summary: 'Sehr langer Veranstaltungstitel der abgeschnitten werden muss',
		description: '<p>Hallo &amp; herzlich willkommen zu unserem <strong>Workshop</strong> im Kiez.</p>',
		startDateTime: new Date('2026-11-19T09:10:00.000Z'), // 10:10 CET -> rounds to 10.00
		endDateTime: new Date('2026-11-19T12:20:00.000Z'),   // 13:20 CET -> rounds to 13.30
		isAllDay: false,
		location: 'Stadtteilzentrum Biesdorf, Alt-Biesdorf 15',
		ticketPrice: 'free',
		tags: [{ id: 't1', name: 'Workshop' }],
		status: 'confirmed',
		...overrides
	};
}

describe('KulturRingProvider helpers', () => {
	it('formats Berlin dates accurately across UTC midnight boundaries', () => {
		// 23:30 UTC in winter is 00:30 next day in Europe/Berlin (CET = UTC+1)
		const date = new Date('2026-11-18T23:30:00.000Z');
		expect(formatBerlinDate(date)).toEqual({
			ddmmyyyy: '19.11.2026',
			yyyymm: '2026-11'
		});
	});

	it('snaps times to Kultur Ring 30-minute HH.MM slots and clamps within 07.00..23.30', () => {
		expect(formatBerlinTimeSlot(new Date('2026-11-19T09:10:00.000Z'))).toBe('10.00');
		expect(formatBerlinTimeSlot(new Date('2026-11-19T09:20:00.000Z'))).toBe('10.30');
		expect(formatBerlinTimeSlot(new Date('2026-11-19T04:00:00.000Z'))).toBe('07.00');
	});

	it('truncates title to <= 40 chars and description to <= 200 chars cleanly', () => {
		const longTitle = 'Sehr langer Veranstaltungstitel der abgeschnitten werden muss';
		const truncated = truncateWithEllipsis(longTitle, 40);
		expect(truncated.length).toBeLessThanOrEqual(40);
		expect(truncated.endsWith('...')).toBe(true);

		const longDesc = 'Wort '.repeat(60);
		const truncatedDesc = truncateWithEllipsis(longDesc, 200);
		expect(truncatedDesc.length).toBeLessThanOrEqual(200);
		expect(truncatedDesc.endsWith('...')).toBe(true);
	});

	it('maps ticket price, categories, and einrichtung options properly', () => {
		expect(parsePricingForKulturRing('free')).toBe('frei');
		expect(parsePricingForKulturRing('Eintritt: 8,50 €')).toBe('8,50 €');
		expect(parsePricingForKulturRing('Spende')).toBe('Spende erbeten');

		expect(mapCategoryToKulturRing(makeEvent({ metadata: { categoryBerlinDotDe: 'Ausstellung' } }))).toBe('9');
		expect(mapCategoryToKulturRing(makeEvent({ tags: [{ id: 't2', name: 'Filmvorführung' }] }))).toBe('1');
		expect(mapCategoryToKulturRing(makeEvent({ summary: 'Offener Abend', tags: [] }))).toBe('4');

		const options = parseSelectOptionsFromHtml(SAMPLE_CREATE_HTML, 'einrichtung');
		expect(options).toEqual([
			{ id: '210', name: 'Bürgerhaus Südspitze' },
			{ id: '219', name: 'Stadtteilzentrum Biesdorf' }
		]);
		expect(resolveEinrichtungId(makeEvent({ location: 'Bürgerhaus Südspitze' }), options, '219')).toBe('210');
		expect(resolveEinrichtungId(makeEvent({ location: 'Unknown Place' }), options, '219')).toBe('219');
	});
});

describe('KulturRingProvider CRUD lifecycle', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('validates connection by logging in and loading einrichtung options', async () => {
		const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
			if (url.endsWith('/login.php')) {
				return new Response('', {
					status: 302,
					headers: {
						'set-cookie': 'PHPSESSID=sess123; path=/',
						location: 'db.php?view=kulturkalender&tab=daten'
					}
				});
			}
			return new Response(SAMPLE_CREATE_HTML, { status: 200 });
		});
		vi.stubGlobal('fetch', fetchMock);

		const provider = new KulturRingProvider();
		await provider.initialize(makeConfig());
		const ok = await provider.validateConnection();

		expect(ok).toBe(true);
		const loginCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/login.php'));
		expect(loginCall).toBeDefined();
		expect(String(loginCall?.[1]?.body)).toContain('benutzername=Ball-EV-berlin.de');
	});

	it('returns false in validateConnection when login fails', async () => {
		const fetchMock = vi.fn(async () => new Response(LOGIN_PAGE_HTML, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const provider = new KulturRingProvider();
		await provider.initialize(makeConfig());
		expect(await provider.validateConnection()).toBe(false);
	});

	it('creates (pushEvent) and resolves ID from monthly list fallback', async () => {
		const submittedBodies: URLSearchParams[] = [];
		const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
			if (url.endsWith('/login.php')) {
				return new Response('', {
					status: 302,
					headers: {
						'set-cookie': 'PHPSESSID=sess123; path=/',
						location: 'db.php?view=kulturkalender&tab=daten'
					}
				});
			}
			if (url.includes('view=kulturkalender&tab=daten') && (!init?.method || init.method === 'GET')) {
				return new Response(SAMPLE_CREATE_HTML, { status: 200 });
			}
			if (url.includes('view=kulturkalender&tab=daten') && init?.method === 'POST') {
				submittedBodies.push(new URLSearchParams(String(init.body)));
				return new Response('', {
					status: 302,
					headers: { location: 'db.php?view=kulturkalender&datum=2026-11' }
				});
			}
			if (url.includes('view=kulturkalender&datum=2026-11')) {
				return new Response(SAMPLE_LIST_HTML, { status: 200 });
			}
			return new Response('', { status: 404 });
		});
		vi.stubGlobal('fetch', fetchMock);

		const provider = new KulturRingProvider();
		await provider.initialize(makeConfig());
		const event = makeEvent({
			summary: 'Sehr langer Veranstaltungstitel der...'
		});
		const res = await provider.pushEvent(event);

		expect(res).toEqual({ externalId: '11249' });
		expect(submittedBodies).toHaveLength(1);
		const body = submittedBodies[0];
		expect(body.get('art')).toBe('2');
		expect(body.get('speichern')).toBe('speichern');
		expect(body.get('einrichtung')).toBe('219');
		expect(body.get('beginn')).toBe('19.11.2026');
		expect(body.get('zeitVon')).toBe('10.00');
		expect(body.get('zeitBis')).toBe('13.30');
		expect(body.get('eintritt')).toBe('frei');
		expect(body.get('kategorie')).toBe('14');
		expect((body.get('titel') || '').length).toBeLessThanOrEqual(40);
		expect((body.get('text') || '').length).toBeLessThanOrEqual(200);
	});

	it('reads (readEvent) and updates (updateEvent) an existing event', async () => {
		let updateParams: URLSearchParams | undefined;
		const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
			if (url.endsWith('/login.php')) {
				return new Response('', {
					status: 302,
					headers: {
						'set-cookie': 'PHPSESSID=sess123; path=/',
						location: 'db.php?view=kulturkalender&tab=daten'
					}
				});
			}
			if (url.includes('tab=daten&id=11249') && init?.method === 'POST') {
				updateParams = new URLSearchParams(String(init.body));
				return new Response(SAMPLE_EDIT_HTML, { status: 200 });
			}
			if (url.includes('tab=daten&id=11249')) {
				return new Response(SAMPLE_EDIT_HTML, { status: 200 });
			}
			return new Response(SAMPLE_CREATE_HTML, { status: 200 });
		});
		vi.stubGlobal('fetch', fetchMock);

		const provider = new KulturRingProvider();
		await provider.initialize(makeConfig());

		const read = await provider.readEvent('11249');
		expect(read?.mid).toBe('11249');
		expect(read?.titel).toBe('Test Workshop');

		await provider.updateEvent('11249', makeEvent({ summary: 'Aktualisierter Workshop' }));
		expect(updateParams?.get('mid')).toBe('11249');
		expect(updateParams?.get('mview')).toBe('kulturkalender');
		expect(updateParams?.get('mtab')).toBe('daten');
		expect(updateParams?.get('titel')).toBe('Aktualisierter Workshop');
	});

	it('marks events as [ABGESAGT] on deleteEvent instead of crashing', async () => {
		let cancelParams: URLSearchParams | undefined;
		const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
			if (url.endsWith('/login.php')) {
				return new Response('', {
					status: 302,
					headers: {
						'set-cookie': 'PHPSESSID=sess123; path=/',
						location: 'db.php?view=kulturkalender&tab=daten'
					}
				});
			}
			if (url.includes('tab=daten&id=11249') && init?.method === 'POST') {
				cancelParams = new URLSearchParams(String(init.body));
				return new Response(SAMPLE_EDIT_HTML, { status: 200 });
			}
			if (url.includes('tab=daten&id=11249')) {
				return new Response(SAMPLE_EDIT_HTML, { status: 200 });
			}
			return new Response(SAMPLE_CREATE_HTML, { status: 200 });
		});
		vi.stubGlobal('fetch', fetchMock);

		const provider = new KulturRingProvider();
		await provider.initialize(makeConfig());
		await provider.deleteEvent('11249');

		expect(cancelParams?.get('titel')).toBe('[ABGESAGT] Test Workshop');
		expect(cancelParams?.get('beginn')).toBe('19.11.2026');
		expect(cancelParams?.get('speichern')).toBe('speichern');
	});

	it('filters out cancelled, tentative, and non-public events in shouldSyncEvent', async () => {
		const provider = new KulturRingProvider();
		await provider.initialize(makeConfig());

		expect(provider.shouldSyncEvent(makeEvent())).toBe(true);
		expect(provider.shouldSyncEvent(makeEvent({ status: 'cancelled' }))).toBe(false);
		expect(provider.shouldSyncEvent(makeEvent({ status: 'tentative' }))).toBe(false);
		expect(provider.shouldSyncEvent(makeEvent({ metadata: { isPublic: false } }))).toBe(false);
	});
});
