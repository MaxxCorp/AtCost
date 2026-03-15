// UI Components - re-export all component subdirectories
// Consuming apps import like: import { Button } from "@ac/ui/components/button";
// Or for sidebar: import * as Sidebar from "@ac/ui/components/sidebar";

// Utilities
export { cn, type WithoutChild, type WithoutChildren, type WithoutChildrenOrChild, type WithElementRef } from "./utils.js";

// Icons
export { ICONS, type IconDef } from "./icons.js";

// Hooks
export { default as EntityManager } from './components/EntityManager.svelte';
export { default as ContactManager } from './components/ContactManager.svelte';
export { default as TalentTimeline } from './components/talents/TalentTimeline.svelte';
export { default as TimelineEntryDialog } from './components/talents/TimelineEntryDialog.svelte';
export { IsMobile } from "./hooks/is-mobile.svelte.js";
