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
}

/** Build filter lines from optional filters */
function filterLines(f?: QueryFilters): string {
  let lines = "";
  if (f?.executionAssignee) {
    lines += `\n| filter \`Execution Assignee\` == "${f.executionAssignee}"`;
  }
  if (f?.component) {
    lines += `\n| filter matchesValue(components, "*${f.component}*")`;
  }
  return lines;
}

/** Execution Assignee list for filter dropdown */
export const assigneeListQuery = () => `
fetch bizevents, from:now()-7d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| sort timestamp desc
| summarize latest_status = last(status), by: { key, \`Execution Assignee\` }
| filter not(matchesValue(latest_status, "Closed"))
| filter not(matchesValue(latest_status, "Cancelled"))
| filter isNotNull(\`Execution Assignee\`)
| summarize item_count = count(), by: { \`Execution Assignee\` }
| sort item_count desc
`;

/** Component list for filter dropdown */
export const componentListQuery = () => `
fetch bizevents, from:now()-7d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| sort timestamp desc
| summarize latest_status = last(status), latest_components = last(components), by: { key }
| filter not(matchesValue(latest_status, "Closed"))
| filter not(matchesValue(latest_status, "Cancelled"))
| filter not(matchesValue(latest_components, "[]"))
| summarize item_count = count(), by: { latest_components }
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

/** Items with no update in 30+ days (stale detection) */
export const staleItemsQuery = (f?: QueryFilters) => `
fetch bizevents, from:now()-90d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")${filterLines(f)}
| summarize
    last_seen = last(timestamp),
    latest_status = last(status),
    latest_summary = last(summary),
    latest_fv = last(fixVersions),
    latest_assignee = last(\`Execution Assignee\`),
    latest_reporter = last(reporter),
    status_details = last(\`Status details\`),
    by: { key }
| filter last_seen < now()-30d
| filter not(matchesValue(latest_status, "Closed"))
| filter not(matchesValue(latest_status, "Post GA"))
| filter not(matchesValue(latest_status, "Cancelled"))
| sort last_seen asc
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
    by: { key }
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

