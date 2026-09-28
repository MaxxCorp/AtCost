# Feature Architecture & Remote Functions Pattern

This document outlines the standard architectural patterns for implementing full-stack features (Routes, Forms, Database, Validation, and Authorization) across the monorepo applications.

---

## 1. Directory Structure (Routes)

Features adhere to resource-based routing under `src/routes/[feature_plural]`:

```text
src/routes/[feature_plural]/
├── +page.svelte                 # List View (Index)
├── list.remote.ts               # Server: Fetch all items (Remote Query)
├── new/
│   ├── +page.svelte             # Create View (wraps shared Form)
│   └── create.remote.ts         # Server: Handle Creation (Remote Form)
└── [id]/
    ├── +page.svelte             # Edit View (wraps shared Form)
    ├── view/
    │   └── +page.svelte         # Read-Only View (Details)
    ├── update.remote.ts         # Server: Handle Updates (Remote Form)
    ├── delete.remote.ts         # Server: Handle Deletion (Remote Command)
    └── read.remote.ts           # Server: Fetch single item details (Remote Query)
```

---

## 2. Remote Functions Architecture

Per project standards, all data access and mutations **exclusively** use SvelteKit Remote Functions (`query`, `form`, `command`) from `$app/server`.

- Files ending in `.remote.ts` must export remote function handles only.
- Standard REST endpoints (`+server.ts`) and legacy SvelteKit `load` functions / `actions` are prohibited for internal application operations.

### Form Binding & Preflight Pattern
Always use `remoteForm.preflight(schema).enhance(...)` to enable client-side validation before dispatching requests:

```svelte
<form {...remoteForm.preflight(schema).enhance(async ({ submit }) => {
    // Client-side validated submission
})}>
    <!-- Form fields using official fields API -->
    <input {...remoteForm.fields.summary.as('text')} />
    {#each remoteForm.fields.summary.issues() as issue}
        <p class="error">{issue.message}</p>
    {/each}
</form>
```

### Server-Side Data Synchronization
Mutating remote functions (`create`, `update`, `delete`) must synchronize client-side queries using `.refresh()` or `.set()` instructions:

```ts
// In update.remote.ts
await readEvent(effectiveTargetId).refresh();
await listEvents().refresh();
```

---

## 3. Shared Components & Form Reusability

Shared UI logic lives in `src/lib/components/[feature_plural]/`.

- **`[Feature]Form.svelte`**: A single form component used for both Create and Update views.
  - **Props**:
    - `remoteFunction`: The remote form handle (`createEvent` or `updateEvent`).
    - `validationSchema`: The Valibot schema.
    - `initialData`: (Optional) Existing record data for Edit mode.
    - `isUpdating`: Boolean flag indicating whether the form is updating or creating.
- **Component Keying**: When routing between instances or entities, always key components with `{#key event.id}` to cleanly reinitialize component state.

---

## 4. Validation Schemas & Types

All validation schemas are built with Valibot (`v.object(...)`):
- Shared schemas across applications live in `@ac/validations` (`packages/validations/src/`).
- App-specific schemas live in `src/lib/validations/[feature].ts`.
- Base schemas are extended for Create (`createSchema`) and Update (`updateSchema`).
- Standard pagination uses `PaginationSchema` and `PaginatedResult<T>` from `@ac/validations`.

---

## 5. Authorization & Multi-User Rules

- Explicit authorization checks are required at the entry of every remote function:
  ```ts
  const user = getAuthenticatedUser();
  ensureAccess(user, 'events');
  ```
- **Multi-user default**: Unless explicitly requested, queries and mutations are not restricted by `userId`. Users collaborate and interact across shared records by default.
