# PAPA Delivery Pulse

A Dynatrace platform app (v1.8.0) for real-time delivery health tracking of Platform Apps value increments. Built with dt-app toolkit, Strato Design System, and DQL against Grail bizevents.

## Environment
- **App ID**: `my.papa.delivery.pulse`
- **Target**: `umsaywsjuo.dev.apps.dynatracelabs.com`
- **Scopes**: `storage:logs:read`, `storage:buckets:read`, `storage:bizevents:read`, `storage:events:read`, `storage:metrics:read`

## Commands
```bash
npx dt-app dev      # Start dev server
npx dt-app build    # Build
npx dt-app deploy   # Deploy (bump version in app.config.json first — same version = HTTP 400)
```

## Architecture
```
ui/app/
├── App.tsx                    # Router: /, /explorer, /health
├── queries.ts                 # 31 DQL query functions + filter helpers (554 lines)
├── components/
│   ├── Header.tsx             # Nav header (Dashboard, VI Explorer, Production Health)
│   ├── Card.tsx               # Reusable card wrapper
│   └── QueryInspector.tsx     # DQL inspector — Sheet overlay with query + copy + Notebooks link
└── pages/
    ├── Dashboard.tsx          # Main delivery health dashboard (1322 lines)
    ├── Explorer.tsx           # Full VI list with filters (184 lines)
    └── ProductionHealth.tsx   # Frontend RUM & problems (661 lines)
```

Note: `Data.tsx` and `Home.tsx` in pages/ are unused scaffolding from the template.

## Data Model

### Daily Snapshots (`jira_daily.valueincrement`, `jira_daily.priorityindicator`)
- Daily snapshots of Jira VIs ingested by the Jira-to-Grail pipeline
- **Filter**: `owning Program` = `"Platform Apps"` (backtick-quoted — field has a space)
- **Key fields**: `key`, `summary`, `status`, `fixVersions`, `Sprint`, `Execution Assignee`, `components`, `updated`
- **Change detection**: Compare earliest vs latest snapshots within a configurable window

### VI Analyzer (`valueincrement.analzyer` — note the typo in the provider name)
- Lifecycle pipeline — tracks FV slippage, missing FV at implementation start, stale updates
- **Filter**: `event.provider == "valueincrement.analzyer"`, `owningProgram` (no space, no backticks)
- **Key fields**: `key`, `summary`, `statusCurrent`, `executionAssignee` (email), `fixVersion` (JSON), `fixVersionInitial` (JSON), `fixVersionDeltaMonths`, `fixVersionSetOnImplementationStart`, `statusUpdateDaysAgo`

### Cross-Source Name Resolution
- VI Analyzer = email (`alejandro.estrada@dynatrace.com`), Daily snapshots = display name (`Alex Estrada Gomez`)
- DQL `lookup` join cross-references by Jira `key` — see `JIRA_NAME_LOOKUP` constant in queries.ts

### FV Slippage Cap
- `fixVersionDeltaMonths <= 6` filters out inherited historical FV data from before the analyzer started

## Query Layer Patterns
- `filterLines(f)` — pre-summarize filters for daily snapshot queries
- `postFilterLines(f)` — post-summarize status filter
- `viFilterLines(f)` — lookup-based assignee filter for VI Analyzer queries
- Component filter uses `JSON.parse` + `contains()` — NOT `matchesValue`

## DQL Gotchas
- `split()` does NOT exist in DQL — use `parse` with pattern matchers (LD, LONG, WORD)
- Always `verify_dql` before shipping new queries
- Template literals with backtick-quoted fields need careful escaping

## Strato Gotchas
- **Select dropdowns**: `SelectOption` MUST be wrapped in `SelectContent`
- **Select empty value**: Use a sentinel like `"all"`, not empty string `""`
- **DataTable dotted accessors**: `accessor: "fv.name"` treats dots as nested paths — alias with `fieldsAdd`
- **DataTable nesting**: Can't nest DataTable inside ExpandableRow
- **Cell alignment**: Custom renderers need `display: "flex", alignItems: "center", height: "100%"`
- **Padding tokens**: Only 0|2|4|6|8|12|16|20|24|32|40|48|56|64
- **Imports**: Always import from subcategory path (`/layouts`, `/typography`) — never from package root

## Related
- **AGENTS.md** in this repo — Generic DQL/Strato/dt-app development instructions
- **ai-first-observer** — Sibling repo for AI-First impact measurement
