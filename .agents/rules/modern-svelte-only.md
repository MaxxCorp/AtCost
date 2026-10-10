---
trigger: always_on
---

# AI Agent Instructions: SvelteKit Architecture

- **SvelteKit Remote Functions Exclusivity**: ALL SvelteKit applications in this repository MUST exclusively use SvelteKit Remote Functions (`$app/server` exports `query`, `form`, `command` and `prerender`) and their native form binding syntax as described in https://svelte.dev/docs/kit/remote-functions. Do NOT try any other ways to do remote functions either.
- **No Legacy Patterns**: SvelteKit `load` functions and `actions` (in `+*.server.ts` or `+*.ts`) are strictly PROHIBITED. All data fetching must occur via Remote Functions (`query`/`form`) or established client-side state providers.
  - **Note**: Static configuration exports (e.g., `export const ssr = false;`) are permitted in `+layout.ts` or `+page.ts` if required for project-level settings.
- **No REST Endpoints for Data Fetching**: Standard API routes (`+server.ts` GET/POST/etc.) are superseded for internal data fetching/mutation and should NOT be used unless explicitly interacting with a non-SvelteKit external client.
- **Strict Fields API**: 
  - DO NOT assume you know how to work with sveltekit fields values, do consult the full length of the forms block in the documentation https://svelte.dev/docs/kit/remote-functions#form EVERY time
  - DO NOT manually create HTML `<input type="hidden">` tags for form submissions.
  - DO wrap hidden fields that have a chance to empty in {#if ...} blocks to prevent the svelte static analyzer to throw an error
  - DO NOT use proxy helper functions (like a custom `getField` utility) to work around `fields` typings. Fix the underlying typing issues.
- **Enhance & Preflight Pattern**: Always use `{...remoteForm.preflight(schema).enhance(async ({ submit }) => { ... })}` to bind forms and enable client-side validation.
  - **Client-Side Validation**: Reuse the remote validation schemas for `preflight()`. This prevents network requests when the form is locally invalid.
  - **Per-Field Feedback**: ALWAYS display field-specific validation errors using `{#each rf.fields.fieldName.issues() as issue}<p>{issue.message}</p>{/each}`.
  - **Validation Toast**: Add an `$effect` to trigger a global `toast.error(m.please_fix_validation())` when validation issues are detected. Use a transition check (e.g., tracking `prevIssuesLength`) to avoid spamming toasts on every keystroke.
- **Server-Side Data Synchronization**: In `create`, `update`, or `delete` Remote Functions, you MUST use `.refresh()` or `.set()` on related Remote Functions to keep client-side data in sync.
  - This is a server-side instruction for "single-flight mutations" where the server tells the client which queries to invalidate or update in the same response.
  - DO NOT call other remote functions directly; only use the specialized mutation instructions (`.refresh()`, `.set()`).
  - Example: `void listEvents().refresh();` or `readEvent(updatedEvent.id).set(updatedEvent);`.
  - **Argument Consistency**: SvelteKit serializes query arguments to form cache keys. If a client calls `listItems()` (argument `undefined`), calling `void listItems({}).refresh()` on the server will NOT match because `undefined !== "{}"`. Refresh both default shapes and use `requested` to refresh client-requested queries:
    ```ts
    import { requested } from '$app/server';

    try {
        await requested(listItems, 20).refreshAll();
    } catch { /* ignore */ }
    void listItems().refresh();
    void listItems({}).refresh();
    ```

## Remote Function Query Reactivity in Svelte 5 Components

- **NEVER use `{#await myRemoteQuery()}` for Remote Functions data**:
  - `{#await promise}` in Svelte binds ONLY to the initial Promise resolution.
  - When a query is updated by a server-side single-flight mutation (`.refresh()`, `.set()`) or client-side `.refresh()`, the Promise passed to `{#await}` does NOT unresolve or emit a new resolution.
  - Consequently, `{:then}` remains frozen with stale data, and creating, modifying, or deleting items will NEVER reflect in the UI without a full page reload!
- **ALWAYS consume Remote Queries via `query.current` and Svelte 5 Runes**:
  - `query.current` is a reactive getter on `RemoteResource`. Whenever `.refresh()` or a server mutation updates the query, `query.current` automatically updates reactively:
    ```svelte
    <script lang="ts">
        // Static parameter or no args:
        const query = listItems();
        // Reactive parameter:
        const query = $derived(getItem(id));

        const items = $derived(query.current?.data ?? []);
    </script>

    {#if query.loading && !query.current}
        <LoadingSection />
    {:else if query.error}
        <ErrorSection error={query.error} />
    {:else if query.current}
        {#each items as item (item.id)}
            ...
        {/each}
    {/if}
    ```
- **Client-Side Refresh Triggers**:
  - In modal dialogs, drawers, or selectors (e.g. `EventRoleManagerModal`):
    - After executing a mutation command (`create`, `update`, `delete`), call `await query.refresh()` immediately to guarantee instant UI update.
    - When opening a dialog/dropdown, refresh the query in the trigger's event handler (e.g. `onOpenChange={(open) => { if (open) void query.refresh(); }}`).
- **Two-way props and empty collections**:
  - When deriving selection state from a prop or fallback, NEVER use `selectedIds && selectedIds.length > 0 ? selectedIds : fallback`. If the user unchecks all items, `selectedIds` is `[]`, which evaluates `.length > 0` to false and improperly reverts to `fallback`.
  - Instead, check: `selectedIds !== undefined && selectedIds !== null ? selectedIds : fallback`.

## Svelte 5 State and Navigation Standards

- **State over Stores**: ALWAYS use `import { page } from '$app/state'` for accessing URL parameters, route data, and page state. Legacy stores from `$app/stores` (e.g., `page`, `navigating`) are strictly PROHIBITED for new or refactored code.
- **Router-Native Navigation**: Internal application navigation MUST exclusively use `import { goto } from '$app/navigation'`. 
  - DO NOT use `window.location.assign` or `window.location.href` for internal routing.
  - Hard reloads should be avoided unless explicitly required for external transitions or catastrophic state resets.
- **Declarative Reactivity & Component Resets**: 
  - Use `$derived` for mirroring props or global state. 

## Svelte 5 Rune Best Practices

- **Avoid State Synchronization**: DO NOT use `$effect` to synchronize props to local `$state`. 
  - If you need to reset a component when a prop changes, use the `{#key prop}` block in the parent template.
  - If the value is a transformation of a prop, use `$derived` or `$derived.by`.
- **Prefer Event Handlers**: Use event handlers (`oninput`, `onclick`, `onchange`) for side-effects triggered by user interactions instead of watching state via `$effect`.
- **Escape Hatch Only**: Consider `$effect` as an escape hatch for:
  - Third-party library integrations (e.g., charts, maps, toast notifications).
  - Direct DOM manipulation.
  - Analytics and logging.
- **Async Data & Remote Queries**: 
  - For remote functions, ALWAYS use `const query = $derived(remoteQuery(args));` and `query.current` / `query.loading` / `query.error`.
  - NEVER use `{#await remoteQuery()}` as it freezes and ignores query invalidations/refreshes.
- **Simplicity and Svelte idiomatics**: If you are building massive abstractions or conversions, you are likely to do something wrong, as Svelte + Sveltekit are designed to offer solutions that require little code in most cases. go to svelte.dev documentation or consult the svelte MCP, when in doubt to see, whether there is a simpler way.