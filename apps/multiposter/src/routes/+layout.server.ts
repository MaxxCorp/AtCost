export const config = { split: false };

export const load = async ({ locals }) => {
	return {
		user: locals.user ?? null,
		session: locals.session ?? null
	};
};
