# PAPA Delivery Pulse — Copilot Instructions

## What This Is
A Dynatrace platform app (v1.1.0) for real-time delivery health tracking of Platform Apps value increments. Built with dt-app toolkit, Strato Design System, and DQL against Grail bizevents.

## Environment
- **App ID**: `my.papa.delivery.pulse`
- **Target**: `umsaywsjuo.dev.apps.dynatracelabs.com`
- **Scopes**: `storage:logs:read`, `storage:buckets:read`, `storage:bizevents:read`

## Data Model
All data comes from `jira_daily.valueincrement` bizevents — daily snapshots of Jira VIs ingested by the Jira-to-Grail pipeline.
- **Filter**: `owning Program` = `"Platform Apps"`
- **Key fields**: `key`, `summary`, `status`, `fixVersions`, `Sprint`, `Status details`, `assignee`, `component`, `updated`
- **Change detection**: Compare earliest vs latest snapshots within a configurable window

## Architecture
```
src/app/
├── App.tsx               # Router: / → Dashboard, /explorer → Explorer
├── queries.ts            # All 11 DQL query functions (shared)
├── components/
│   ├── Header.tsx        # Nav header (Dashboard, VI Explorer)
│   └── Card.tsx          # Reusable card wrapper
└── pages/
    ├── Dashboard.tsx     # Main delivery health dashboard (~800 lines)
    └── Explorer.tsx      # Full VI list with sorting
```

## Key DQL Patterns
- Queries use `fetch bizevents` with `event.type == "jira_daily.valueincrement"`
- Change detection: `summarize first(...), last(...)` then compare earliest vs latest
- Stale items: `last(updated)` with 60-day string comparison threshold
- Component names: Strip JSON brackets with regex `.replace(/^\["?|"?\]$/g, "").replace(/","/g, ", ")`

## Strato Gotchas (Learned the Hard Way)
- **Select dropdowns**: `SelectOption` MUST be wrapped in `SelectContent` — without it, options silently don't render ("No items found")
- **Chart legends**: Hide with `<CategoricalBarChart.Legend hidden />` (child component, not a prop)
- **DataTable nesting**: DataTable can't nest inside DataTable ExpandableRow — use custom accordion instead
- **Cell alignment**: Custom cell renderers need `display: "flex", alignItems: "center", height: "100%"`
- **Select empty value**: Empty string `""` is invalid for Select — use a sentinel like `"all"`

## Development
```bash
npx dt-app dev    # Start dev server (opens in Dynatrace environment)
npx dt-app deploy # Deploy to environment
```

## Related
- **AGENTS.md** — Generic DQL/Strato/dt-app development instructions (loaded automatically)
- **my-ai-assistant-system** — Parent workspace with delivery prompts (`/papa-delivery-check`, `/papa-vi-status-update`)
