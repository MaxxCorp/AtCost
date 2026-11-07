import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePosOpenApiSpec, posCorsHeaders } from '#lib/server/pos/openapi.js';

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: posCorsHeaders });
};

export const GET: RequestHandler = async ({ url }) => {
	const spec = generatePosOpenApiSpec(url.origin);
	return json(spec, { headers: posCorsHeaders });
};
