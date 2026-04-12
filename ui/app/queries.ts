/**
 * DQL queries for PAPA delivery tracking.
 * Data source: jira_daily.valueincrement bizevents in Grail.
 */

/** How many days back to look for changes */
export const LOOKBACK_DAYS = 14;

/** Optional filters for scoping queries */
export interface QueryFilters {
  executionAssignee?: string | null;
  component?: string | null;
  statuses?: string[] | null;
}

/** Build pre-summarize filter lines from optional filters */
function filterLines(f?: QueryFilters): string {
  let lines = "";
  if (f?.executionAssignee) {
    lines += `\n| filter \`Execution Assignee\` == "${f.executionAssignee}"`;
  }
  if (f?.component) {
    // components field stores JSON arrays like ["Name"]; parse to avoid quote-escaping issues
    let names: string[];
    try {
      const parsed = JSON.parse(f.component);
      names = Array.isArray(parsed) ? parsed : [f.component];
    } catch {
      names = [f.component.replace(/^\["|"\]$/g, "")];
    }
    names.forEach((n) => {
      lines += `\n| filter contains(components, "${n}")`;
    });
  }
  return lines;
}

/** Build post-summarize filter lines (e.g. status filter on latest_status) */
function postFilterLines(f?: QueryFilters): string {
  let lines = "";
  if (f?.statuses && f.statuses.length > 0) {
    const vals = f.statuses.map((s) => `"${s}"`).join(", ");
    lines += `\n| filter in(latest_status, array(${vals}))`;
  }
  return lines;
}

/** Component breakdown for filter dropdown — uses aliased fields (same pattern as portfolioByAssigneeQuery which works via useDql) */
export const componentBreakdownQuery = () => `
fetch bizevents, from:now()-7d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| sort timestamp desc
| summarize latest_status = last(status), latest_components = last(components), by: { key }
| filter not(matchesValue(latest_status, "Closed"))
| filter not(matchesValue(latest_status, "Cancelled"))
| filter isNotNull(latest_components)
| filter latest_components != "[]"
| summarize item_count = count(), by: { latest_components }
| sort item_count desc
`;

/** Status breakdown for filter dropdown */
export const statusBreakdownQuery = () => `
fetch bizevents, from:now()-7d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| sort timestamp desc
| summarize latest_status = last(status), by: { key }
| summarize item_count = count(), by: { latest_status }
| sort item_count desc
`;

/** Fix Version / Sprint change detection */
export const fvSprintChangesQuery = (days: number = LOOKBACK_DAYS, f?: QueryFilters) => `
fetch bizevents, from:now()-${days}d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")${filterLines(f)}
| filter isNotNull(fixVersions) or isNotNull(Sprint)
| sort timestamp asc
| summarize
    earliest_fv = first(fixVersions),
    latest_fv = last(fixVersions),
    earliest_sprint = first(Sprint),
    latest_sprint = last(Sprint),
    latest_status = last(status),
    latest_summary = last(summary),
    latest_assignee = last(\`Execution Assignee\`),
    latest_reporter = last(reporter),
    status_details = last(\`Status details\`),
    records = count(),
    by: { key }
| filter earliest_fv != latest_fv or earliest_sprint != latest_sprint
| sort key asc
`;

/** Delivery status changes */
export const deliveryUpdatesQuery = (days: number = LOOKBACK_DAYS, f?: QueryFilters) => `
fetch bizevents, from:now()-${days}d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")${filterLines(f)}
| sort timestamp asc
| summarize
    earliest_status = first(status),
    latest_status = last(status),
    latest_fv = last(fixVersions),
    latest_summary = last(summary),
    latest_assignee = last(\`Execution Assignee\`),
    latest_reporter = last(reporter),
    status_details = last(\`Status details\`),
    records = count(),
    by: { key }
| filter earliest_status != latest_status
| sort key asc
`;

/** Portfolio overview — all active PAPA VIs grouped by status */
export const portfolioQuery = (f?: QueryFilters) => `
fetch bizevents, from:now()-7d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")${filterLines(f)}
| sort timestamp desc
| summarize
    latest_status = last(status),
    latest_fv = last(fixVersions),
    latest_summary = last(summary),
    by: { key }
| summarize item_count = count(), by: { latest_status }
| sort item_count desc
`;

/** Portfolio items for a specific status — drill-down from portfolio overview */
export const portfolioItemsQuery = (status: string, f?: QueryFilters) => `
fetch bizevents, from:now()-7d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")${filterLines(f)}
| sort timestamp desc
| summarize
    latest_status = last(status),
    latest_fv = last(fixVersions),
    latest_summary = last(summary),
    latest_assignee = last(\`Execution Assignee\`),
    latest_reporter = last(reporter),
    status_details = last(\`Status details\`),
    by: { key }
| filter latest_status == "${status}"
| sort key asc
`;

/** Items with no Jira update in 60+ days (stale detection) */
export const staleItemsQuery = (f?: QueryFilters) => `
fetch bizevents, from:now()-90d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")${filterLines(f)}
| summarize
    last_updated = last(updated),
    latest_status = last(status),
    latest_summary = last(summary),
    latest_fv = last(fixVersions),
    latest_assignee = last(\`Execution Assignee\`),
    latest_reporter = last(reporter),
    status_details = last(\`Status details\`),
    by: { key }
| filter not(matchesValue(latest_status, "Closed"))
| filter not(matchesValue(latest_status, "Post GA"))
| filter not(matchesValue(latest_status, "Cancelled"))
| filter last_updated < "${new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)}"
| sort last_updated asc
`;

/** Near future — items entering Implementation */
export const nearFutureQuery = (days: number = LOOKBACK_DAYS, f?: QueryFilters) => `
fetch bizevents, from:now()-${days}d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")${filterLines(f)}
| sort timestamp asc
| summarize
    earliest_status = first(status),
    latest_status = last(status),
    latest_fv = last(fixVersions),
    latest_summary = last(summary),
    latest_assignee = last(\`Execution Assignee\`),
    latest_reporter = last(reporter),
    status_details = last(\`Status details\`),
    records = count(),
    by: { key }
| filter latest_status == "Implementation" and earliest_status != "Implementation"
| sort key asc
`;

/** Full VI list — latest snapshot of all PAPA items */
export const allItemsQuery = (f?: QueryFilters) => `
fetch bizevents, from:now()-7d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")${filterLines(f)}
| sort timestamp desc
| summarize
    latest_status = last(status),
    latest_fv = last(fixVersions),
    latest_sprint = last(Sprint),
    latest_summary = last(summary),
    latest_assignee = last(\`Execution Assignee\`),
    latest_reporter = last(reporter),
    latest_components = last(components),
    status_details = last(\`Status details\`),
    by: { key }${postFilterLines(f)}
| sort latest_status asc, key asc
`;

/** Portfolio by assignee — for the assignee breakdown chart */
export const portfolioByAssigneeQuery = (f?: QueryFilters) => `
fetch bizevents, from:now()-7d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")${filterLines(f)}
| sort timestamp desc
| summarize latest_status = last(status), latest_assignee = last(\`Execution Assignee\`), by: { key }
| filter not(matchesValue(latest_status, "Closed"))
| filter not(matchesValue(latest_status, "Cancelled"))
| summarize item_count = count(), by: { latest_assignee }
| sort item_count desc
`;

/** Portfolio by status (for active items chart) */
export const activePortfolioQuery = (f?: QueryFilters) => `
fetch bizevents, from:now()-7d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")${filterLines(f)}
| sort timestamp desc
| summarize latest_status = last(status), by: { key }
| filter not(matchesValue(latest_status, "Closed"))
| filter not(matchesValue(latest_status, "Cancelled"))
| summarize item_count = count(), by: { latest_status }
| sort item_count desc
`;

// ─── Production Health Queries ────────────────────────────────

// ─── Milestone / Delivery Tracking (from valueincrement.analzyer) ──

/** Fix version delivery timeline — VIs grouped by target fix version with status breakdown */
export const deliveryTimelineQuery = () => `
fetch bizevents, from: now() - 7d
| filter event.provider == "valueincrement.analzyer"
| filter matchesValue(owningProgram, "Platform Apps")
| filter statusCurrent != "Closed"
| dedup key, sort: timestamp desc
| parse fixVersion, "JSON:fv"
| fieldsFlatten fv, prefix: "fv."
| filter isNotNull(fv.name)
| summarize vi_count = count(), by: {fv.name, statusCurrent}
| sort fv.name asc, statusCurrent asc
`;

/** Fix version slippage — VIs whose fix version moved (delta > 0) */
export const fixVersionSlippageQuery = () => `
fetch bizevents, from: now() - 7d
| filter event.provider == "valueincrement.analzyer"
| filter matchesValue(owningProgram, "Platform Apps")
| filter statusCurrent != "Closed"
| dedup key, sort: timestamp desc
| filter fixVersionDeltaMonths > 0
| filter fixVersionDeltaMonths <= 6
| parse fixVersion, "JSON:fv"
| fieldsFlatten fv, prefix: "fv."
| parse fixVersionInitial, "JSON:fvi"
| fieldsFlatten fvi, prefix: "fvi."
| fields key, summary, statusCurrent, fixVersionDeltaMonths, fvi.name, fv.name, statusUpdateDaysAgo
| sort fixVersionDeltaMonths desc
`;

/** VIs missing fix version at implementation start */
export const missingFvAtStartQuery = () => `
fetch bizevents, from: now() - 7d
| filter event.provider == "valueincrement.analzyer"
| filter matchesValue(owningProgram, "Platform Apps")
| filter statusCurrent != "Closed"
| filter fixVersionSetOnImplementationStart == false
| dedup key, sort: timestamp desc
| parse fixVersion, "JSON:fv"
| fieldsFlatten fv, prefix: "fv."
| fieldsAdd currentFv = if(isNull(fv.name), "\u26a0 MUST ADD", else: fv.name)
| fieldsAdd daysSinceUpdate = if(isNull(statusUpdateDaysAgo), -1, else: statusUpdateDaysAgo)
| fieldsAdd tel = replaceString(arrayFirst(splitString(executionAssignee, "@")), ".", " ")
| fields key, summary, statusCurrent, currentFv, daysSinceUpdate, tel
| sort daysSinceUpdate desc
`;

/** Delivery KPI summary — counts for hero cards */
export const deliveryKpiQuery = () => `
fetch bizevents, from: now() - 7d
| filter event.provider == "valueincrement.analzyer"
| filter matchesValue(owningProgram, "Platform Apps")
| filter statusCurrent != "Closed"
| dedup key, sort: timestamp desc
| summarize
    total = count(),
    slipped = countIf(fixVersionDeltaMonths > 0 AND fixVersionDeltaMonths <= 6),
    no_fv_at_start = countIf(fixVersionSetOnImplementationStart == false),
    stale_updates = countIf(statusUpdateDaysAgo > 14)
`;

/** Drill-down: VIs for a specific fix version (for Delivery Timeline click-through) */
export const visByFixVersionQuery = (fvName: string) => `
fetch bizevents, from: now() - 7d
| filter event.provider == "valueincrement.analzyer"
| filter matchesValue(owningProgram, "Platform Apps")
| filter statusCurrent != "Closed"
| dedup key, sort: timestamp desc
| parse fixVersion, "JSON:fv"
| fieldsFlatten fv, prefix: "fv."
| filter fv.name == "${fvName}"
| fields key, summary, statusCurrent, fv.name, statusUpdateDaysAgo, executionAssignee
| sort statusCurrent asc, key asc
`;

/** Drill-down: VIs with fix version slippage (for Health Snapshot click-through) */
export const slippedVisDetailQuery = () => `
fetch bizevents, from: now() - 7d
| filter event.provider == "valueincrement.analzyer"
| filter matchesValue(owningProgram, "Platform Apps")
| filter statusCurrent != "Closed"
| filter fixVersionDeltaMonths > 0
| filter fixVersionDeltaMonths <= 6
| dedup key, sort: timestamp desc
| parse fixVersion, "JSON:fv"
| fieldsFlatten fv, prefix: "fv."
| fields key, summary, statusCurrent, fixVersionDeltaMonths, fv.name
| sort fixVersionDeltaMonths desc
`;

/** Drill-down: VIs missing fix version at implementation start */
export const noFvAtStartDetailQuery = () => `
fetch bizevents, from: now() - 7d
| filter event.provider == "valueincrement.analzyer"
| filter matchesValue(owningProgram, "Platform Apps")
| filter statusCurrent != "Closed"
| filter fixVersionSetOnImplementationStart == false
| dedup key, sort: timestamp desc
| parse fixVersion, "JSON:fv"
| fieldsFlatten fv, prefix: "fv."
| fieldsAdd currentFv = if(isNull(fv.name), "\u26a0 MUST ADD", else: fv.name)
| fieldsAdd daysSinceUpdate = if(isNull(statusUpdateDaysAgo), -1, else: statusUpdateDaysAgo)
| fieldsAdd tel = replaceString(arrayFirst(splitString(executionAssignee, "@")), ".", " ")
| fields key, summary, statusCurrent, currentFv, daysSinceUpdate, tel
| sort daysSinceUpdate desc
`;

/** Drill-down: VIs with stale status updates (>14 days) */
export const staleUpdateVisDetailQuery = () => `
fetch bizevents, from: now() - 7d
| filter event.provider == "valueincrement.analzyer"
| filter matchesValue(owningProgram, "Platform Apps")
| filter statusCurrent != "Closed"
| filter statusUpdateDaysAgo > 14
| dedup key, sort: timestamp desc
| parse fixVersion, "JSON:fv"
| fieldsFlatten fv, prefix: "fv."
| fields key, summary, statusCurrent, fv.name, statusUpdateDaysAgo
| sort statusUpdateDaysAgo desc
`;

/** Rally milestones that PAPA VIs contribute to */
export const rallyMilestonesQuery = () => `
fetch bizevents, from: now() - 7d
| filter event.provider == "jira_daily_snapshot"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| filter issuetype == "ValueIncrement"
| dedup key, sort: timestamp desc
| fieldsAdd nonEmptyIssueLinks = if(arraySize(issuelinks) == 0, "{\\\"type\\\":\\\"fake\\\",\\\"key\\\":\\\"0\\\"}", else: issuelinks)
| fieldsAdd parsed_links = arrayFlatten(parse(concat("[", nonEmptyIssueLinks, "]"), "JSON_ARRAY:json"))
| expand parsed_links
| fieldsFlatten parsed_links, prefix: "link."
| filter link.type == "enables"
| lookup [fetch bizevents, from: now() - 30d | filter event.type == "milestone.status" | dedup key, sort: timestamp desc], sourceField:link.key, lookupField:key, fields: { ms_summary = summary, ms_program = programName, ms_progress = progress }
| filter isNotNull(ms_summary)
| summarize vi_count = countDistinct(key), by: { link.key, ms_summary, ms_program, ms_progress }
| sort ms_program desc, ms_progress asc
`;

/** VIs linked to a specific rally milestone */
export const rallyMilestoneVisQuery = (milestoneKey: string) => `
fetch bizevents, from: now() - 7d
| filter event.provider == "jira_daily_snapshot"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| filter issuetype == "ValueIncrement"
| dedup key, sort: timestamp desc
| fieldsAdd nonEmptyIssueLinks = if(arraySize(issuelinks) == 0, "{\\\"type\\\":\\\"fake\\\",\\\"key\\\":\\\"0\\\"}", else: issuelinks)
| fieldsAdd parsed_links = arrayFlatten(parse(concat("[", nonEmptyIssueLinks, "]"), "JSON_ARRAY:json"))
| expand parsed_links
| fieldsFlatten parsed_links, prefix: "link."
| filter link.type == "enables" AND link.key == "${milestoneKey}"
| fields key, summary, status, fixVersions, \`Execution Assignee\`
| sort status asc, key asc
`;

// ─── Production Health Queries ────────────────────────────────

/**
 * PAPA app frontend names — maps to `frontend.name` in RUM data.
 * These are the Dynatrace app IDs as they appear in Real User Monitoring.
 * In this demo env these may not exist; in production they map to real apps.
 */
export const PAPA_FRONTENDS: Record<string, string> = {
  "dynatrace.dashboards": "Dashboards",
  "dynatrace.notebooks": "Notebooks",
  "dynatrace.smartscape": "Smartscape",
  "dynatrace.launcher": "Launcher",
  "dynatrace.search": "Search Service",
  "dynatrace.appshell": "AppShell",
  "dynatrace.dock": "Dock",
  "dynatrace.segments": "Segments",
};

/** All PAPA frontend.name values */
const PAPA_FRONTEND_NAMES = Object.keys(PAPA_FRONTENDS);

/** Human-readable display names */
export const PAPA_APP_NAMES = Object.values(PAPA_FRONTENDS);

/** Build a DQL filter matching any PAPA frontend */
function papaFrontendFilter(field = "frontend.name"): string {
  return PAPA_FRONTEND_NAMES.map((f) => `${field} == "${f}"`).join(" or ");
}

/** Build a DQL filter matching any PAPA app name in the problem's affected_entity_names */
function papaProblemFilter(): string {
  return PAPA_APP_NAMES.map((app) => `contains(affected_entity_names, "${app}")`).join(" or ");
}

// ── RUM: User actions, errors, sessions ──

/** User action volume per PAPA app (last 2h) */
export const userActionVolumeQuery = () => `
timeseries actions = sum(dt.frontend.user_action.count), from:now()-2h, by:{frontend.name}
| filter ${papaFrontendFilter()}
| fieldsAdd total_actions = arraySum(actions)
| sort total_actions desc
`;

/** Error rate per PAPA app (last 2h) */
export const frontendErrorRateQuery = () => `
timeseries {
  errors = sum(dt.frontend.error.count),
  requests = sum(dt.frontend.request.count)
}, from:now()-2h, by:{frontend.name}
| filter ${papaFrontendFilter()}
| fieldsAdd total_errors = arraySum(errors), total_requests = arraySum(requests)
| fieldsAdd error_rate_pct = if(total_requests > 0, (total_errors * 100.0) / total_requests, else: 0.0)
| sort error_rate_pct desc
| fields frontend.name, error_rate_pct, total_errors, total_requests
`;

/** Frontend error trend per app (last 24h, 1h buckets) */
export const frontendErrorTrendQuery = () => `
timeseries errors = sum(dt.frontend.error.count), from:now()-24h, by:{frontend.name}, interval: 1h
| filter ${papaFrontendFilter()}
`;

/** Active sessions per PAPA app (last 2h) */
export const activeSessionsQuery = () => `
timeseries sessions = sum(dt.frontend.session.active.estimated_count), from:now()-2h, by:{frontend.name}
| filter ${papaFrontendFilter()}
| fieldsAdd total_sessions = arraySum(sessions)
| sort total_sessions desc
`;

/** Top JavaScript exceptions per PAPA app (last 2h) */
export const topExceptionsQuery = () => `
fetch user.events, from:now()-2h
| filter error.type == "exception"
| filter ${papaFrontendFilter()}
| summarize exception_count = count(), affected_sessions = countDistinct(dt.rum.session.id), by: { frontend.name, exception.message }
| sort exception_count desc
| limit 20
`;

/** Request error breakdown per PAPA app (last 2h) */
export const requestErrorsQuery = () => `
fetch user.events, from:now()-2h
| filter error.type == "request"
| filter ${papaFrontendFilter()}
| summarize error_count = count(), affected_sessions = countDistinct(dt.rum.session.id), by: { frontend.name, error.display_name }
| sort error_count desc
| limit 20
`;

// ── Core Web Vitals ──

/** Web Vitals summary per PAPA app (p75, last 2h) */
export const webVitalsSummaryQuery = () => `
fetch user.events, from:now()-2h
| filter ${papaFrontendFilter()}
| filter isNotNull(web_vitals.largest_contentful_paint) or isNotNull(web_vitals.interaction_to_next_paint) or isNotNull(web_vitals.cumulative_layout_shift)
| summarize
    lcp_p75 = percentile(web_vitals.largest_contentful_paint, 75),
    inp_p75 = percentile(web_vitals.interaction_to_next_paint, 75),
    cls_p75 = percentile(web_vitals.cumulative_layout_shift, 75),
    samples = count(),
    by: { frontend.name }
| sort frontend.name asc
`;

// ── Davis Problems ──

/** Active Davis problems for PAPA apps — by category */
export const activeProblemsByCategoryQuery = () => `
fetch events, from:now()-24h
| filter event.kind == "DAVIS_PROBLEM"
| filter event.status == "ACTIVE"
| filter ${papaProblemFilter()}
| summarize problem_count = count(), by: { event.category }
| sort problem_count desc
`;

/** Problem trend — opened problems per day over last 7 days — scoped to PAPA apps */
export const problemTrendQuery = () => `
fetch events, from:now()-7d
| filter event.kind == "DAVIS_PROBLEM"
| filter ${papaProblemFilter()}
| makeTimeseries problem_count = count(), interval: 1d
`;

/** Recent active problems for PAPA apps — detail table */
export const recentProblemsQuery = () => `
fetch events, from:now()-24h
| filter event.kind == "DAVIS_PROBLEM"
| filter event.status == "ACTIVE"
| filter ${papaProblemFilter()}
| fields display_id, title, event.category, affected_entity_names, timestamp
| sort timestamp desc
| limit 25
`;
