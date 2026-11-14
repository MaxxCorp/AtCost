import { command, requested } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '@ac/db';
import {
	event,
	eventContact,
	eventLocation,
	eventResource,
	resource,
	locationContact,
	contact,
	contactEmail,
	contactPhone,
	eq,
	and,
	inArray,
	sql
} from '@ac/db';
import { eventSignUpSchema, lookupEventReservationSchema, cancelEventReservationSchema, normalizeEmail, phonesMatch } from '@ac/validations';
import { isSignUpClosed } from '#lib/utils/event-signup.js';
import { getOptionalUser, hasAccess } from '#lib/server/authorization.js';
import { findMatchingContacts } from '#lib/server/contact-matching.js';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';
import { applyEventParticipantsDelta } from '#lib/server/events/participants.js';
import { getContactHeadcount } from '#lib/utils/participants.js';
import { invalidateEvent, invalidateContact } from '#lib/server/cache/index.js';
import { readEvent } from './read.remote.js';
import { listEvents } from '../list.remote.js';
import { fetchEntityContacts } from '../../contacts/associate.remote.js';
import { listContacts } from '../../contacts/list.remote.js';

async function getEventLocationIds(client: any, targetEventId: string): Promise<string[]> {
	const directLocs = await client
		.select({ locationId: eventLocation.locationId })
		.from(eventLocation)
		.where(eq(eventLocation.eventId, targetEventId));

	const resourceLocs = await client
		.select({ locationId: resource.locationId })
		.from(eventResource)
		.innerJoin(resource, eq(eventResource.resourceId, resource.id))
		.where(eq(eventResource.eventId, targetEventId));

	return Array.from(
		new Set([
			...directLocs.map((l: any) => l.locationId).filter(Boolean),
			...resourceLocs.map((r: any) => r.locationId).filter(Boolean)
		])
	);
}

async function refreshEventAndContactQueries(eventId: string, targetEventId: string) {
	await invalidateEvent(eventId);
	if (targetEventId !== eventId) {
		await invalidateEvent(targetEventId);
	}
	void readEvent(eventId).refresh();
	if (targetEventId !== eventId) {
		void readEvent(targetEventId).refresh();
	}
	try {
		await requested(fetchEntityContacts, 20).refreshAll();
	} catch { /* ignore */ }
	void fetchEntityContacts({ type: 'event', entityId: eventId }).refresh();
	if (targetEventId !== eventId) {
		void fetchEntityContacts({ type: 'event', entityId: targetEventId }).refresh();
	}
	try {
		await requested(listContacts, 20).refreshAll();
	} catch { /* ignore */ }
	void listContacts().refresh();
	void listContacts({}).refresh();
	try {
		await requested(listEvents, 20).refreshAll();
	} catch { /* ignore */ }
	void listEvents().refresh();
	void listEvents({}).refresh();
}

async function loadTargetEvent(eventId: string, materializeIfVirtual: boolean) {
	const user = getOptionalUser();
	const isAuthorized = Boolean(user && hasAccess(user, 'events'));

	const targetEventId = eventId.includes('_inst_')
		? await resolveEventIdForAssociations(eventId, {
				materializeIfVirtual,
				userId: user?.id
			})
		: eventId;

	const [evt] = await db.select().from(event).where(eq(event.id, targetEventId));
	if (!evt) {
		error(404, 'Event not found');
	}
	if (!evt.isPublic && !isAuthorized) {
		error(403, 'You do not have permission to access this event');
	}
	return { evt, targetEventId };
}

export const submitEventSignUp = command(eventSignUpSchema, async (data) => {
	const { evt, targetEventId } = await loadTargetEvent(data.eventId, true);

	if (evt.signUpMode === 'off') {
		error(400, 'Sign-ups are not enabled for this event');
	}
	if (isSignUpClosed(evt.signUpMode, evt.signUpClosureDate)) {
		error(400, 'Sign-up for this event has closed');
	}

	const cleanEmails = Array.from(
		new Set((data.emails ?? []).map((e) => e.trim()).filter((e) => e.length > 0))
	);
	const cleanPhones = Array.from(
		new Set((data.phones ?? []).map((p) => p.trim()).filter((p) => p.length > 0))
	);
	const partySize = Math.max(1, Math.trunc(data.partySize ?? 1));
	const notifyOnChanges = Boolean(data.notifyOnChanges);
	const subscribeLocationNewsletter = Boolean(data.subscribeLocationNewsletter);

	const givenName = data.givenName.trim();
	const familyName = data.familyName.trim();
	const generatedDisplayName = `${givenName} ${familyName}`.trim();

	// Duplicate prevention: check existing contacts by email and normalized phone
	const matches = await findMatchingContacts({
		emails: cleanEmails,
		phones: cleanPhones
	});

	let targetContactId: string | null = null;
	if (data.existingContactId) {
		const confirmedMatch = matches.find((m) => m.id === data.existingContactId);
		if (confirmedMatch) {
			targetContactId = confirmedMatch.id;
		} else {
			// Verify existingContactId is already linked to this event if user cleared/changed all contact info
			const [existingAssoc] = await db
				.select()
				.from(eventContact)
				.where(
					and(
						eq(eventContact.eventId, targetEventId),
						eq(eventContact.contactId, data.existingContactId)
					)
				);
			if (existingAssoc) {
				targetContactId = data.existingContactId;
			}
		}
	}
	if (!targetContactId && matches.length > 0) {
		const matchedIds = matches.map((m) => m.id);
		const [existingEventMatch] = await db
			.select({ contactId: eventContact.contactId })
			.from(eventContact)
			.where(
				and(
					eq(eventContact.eventId, targetEventId),
					inArray(eventContact.contactId, matchedIds)
				)
			);
		targetContactId = existingEventMatch?.contactId ?? matches[0].id;
	}

	const result = await db.transaction(async (tx) => {
		if (targetContactId) {
			const existingContact = await tx.query.contact.findFirst({
				where: eq(contact.id, targetContactId),
				with: { emails: true, phones: true }
			});

			if (existingContact) {
				// Update name fields if missing or if updating own reservation
				await tx
					.update(contact)
					.set({
						givenName: givenName || existingContact.givenName,
						familyName: familyName || existingContact.familyName,
						displayName: existingContact.displayName || generatedDisplayName,
						notifyOnChanges: Boolean(notifyOnChanges),
						updatedAt: new Date()
					})
					.where(eq(contact.id, targetContactId));

				// Merge any new emails not already present
				const existingEmailSet = new Set(
					existingContact.emails.map((e) => normalizeEmail(e.value))
				);
				const newEmails = cleanEmails.filter(
					(e) => !existingEmailSet.has(normalizeEmail(e))
				);
				if (newEmails.length > 0) {
					await tx.insert(contactEmail).values(
						newEmails.map((val, idx) => ({
							contactId: targetContactId!,
							value: val,
							type: 'home',
							primary: existingContact.emails.length === 0 && idx === 0
						}))
					);
				}

				// Merge any new phones not already matching existing phones
				const newPhones = cleanPhones.filter(
					(p) => !existingContact.phones.some((ep) => phonesMatch(ep.value, p))
				);
				if (newPhones.length > 0) {
					await tx.insert(contactPhone).values(
						newPhones.map((val, idx) => ({
							contactId: targetContactId!,
							value: val,
							type: 'mobile',
							primary: existingContact.phones.length === 0 && idx === 0
						}))
					);
				}
			}
		} else {
			const [newContact] = await tx
				.insert(contact)
				.values({
					userId: evt.userId,
					displayName: generatedDisplayName,
					givenName,
					familyName,
					isPublic: false,
					notifyOnChanges: Boolean(notifyOnChanges)
				})
				.returning({ id: contact.id });

			targetContactId = newContact.id;

			if (cleanEmails.length > 0) {
				await tx.insert(contactEmail).values(
					cleanEmails.map((val, idx) => ({
						contactId: targetContactId!,
						value: val,
						type: 'home',
						primary: idx === 0
					}))
				);
			}

			if (cleanPhones.length > 0) {
				await tx.insert(contactPhone).values(
					cleanPhones.map((val, idx) => ({
						contactId: targetContactId!,
						value: val,
						type: 'mobile',
						primary: idx === 0
					}))
				);
			}
		}

		// Upsert eventContact link with partySize, notifyOnChanges, and newsletterSubscribed
		const [existingAssoc] = await tx
			.select()
			.from(eventContact)
			.where(
				and(
					eq(eventContact.eventId, targetEventId),
					eq(eventContact.contactId, targetContactId!)
				)
			);

		let partyDelta = 0;
		const isUpdate = Boolean(existingAssoc);
		if (existingAssoc) {
			const previousCounted = getContactHeadcount(existingAssoc);
			partyDelta = partySize - previousCounted;
			await tx
				.update(eventContact)
				.set({
					participationStatus: 'accepted',
					partySize,
					notifyOnChanges,
					newsletterSubscribed: subscribeLocationNewsletter
				})
				.where(
					and(
						eq(eventContact.eventId, targetEventId),
						eq(eventContact.contactId, targetContactId!)
					)
				);
		} else {
			partyDelta = partySize;
			await tx.insert(eventContact).values({
				eventId: targetEventId,
				contactId: targetContactId!,
				participationStatus: 'accepted',
				partySize,
				notifyOnChanges,
				newsletterSubscribed: subscribeLocationNewsletter
			});
		}

		if (partyDelta !== 0) {
			await applyEventParticipantsDelta(tx, targetEventId, partyDelta);
		}

		// Location newsletter subscription (covers direct event locations + resource locations)
		const locIds = await getEventLocationIds(tx, targetEventId);

		for (const locationId of locIds) {
			const [existingLocAssoc] = await tx
				.select()
				.from(locationContact)
				.where(
					and(
						eq(locationContact.locationId, locationId),
						eq(locationContact.contactId, targetContactId!)
					)
				);

			if (existingLocAssoc) {
				await tx
					.update(locationContact)
					.set({ newsletterSubscribed: subscribeLocationNewsletter })
					.where(
						and(
							eq(locationContact.locationId, locationId),
							eq(locationContact.contactId, targetContactId!)
						)
					);
			} else if (subscribeLocationNewsletter) {
				await tx.insert(locationContact).values({
					locationId,
					contactId: targetContactId!,
					newsletterSubscribed: true
				});
			}
		}

		return {
			contactId: targetContactId!,
			isUpdate,
			matchedExistingContact: matches.length > 0
		};
	});

	await invalidateContact(result.contactId);
	await refreshEventAndContactQueries(data.eventId, targetEventId);

	return {
		success: true,
		contactId: result.contactId,
		isUpdate: result.isUpdate,
		matchedExistingContact: result.matchedExistingContact,
		partySize
	};
});

export const lookupEventReservation = command(lookupEventReservationSchema, async (data) => {
	const { targetEventId } = await loadTargetEvent(data.eventId, false);

	const matches = await findMatchingContacts({
		emails: data.email ? [data.email] : [],
		phones: data.phone ? [data.phone] : []
	});

	if (matches.length === 0) {
		return { found: false as const };
	}

	const matchedIds = matches.map((m) => m.id);
	const assocs = await db
		.select()
		.from(eventContact)
		.where(
			and(
				eq(eventContact.eventId, targetEventId),
				inArray(eventContact.contactId, matchedIds)
			)
		);

	if (assocs.length === 0) {
		return { found: false as const };
	}

	const assoc = assocs[0];
	const matchedContact = matches.find((m) => m.id === assoc.contactId);
	if (!matchedContact) {
		return { found: false as const };
	}

	// Check location newsletter status (eventContact flag or locationContact rows)
	const locIds = await getEventLocationIds(db, targetEventId);

	let subscribeLocationNewsletter = Boolean(assoc.newsletterSubscribed);
	if (!subscribeLocationNewsletter && locIds.length > 0) {
		const locAssocs = await db
			.select()
			.from(locationContact)
			.where(
				and(
					eq(locationContact.contactId, matchedContact.id),
					inArray(locationContact.locationId, locIds)
				)
			);
		subscribeLocationNewsletter = locAssocs.some((la) => la.newsletterSubscribed);
	}

	return {
		found: true as const,
		reservation: {
			contactId: matchedContact.id,
			givenName: matchedContact.givenName ?? '',
			familyName: matchedContact.familyName ?? '',
			emails: matchedContact.emails.map((e) => e.value),
			phones: matchedContact.phones.map((p) => p.value),
			partySize: assoc.partySize ?? 1,
			notifyOnChanges: Boolean(assoc.notifyOnChanges),
			subscribeLocationNewsletter,
			participationStatus: assoc.participationStatus
		}
	};
});

export const cancelEventReservation = command(cancelEventReservationSchema, async (data) => {
	const { targetEventId } = await loadTargetEvent(data.eventId, true);

	const matches = await findMatchingContacts({
		emails: data.email ? [data.email] : [],
		phones: data.phone ? [data.phone] : []
	});

	const verified = matches.some((m) => m.id === data.contactId);
	if (!verified) {
		error(403, 'Could not verify your reservation with the provided contact details');
	}

	await db.transaction(async (tx) => {
		const [existingAssoc] = await tx
			.select()
			.from(eventContact)
			.where(
				and(
					eq(eventContact.eventId, targetEventId),
					eq(eventContact.contactId, data.contactId)
				)
			);

		if (!existingAssoc) {
			return;
		}

		const removedCount = getContactHeadcount(existingAssoc);

		await tx
			.delete(eventContact)
			.where(
				and(
					eq(eventContact.eventId, targetEventId),
					eq(eventContact.contactId, data.contactId)
				)
			);

		if (removedCount > 0) {
			await applyEventParticipantsDelta(tx, targetEventId, -removedCount);
		}
	});

	await invalidateContact(data.contactId);
	await refreshEventAndContactQueries(data.eventId, targetEventId);

	return { success: true };
});
