# PAPA Delivery Pulse

A Dynatrace platform app for real-time delivery health tracking of Platform Apps value increments.

## What It Does

### Dashboard (`/`)
- **Portfolio overview** — Status distribution bar chart, active VI count by assignee
- **FV/Sprint changes** — Detects fix version and sprint changes within a configurable lookback window
- **Delivery status changes** — Tracks status transitions (e.g. Implementation → Release Preparation)
- **Items entering implementation** — Highlights VIs recently moving into active work
- **Stale item detection** — Flags VIs with no status update in 60+ days
- **Delivery Health Snapshot** — Hero KPIs from VI Analyzer: slippage count, missing FV at start, stale updates; clickable rows drill down to individual VIs
- **Delivery Timeline** — Interactive bar chart of VIs by target fix version; click to drill down; overdue FVs highlighted red
- **Fix Version Slippage** — Table of VIs whose fix version moved (capped at ≤6 months to exclude inherited historical data)
- **Missing Fix Version** — Table of VIs missing FV at implementation start, with clickable TEL names that filter the dashboard
- **Rally Milestones** — PAPA VIs linked to cross-program rally milestones, with click-through to contributing items

### VI Explorer (`/explorer`)
- Full list of all PAPA value increments with sorting
- Three filter dropdowns: Status (multi-select), Assignee, Component
- Clear all filters button

### Production Health (`/health`)
- Frontend RUM metrics for PAPA-owned apps (Dashboards, Notebooks, Workflows, etc.)
- User action volume, error rates, active sessions, Web Vitals
- Top exceptions, request errors, active problems by category

### Transparency Features
Every data card has a `⟨/⟩ DQL` button that opens a Sheet overlay showing:
- The raw DQL query powering the card
- A copy-to-clipboard button
- An "Open in Notebook" link that uses `getIntentLink({ "dt.query": query }, "dynatrace.notebooks", "view-query")` to open Dynatrace Notebooks with the DQL pre-populated

This gives users full visibility into how each metric is computed and the ability to explore the data independently.

## Data Sources

| Source | Event Type | Purpose |
|--------|-----------|---------|
| Jira daily snapshots | `jira_daily.valueincrement` | Portfolio tracking, change detection, assignee names |
| Jira daily snapshots | `jira_daily.priorityindicator` | Name resolution fallback for items not in VI type |
| VI Analyzer | `valueincrement.analzyer` (provider) | Lifecycle metrics: FV slippage, missing FV, stale updates |
| Jira daily snapshots | `jira_daily_snapshot` (provider) | Rally milestone link resolution |
| Rally milestones | `milestone.status` | Milestone progress data |
| RUM | `dt.rum.*` | Frontend health metrics |
| Davis problems | `dt.davis.problems` | Active problem tracking |

**Cross-source name resolution**: VI Analyzer stores `executionAssignee` as email; daily snapshots store `Execution Assignee` as display name. A DQL lookup join cross-references by Jira `key` to resolve display names for filtering.

## Getting Started

```bash
npx dt-app dev     # Start development server
npx dt-app build   # Build for deployment
npx dt-app deploy  # Deploy to environment
```

## Environment

- **App ID**: `my.papa.delivery.pulse`
- **Version**: 1.8.0
- **Target**: `umsaywsjuo.dev.apps.dynatracelabs.com`
- **Scopes**: `storage:logs:read`, `storage:buckets:read`, `storage:bizevents:read`, `storage:events:read`, `storage:metrics:read`

## Architecture

```
ui/app/
├── App.tsx                    # Router: /, /explorer, /health
├── queries.ts                 # All DQL queries (31 query functions, 554 lines)
├── components/
│   ├── Header.tsx             # Navigation header (Dashboard, VI Explorer, Production Health)
│   ├── Card.tsx               # Reusable card component
│   └── QueryInspector.tsx     # Reusable DQL inspector — Sheet overlay with query + copy + Notebooks link
└── pages/
    ├── Dashboard.tsx          # Main delivery health dashboard (1322 lines)
    ├── Explorer.tsx           # Full VI list with filters (184 lines)
    └── ProductionHealth.tsx   # Frontend RUM & problems (661 lines)
```

### Query Layer (`queries.ts`)

**Shared infrastructure**:
- `QueryFilters` interface: `{ executionAssignee?, component?, statuses? }`
- `filterLines()` — pre-summarize filters for daily snapshot queries
- `postFilterLines()` — post-summarize status filter
- `viFilterLines()` — lookup-based assignee filter for VI Analyzer queries
- `JIRA_NAME_LOOKUP` — shared DQL lookup join for name resolution across data sources

**Dashboard queries** (daily snapshots): `fvSprintChangesQuery`, `deliveryUpdatesQuery`, `portfolioQuery`, `portfolioItemsQuery`, `staleItemsQuery`, `nearFutureQuery`, `activePortfolioQuery`, `portfolioByAssigneeQuery`

**VI Analyzer queries**: `deliveryTimelineQuery`, `fixVersionSlippageQuery`, `missingFvAtStartQuery`, `deliveryKpiQuery`, `visByFixVersionQuery`, `slippedVisDetailQuery`, `noFvAtStartDetailQuery`, `staleUpdateVisDetailQuery`

**Rally queries**: `rallyMilestonesQuery`, `rallyMilestoneVisQuery`

**Explorer queries**: `allItemsQuery`, `componentBreakdownQuery`, `statusBreakdownQuery`

**Production Health queries**: `userActionVolumeQuery`, `frontendErrorRateQuery`, `frontendErrorTrendQuery`, `activeSessionsQuery`, `topExceptionsQuery`, `requestErrorsQuery`, `webVitalsSummaryQuery`, `activeProblemsByCategoryQuery`, `problemTrendQuery`, `recentProblemsQuery`

## Built With

- [Dynatrace App Toolkit](https://developer.dynatrace.com/develop/app-toolkit/) (`dt-app`)
- [Strato Design System](https://developer.dynatrace.com/develop/ui/) (React components)
- [Grail / DQL](https://docs.dynatrace.com/docs/platform/grail/dynatrace-query-language) via `@dynatrace-sdk/react-hooks`
- GitHub Copilot (AI-assisted development)
