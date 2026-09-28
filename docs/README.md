# AtCost Documentation

Welcome to the AtCost developer documentation.

## Documentation Index

- [Event Series & Recurring Events Architecture](file:///c:/Users/bofru/src/AtCost/docs/event-series.md):
  Comprehensive documentation on master events, virtual instances (`${masterId}_inst_${iso}`), materialized exceptions, and the deep-diff **No-Op Exception Protection** mechanism.
- [Feature Architecture & Remote Functions Pattern](file:///c:/Users/bofru/src/AtCost/docs/architecture.md):
  Standard directory structure, SvelteKit Remote Functions exclusivity, Valibot schemas, forms binding, and multi-user data patterns.
- [Microsoft Calendar Sync Setup](file:///c:/Users/bofru/src/AtCost/docs/microsoft-sync-setup.md):
  Step-by-step setup for Microsoft Graph OAuth registration, calendar synchronization, and push webhook setup.

---

## Monorepo Layout

```text
AtCost/
├── apps/
│   ├── multiposter/       # Event, announcement, and calendar synchronization application
│   └── talents/           # Talent management, staffing, and shift planning application
├── packages/
│   ├── db/                # Drizzle ORM schema, migrations, and PostgreSQL connection
│   └── validations/       # Shared Valibot schemas, pagination, and campaign models
└── docs/                  # Centralized repository documentation
```
