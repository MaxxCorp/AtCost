---
trigger: always_on
---

# AI Agent Instructions: SvelteKit Architecture

- **SvelteKit Remote Functions Exclusivity**: ALL SvelteKit applications in this repository MUST exclusively use SvelteKit Remote Functions (`$app/server` exports `query` and `form`) and their native form binding syntax as described in https://svelte.dev/docs/kit/remote-functions.
- **No Legacy Patterns**: SvelteKit `load` functions and `actions` (in `+*.server.ts` or `+*.ts`) are strictly PROHIBITED. All data fetching must occur via Remote Functions (`query`/`form`) or established client-side state providers.
  - **Note**: Static configuration exports (e.g., `export const ssr = false;`) are permitted in `+layout.ts` or `+page.ts` if required for project-level settings.
- **No REST Endpoints for Data Fetching**: Standard API routes (`+server.ts` GET/POST/etc.) are superseded for internal data fetching/mutation and should NOT be used unless explicitly interacting with a non-SvelteKit external client.
- **Strict Fields API**: When submitting remote forms, ALWAYS use the official field API syntax: `{...formHandle.fields.fieldName.as('type', value)}`.
  - DO NOT manually create HTML `<input type="hidden">` tags for form submissions.
  - DO NOT use proxy helper functions (like a custom `getField` utility) to work around `fields` typings. Fix the underlying typing issues.
- **Enhance & Preflight Pattern**: Always use `{...remoteForm.preflight(schema).enhance(async ({ submit }) => { ... })}` to bind forms and enable client-side validation.
  - **Client-Side Validation**: Reuse the remote validation schemas for `preflight()`. This prevents network requests when the form is locally invalid.
  - **Per-Field Feedback**: ALWAYS display field-specific validation errors using `{#each rf.fields.fieldName.issues() as issue}<p>{issue.message}</p>{/each}`.
  - **Validation Toast**: Add an `$effect` to trigger a global `toast.error(m.please_fix_validation())` when validation issues are detected. Use a transition check (e.g., tracking `prevIssuesLength`) to avoid spamming toasts on every keystroke.

## Svelte 5 State and Navigation Standards

- **State over Stores**: ALWAYS use `import { page } from '$app/state'` for accessing URL parameters, route data, and page state. Legacy stores from `$app/stores` (e.g., `page`, `navigating`) are strictly PROHIBITED for new or refactored code.
- **Router-Native Navigation**: Internal application navigation MUST exclusively use `import { goto } from '$app/navigation'`. 
  - DO NOT use `window.location.assign` or `window.location.href` for internal routing.
  - Hard reloads should be avoided unless explicitly required for external transitions or catastrophic state resets.
- **Declarative Reactivity & Component Resets**: 
  - Use `$derived` for mirroring props or global state. 
  - Use `{#key page.url.pathname}` in `+layout.svelte` around `{@render children()}` to force-reset entire page trees on navigation if state feels "stuck" or components fail to swap.
  - Use `{#key identifier}` in components to force identity-based refreshes instead of relying on manual state synchronization.

## Svelte 5 Rune Best Practices ($effect)

- **Avoid State Synchronization**: DO NOT use `$effect` to synchronize props to local `$state`. 
  - If you need to reset a component when a prop changes, use the `{#key prop}` block in the parent template.
  - If the value is a transformation of a prop, use `$derived` or `$derived.by`.
- **Prefer Event Handlers**: Use event handlers (`oninput`, `onclick`, `onchange`) for side-effects triggered by user interactions instead of watching state via `$effect`.
- **Escape Hatch Only**: Consider `$effect` as an escape hatch for:
  - Third-party library integrations (e.g., charts, maps, toast notifications).
  - Direct DOM manipulation.
  - Analytics and logging.
- **Async Data**: For asynchronous data loading in the script, prefer handling promises via `{#await}` in the template or using `$derived` if the result needs to be reactive.
