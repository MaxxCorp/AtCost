import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, event, status, message }) => {
	console.error('[Client Error]:', error, 'status:', status, 'message:', message);
	return {
		message: message || (error instanceof Error ? error.message : 'Unknown error'),
		error: String(error)
	};
};
