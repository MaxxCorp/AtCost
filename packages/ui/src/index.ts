// UI Components - re-export all component subdirectories
// Consuming apps import like: import { Button } from "@ac/ui/components/button";
// Or for sidebar: import * as Sidebar from "@ac/ui/components/sidebar";

// Utilities
export { cn, type WithoutChild, type WithoutChildren, type WithoutChildrenOrChild, type WithElementRef } from "./utils.js";

// Icons
export { ICONS, type IconDef } from "./icons.js";

// Components
export { default as EntityManager } from './components/EntityManager.svelte';
export { default as ContactManager } from './components/ContactManager.svelte';
export { default as AsyncButton } from './components/AsyncButton.svelte';
export { default as BulkActionToolbar } from './components/BulkActionToolbar.svelte';
export { default as LoadingSection } from './components/LoadingSection.svelte';
export { default as DashboardCard } from './components/DashboardCard.svelte';
export { default as ErrorSection } from './components/ErrorSection.svelte';
export { default as TagInput } from './components/TagInput.svelte';
export { default as EmptyState } from './components/EmptyState.svelte';
export { Button } from './components/button/index.js';
export { default as TalentTimeline } from './components/talents/TalentTimeline.svelte';
export { default as TimelineEntryDialog } from './components/talents/TimelineEntryDialog.svelte';
export { default as TalentForm } from './components/talents/TalentForm.svelte';
export { default as TalentsManager } from './components/talents/TalentsManager.svelte';
export { default as UserForm } from './components/users/UserForm.svelte';
export { default as ContactFields } from './components/forms/ContactFields.svelte';
export { default as LocationForm } from './components/forms/LocationForm.svelte';
export { IsMobile } from "./hooks/is-mobile.svelte.ts";
export { handleDelete } from "./hooks/handleDelete.svelte.ts";
