// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: typeof import("$lib/auth").auth.$Infer.Session.session | null;
			user: typeof import("$lib/auth").auth.$Infer.Session.user | null;
		}
		interface PageData {
			session: typeof import("$lib/auth").auth.$Infer.Session.session | null;
			user: typeof import("$lib/auth").auth.$Infer.Session.user | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export { };
