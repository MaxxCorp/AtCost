# SvelteKit Remote Function Architecture Rules

## 1. Remote Function Exclusivity in `.remote.ts`
- Files ending in `.remote.ts` MUST EXCLUSIVELY export remote function handles using `$app/server` exports (`query`, `form`, `command`, `prerender`).
- **NO OTHER EXPORTS** (constants, schemas, types, etc.) are allowed in these files. This is strictly enforced by `vite-plugin-sveltekit-remote`.

## 2. Validation Schema & Type Locations
- **All** validation schemas (`v.object(...)`) and types shared between server-side remote functions and client-side components must be located in:
  - **Option A (Preferred for Shared Entities)**: `@ac/validations` package in `packages/validations/src/`. Use this for entities shared across apps (Events, Locations, Users, Talents, etc.).
  - **Option B (App-Specific Entities)**: `src/lib/validations/` within the respective application.
- **Naming Convention**: Filenames in `validations` directories should match the entity name (e.g., `events.ts`, `talents.ts`). Avoid suffixes like `.shared.ts` or `.schema.ts` inside these specific directories.

## 3. Standardized Pagination
- Unified pagination schema (`PaginationSchema`) and results type (`PaginatedResult<T>`) MUST be imported from `@ac/validations`.
- Feature-specific pagination should extend the base schema rather than redefining it.

## 4. Interaction Patterns
- Use `remoteFunction.preflight(schema).enhance(...)` to bind forms.
- Use the official field API: `{...rf.fields.fieldName.as('type', value)}`.
