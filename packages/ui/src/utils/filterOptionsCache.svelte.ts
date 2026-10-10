import type { FilterGroup } from "../components/EntityManager.types.js";

// Reactive state mapping groupId -> Record<optionId, optionLabel>
export const optionLabelsCache = $state<Record<string, Record<string, string>>>({});

// Reactive state tracking loading state per groupId
export const loadingGroupsCache = $state<Record<string, boolean>>({});

// In-flight fetch promises to prevent redundant concurrent fetches
const inFlightFetches = new Map<string, Promise<any>>();

export function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeOption(
	item: any,
	group?: FilterGroup,
): { id: string; label: string; raw: any } {
	if (!item) return { id: "", label: "", raw: item };

	let id = "";
	if (group?.getOptionId) {
		try {
			id = String(group.getOptionId(item));
		} catch {
			id = String(item.id ?? item.value ?? item.name ?? "");
		}
	} else {
		id = String(item.id ?? item.value ?? item.name ?? "");
	}

	let label = "";
	if (group?.getOptionLabel) {
		try {
			const custom = group.getOptionLabel(item);
			if (custom) label = String(custom);
		} catch {
			// fallback
		}
	}

	if (!label) {
		label = String(
			item.label ??
			item.name ??
			item.title ??
			item.displayName ??
			item.contact?.displayName ??
			item.contact?.name ??
			item.user?.name ??
			item.fullName ??
			item.email ??
			item.value ??
			item.id ??
			"",
		);
	}

	return {
		id,
		label: label || id,
		raw: item,
	};
}

export function registerGroupOptions(
	groupId: string,
	options: Array<{ id: string; label: string }>,
) {
	if (!optionLabelsCache[groupId]) {
		optionLabelsCache[groupId] = {};
	}
	const current = optionLabelsCache[groupId];
	for (const opt of options) {
		if (opt.id) {
			current[opt.id] = opt.label;
		}
	}
}

export function getCachedOptionLabel(groupId: string, optionId: string): string | undefined {
	return optionLabelsCache[groupId]?.[optionId];
}

export function isGroupLoading(groupId: string): boolean {
	return !!loadingGroupsCache[groupId];
}

export async function loadOptionsForGroup(group: FilterGroup): Promise<void> {
	const remoteFn = group.optionsRemote || group.listRemote;
	if (!remoteFn) {
		// If static options are present, cache them
		if (group.options && Array.isArray(group.options)) {
			const normalized = group.options.map((opt: any) => normalizeOption(opt, group));
			registerGroupOptions(group.id, normalized);
		}
		return;
	}

	// Return if already fetching
	if (inFlightFetches.has(group.id)) {
		return inFlightFetches.get(group.id);
	}

	loadingGroupsCache[group.id] = true;

	const fetchPromise = (async () => {
		try {
			let res: any;
			try {
				res = await remoteFn({ limit: 500, sortField: "name", sortOrder: "asc" });
			} catch {
				try {
					res = await remoteFn({ limit: 500 });
				} catch {
					res = await remoteFn({});
				}
			}

			const raw = Array.isArray(res) ? res : (res?.data ?? []);
			const normalized = raw.map((item: any) => normalizeOption(item, group));
			registerGroupOptions(group.id, normalized);
		} catch (e) {
			console.error(`[filterOptionsCache] Failed to load options for group "${group.id}":`, e);
		} finally {
			loadingGroupsCache[group.id] = false;
			inFlightFetches.delete(group.id);
		}
	})();

	inFlightFetches.set(group.id, fetchPromise);
	return fetchPromise;
}
