import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return new Response(JSON.stringify({ status: 'ok', message: 'API is working' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};
