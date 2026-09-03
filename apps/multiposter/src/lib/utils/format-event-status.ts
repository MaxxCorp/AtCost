import * as m from '$lib/paraglide/messages';

export function formatEventStatus(status: string | undefined | null): string {
	if (!status) return '';
	const s = status.toLowerCase();
	if (s === 'confirmed') return m.confirmed();
	if (s === 'cancelled' || s === 'canceled') return m.cancelled();
	if (s === 'tentative') return m.tentative();
	if (s === 'draft') return m.draft();
	return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getStatusBadgeClass(status: string | undefined | null): string {
	const s = status?.toLowerCase();
	if (s === 'cancelled' || s === 'canceled') {
		return 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60 shadow-xs';
	}
	if (s === 'confirmed') {
		return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs';
	}
	if (s === 'tentative') {
		return 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 shadow-xs';
	}
	if (s === 'draft') {
		return 'bg-slate-50 text-slate-700 border border-slate-200/80 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-700/60 shadow-xs';
	}
	return 'bg-gray-50 text-gray-700 border border-gray-200/80 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/60 shadow-xs';
}

export function getStatusDotClass(status: string | undefined | null): string {
	const s = status?.toLowerCase();
	if (s === 'cancelled' || s === 'canceled') return 'bg-rose-500';
	if (s === 'confirmed') return 'bg-emerald-500';
	if (s === 'tentative') return 'bg-amber-500 animate-pulse';
	if (s === 'draft') return 'bg-slate-400';
	return 'bg-gray-400';
}
