# AtCost Monorepo

AtCost is a multi-application platform built on modern SvelteKit, TypeScript, Drizzle ORM, and PostgreSQL.

## Applications & Packages

- **`apps/multiposter`**: Multi-channel event publishing, announcements, and calendar synchronization (Google Calendar & Microsoft Graph).
- **`apps/talents`**: Talent management, shift scheduling, and staff allocations.
- **`packages/db`**: Centralized PostgreSQL database schema, Drizzle ORM models, migrations, and database client.
- **`packages/validations`**: Shared entity schemas, Valibot validation rules, and standardized pagination types.

---

## Documentation

Full architectural guides, integration setup manuals, and design standards are located in the [docs/](./docs) directory:

- [Event Series & Recurring Events Architecture](./docs/event-series.md) – Covers recurrence rules (RRULE), dynamic virtual instances (`${masterId}_inst_${iso}`), materialized exceptions, and **No-Op Exception Protection**.
- [Feature Architecture & Remote Functions](./docs/architecture.md) – Development conventions, route hierarchy, SvelteKit Remote Functions, and form binding patterns.
- [Microsoft Calendar Sync Setup](./docs/microsoft-sync-setup.md) – Microsoft Entra ID registration, OAuth configuration, and webhook handling.

---

## Workspace Commands

This repository uses **pnpm workspaces**:

```powershell
# Install dependencies
pnpm install

# Type-check all workspace projects (Zero-error mandate)
pnpm run check

# Run tests
pnpm test

# Generate database migrations
pnpm run db:generate

# Apply database migrations
pnpm run db:migrate

# Start local development servers
pnpm run dev
```
