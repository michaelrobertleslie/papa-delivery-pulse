/**
 * DQL queries for PAPA delivery tracking.
 * Data source: jira_daily.valueincrement bizevents in Grail.
 */

/** How many days back to look for changes */
export const LOOKBACK_DAYS = 14;

/** Fix Version / Sprint change detection */
export const fvSprintChangesQuery = (days: number = LOOKBACK_DAYS) => `
fetch bizevents, from:now()-${days}d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| filter isNotNull(fixVersions) or isNotNull(Sprint)
| sort timestamp asc
| summarize
    earliest_fv = first(fixVersions),
    latest_fv = last(fixVersions),
    earliest_sprint = first(Sprint),
    latest_sprint = last(Sprint),
    latest_status = last(status),
    latest_summary = last(summary),
    records = count(),
    by: { key }
| filter earliest_fv != latest_fv or earliest_sprint != latest_sprint
| sort key asc
`;

/** Delivery status changes (items moving to Closed, Post GA, Release Preparation, etc.) */
export const deliveryUpdatesQuery = (days: number = LOOKBACK_DAYS) => `
fetch bizevents, from:now()-${days}d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| sort timestamp asc
| summarize
    earliest_status = first(status),
    latest_status = last(status),
    latest_fv = last(fixVersions),
    latest_summary = last(summary),
    records = count(),
    by: { key }
| filter earliest_status != latest_status
| sort key asc
`;

/** Portfolio overview — all active PAPA VIs grouped by status */
export const portfolioQuery = () => `
fetch bizevents, from:now()-1d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| sort timestamp desc
| summarize
    latest_status = last(status),
    latest_fv = last(fixVersions),
    latest_summary = last(summary),
    by: { key }
| summarize count(), by: { latest_status }
| sort count() desc
`;

/** Items with no update in 30+ days (stale detection) */
export const staleItemsQuery = () => `
fetch bizevents, from:now()-90d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| summarize
    last_seen = last(timestamp),
    latest_status = last(status),
    latest_summary = last(summary),
    latest_fv = last(fixVersions),
    by: { key }
| filter last_seen < now()-30d
| filter not(matchesValue(latest_status, "Closed"))
| filter not(matchesValue(latest_status, "Post GA"))
| sort last_seen asc
`;

/** Near future — items entering Implementation */
export const nearFutureQuery = (days: number = LOOKBACK_DAYS) => `
fetch bizevents, from:now()-${days}d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| sort timestamp asc
| summarize
    earliest_status = first(status),
    latest_status = last(status),
    latest_fv = last(fixVersions),
    latest_summary = last(summary),
    records = count(),
    by: { key }
| filter latest_status == "Implementation" and earliest_status != "Implementation"
| sort key asc
`;

/** Full VI list — latest snapshot of all PAPA items */
export const allItemsQuery = () => `
fetch bizevents, from:now()-1d
| filter event.type == "jira_daily.valueincrement"
| filter matchesValue(\`owning Program\`, "Platform Apps")
| sort timestamp desc
| summarize
    latest_status = last(status),
    latest_fv = last(fixVersions),
    latest_sprint = last(Sprint),
    latest_summary = last(summary),
    by: { key }
| sort latest_status asc, key asc
`;
