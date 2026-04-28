---
description: DQL query patterns, data model, and gotchas for delivery pulse queries
globs: ui/app/queries.ts
---

# DQL Query Rules

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
- Names DON'T reliably convert between formats (Alex ≠ Alejandro, hyphenated names)
- Solution: DQL `lookup` join cross-references by Jira `key` — see `JIRA_NAME_LOOKUP` constant
- The lookup includes both `jira_daily.valueincrement` AND `jira_daily.priorityindicator` event types

### FV Slippage Cap
- `fixVersionDeltaMonths <= 6` — filters out inherited historical FV data from before the analyzer started (Dec 2025)
- Applied in `fixVersionSlippageQuery`, `deliveryKpiQuery` (countIf), `slippedVisDetailQuery`

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

## DQL Gotchas
- `split()` does NOT exist in DQL — use `parse` with pattern matchers (LD, LONG, WORD)
- Always `verify_dql` before shipping new queries
- Template literals with backtick-quoted fields (e.g. `` `owning Program` ``) need careful escaping — use single-quoted string constants
- `max()` on mixed types is fragile — use `null` not empty string for else branches
