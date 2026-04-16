# PAPA Delivery Pulse — Copilot Instructions

## What This Is
A Dynatrace platform app (v1.8.0) for real-time delivery health tracking of Platform Apps value increments. Built with dt-app toolkit, Strato Design System, and DQL against Grail bizevents.

## Environment
- **App ID**: `my.papa.delivery.pulse`
- **Target**: `umsaywsjuo.dev.apps.dynatracelabs.com`
- **Scopes**: `storage:logs:read`, `storage:buckets:read`, `storage:bizevents:read`, `storage:events:read`, `storage:metrics:read`

## Data Model

### Daily Snapshots (`jira_daily.valueincrement`, `jira_daily.priorityindicator`)
- Daily snapshots of Jira VIs ingested by the Jira-to-Grail pipeline
- **Filter**: `owning Program` = `"Platform Apps"` (backtick-quoted — field has a space)
- **Key fields**: `key`, `summary`, `status`, `fixVersions`, `Sprint`, `Execution Assignee` (display name), `components` (JSON array string), `updated`
- **Change detection**: Compare earliest vs latest snapshots within a configurable window

### VI Analyzer (`valueincrement.analzyer` — note the typo in the provider name)
- Damien Antipa's lifecycle pipeline — tracks FV slippage, missing FV at implementation start, stale updates
- **Filter**: `event.provider == "valueincrement.analzyer"`, `owningProgram` (no space, no backticks)
- **Key fields**: `key`, `summary`, `statusCurrent`, `executionAssignee` (email address), `fixVersion` (JSON object), `fixVersionInitial` (JSON object), `fixVersionDeltaMonths`, `fixVersionSetOnImplementationStart`, `statusUpdateDaysAgo`

### Cross-Source Name Resolution
- VI Analyzer stores `executionAssignee` as email (e.g. `alejandro.estrada@dynatrace.com`)
- Daily snapshots store `Execution Assignee` as display name (e.g. `Alex Estrada Gomez`)
- Names DON'T reliably convert between formats (Alex ≠ Alejandro, hyphenated names, etc.)
- Solution: DQL `lookup` join cross-references by Jira `key` — see `JIRA_NAME_LOOKUP` constant in queries.ts
- The lookup includes both `jira_daily.valueincrement` AND `jira_daily.priorityindicator` event types (some VIs only exist in the latter)

### Other Sources
- `jira_daily_snapshot` (provider) + `milestone.status` — Rally milestone tracking
- `dt.rum.*` — Frontend RUM metrics for PAPA-owned apps
- `dt.davis.problems` — Problem tracking

## Architecture
```
ui/app/
├── App.tsx                    # Router: /, /explorer, /health
├── queries.ts                 # 31 DQL query functions + filter helpers (554 lines)
├── components/
│   ├── Header.tsx             # Nav header (Dashboard, VI Explorer, Production Health)
│   ├── Card.tsx               # Reusable card wrapper
│   └── QueryInspector.tsx     # Reusable DQL inspector — Sheet overlay with query + copy + Notebooks link
└── pages/
    ├── Dashboard.tsx          # Main delivery health dashboard (1322 lines)
    ├── Explorer.tsx           # Full VI list with filters (184 lines)
    └── ProductionHealth.tsx   # Frontend RUM & problems (661 lines)
```

Note: `Data.tsx` and `Home.tsx` in pages/ are unused scaffolding from the template.

## Query Layer Patterns

### Filter System (`QueryFilters`)
- `filterLines(f)` — pre-summarize filters for daily snapshot queries (assignee, component)
- `postFilterLines(f)` — post-summarize status filter using `in(latest_status, array(...))`
- `viFilterLines(f)` — lookup-based assignee filter for VI Analyzer queries; injects `JIRA_NAME_LOOKUP` then filters on `jn.assigneeName`
- Component filter uses `JSON.parse` + `contains()` — NOT `matchesValue` (quotes in JSON array values break it)

### VI Analyzer Query Pattern
```
fetch bizevents | filter event.provider == "valueincrement.analzyer" | ... | dedup key, sort: timestamp desc
${viFilterLines(f)}     ← injected AFTER dedup (lookup needs deduped keys)
| parse fixVersion, "JSON:fv" | fieldsFlatten fv, prefix: "fv."
| fieldsAdd currentFv = fv.name   ← alias dotted names (DataTable treats dots as nested paths)
```

### FV Slippage Cap
- `fixVersionDeltaMonths <= 6` — filters out inherited historical FV data from before the analyzer started (Dec 2025)
- Applied in `fixVersionSlippageQuery`, `deliveryKpiQuery` (countIf), `slippedVisDetailQuery`

## Key Patterns

### QueryInspector (DQL Transparency)
Every data card has a `⟨/⟩ DQL` button (from `components/QueryInspector.tsx`) that opens a Strato `Sheet` overlay showing the raw DQL query, a copy button, and an "Open in Notebook" link that uses `getIntentLink({ "dt.query": query }, "dynatrace.notebooks", "view-query")` from `@dynatrace-sdk/navigation` to open Notebooks with the DQL pre-populated. Pattern: store the query string in a local variable, pass to both `useDql({ query })` and `<QueryInspector query={query} title="..." />`.

## Strato Gotchas (Learned the Hard Way)
- **Select dropdowns**: `SelectOption` MUST be wrapped in `SelectContent` — without it, options silently don't render ("No items found")
- **Select multi-select**: Use `multiple` prop; value becomes `string[]`, onChange returns `string[]`
- **Chart legends**: Hide with `<CategoricalBarChart.Legend hidden />` (child component, not a prop)
- **DataTable dotted accessors**: `accessor: "fv.name"` is treated as nested path `obj.fv.name` — use `fieldsAdd` to alias flat DQL fields with dots to simple names
- **DataTable nesting**: DataTable can't nest inside DataTable ExpandableRow — use custom accordion instead
- **Cell alignment**: Custom cell renderers need `display: "flex", alignItems: "center", height: "100%"`
- **Select empty value**: Empty string `""` is invalid for Select — use a sentinel like `"all"`
- **Padding tokens**: Only 0|2|4|6|8|12|16|20|24|32|40|48|56|64

## Development
```bash
npx dt-app dev      # Start dev server
npx dt-app build    # Build
npx dt-app deploy   # Deploy to environment
```

## Related
- **AGENTS.md** — Generic DQL/Strato/dt-app development instructions (loaded automatically)
- **my-ai-assistant-system** — Parent workspace with delivery prompts
