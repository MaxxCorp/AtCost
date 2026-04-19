---
trigger: always_on
---

## Development Workflow Excellence

- **Zero-Error Build Mandate**: BEFORE ending any task or run, ALWAYS execute `pnpm run check` in the root of the workspace or the relevant project.
  - ALL type errors, Svelte compilation warnings, and lint issues must be resolved.
  - work iteratively until all issues are resolved
  - Failure to leave the codebase in a "green" (zero errors) state is UNACCEPTABLE.