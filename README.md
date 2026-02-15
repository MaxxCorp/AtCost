# AtCost Monorepo

This repository contains the source code for AtCost applications and packages.

## Structure

- `apps/`
  - `multiposter`: The multi-poster application (formerly `ac-multiposter`).
  - `personnel`: The personnel management application (formerly `ac-personnel`).
  - `credentials-manager`: The credentials manager application.
- `packages/`
  - Shared libraries (TBD).

## Commands

This monorepo uses [Turborepo](https://turbo.build/) and [pnpm workspaces](https://pnpm.io/workspaces).

- `pnpm install`: Install dependencies for all apps and packages.
- `pnpm build`: Build all applications.
- `pnpm dev`: Start development servers for all applications.
  - To run individually: `pnpm --filter @ac/multiposter dev` or `pnpm --filter @ac/personnel dev`
- `pnpm lint`: Run linting across the monorepo.
- `pnpm check`: Run type checking across the monorepo.
