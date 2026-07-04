---
name: svelte-core-bestpractices
description: Guidance on writing fast, robust, modern Svelte code. Load this skill whenever in a Svelte project and asked to write/edit or analyze Svelte components or modules.
---

# Svelte Core Best Practices Skill

## Reactive State with Runes
Use Svelte 5 runes for declarative reactivity instead of Svelte 4 legacy patterns:

### `$state`
- Only make variables reactive if they directly cause updates to templates, derived values, or effects.
- Objects and arrays inside `$state(...)` are deeply reactive and proxied.
- For large read-only objects (like API responses) where nested properties are not mutated directly, use `$state.raw(...)` to avoid proxy overhead.

### `$derived`
- Compute derived values using `$derived(expression)` rather than updating state variables inside an `$effect`.
- If the computation is complex and needs a code block/function, use `$derived.by(() => { ... })`.
- Derived values re-evaluate automatically when their dependencies change.

### `$effect`
- Treat effects as an escape hatch. Avoid using `$effect` for synchronization or state updates.
- If response to user interaction is needed, place the logic in event handlers.
- Do not run browser-only guards like `if (browser)` inside `$effect` because effects never run on the server.
- Use `$inspect(...)` for logging state changes instead of logging in an effect.

### `$props`
- Declare props using `let { prop1, prop2 } = $props();`.
- Treat props as read-only. Use `$derived` for computed properties depending on props.

### `$inspect.trace`
- Use `$inspect.trace(label)` at the beginning of an effect or `$derived.by` function to trace what dependency triggered the update.

## Event Handling
- Attributes starting with `on` are treated as event listeners, e.g. `onclick={handler}` (no more `on:click`).
- Use `{onclick}` shorthand if the variable name matches.
- Use `<svelte:window onkeydown={handler} />` or `<svelte:document onvisibilitychange={handler} />` rather than attaching manual listeners inside mounting hooks.

## Snippets & Render
- Use `{#snippet name(args)}...{/snippet}` to declare reusable template blocks.
- Render them using `{@render name(args)}`.
- Pass snippets as props to components for flexible layout slots.
