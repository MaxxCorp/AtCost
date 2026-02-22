import * as v from 'valibot';
import { form } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { campaign } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Campaign } from '$lib/server/db/schema';
import { readCampaign } from './read.remote';
import { listCampaigns } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateCampaignSchema } from '$lib/validations/campaigns';

export const updateCampaign = form(updateCampaignSchema, async (data) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'campaigns');

	// Get current campaign
	const current = await readCampaign(data.id);
	if (!current) {
		error(404, 'Campaign not found');
	}

	const name = data.name ?? current.name;
	const content = data.content ?
		(typeof data.content === 'string' ? JSON.parse(data.content) : data.content) :
		current.content;

	const result = await db
		.update(campaign)
		.set({
			name,
			content,
			updatedAt: new Date(),
		})
		.where(eq(campaign.id, data.id))
		.returning();

	const updated = result[0];
	if (!updated) {
		error(500, 'Failed to update campaign');
	}

	const updatedCampaign = {
		...updated,
		createdAt: updated.createdAt.toISOString(),
		updatedAt: updated.updatedAt.toISOString()
	};

	// Update both queries
	// @ts-ignore - The type mismatch between DbCampaign and the remote query's Campaign type
	await readCampaign(data.id).set(updatedCampaign);
	await listCampaigns().refresh();

	return { updatedCampaign, success: true };
});

