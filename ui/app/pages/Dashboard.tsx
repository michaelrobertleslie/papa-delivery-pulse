import React, { useState, useMemo } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { Select, SelectOption } from "@dynatrace/strato-components/forms";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { ResultRecord } from "@dynatrace-sdk/client-query";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import {
  fvSprintChangesQuery,
  deliveryUpdatesQuery,
  portfolioQuery,
  staleItemsQuery,
  nearFutureQuery,
  activePortfolioQuery,
  portfolioByAssigneeQuery,
  assigneeListQuery,
  componentListQuery,
  LOOKBACK_DAYS,
  type QueryFilters,
} from "../queries";

const JIRA_BASE = "https://dt-rnd.atlassian.net/browse/";

/** Render a Jira key as a clickable link opening in a new tab */
function JiraLink({ value }: { value: unknown }) {
  const key = String(value ?? "");
  if (!key) return <span>—</span>;
  return (
    <a
      href={`${JIRA_BASE}${key}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{ color: "#818cf8", textDecoration: "none", fontWeight: 600 }}
    >
      {key}
    </a>
  );
}

/** Render an assignee name as a clickable filter trigger */
function AssigneeCell({ value, onFilter }: { value: unknown; onFilter?: (name: string) => void }) {
  const name = String(value ?? "");
  if (!name || name === "null") return <span style={{ opacity: 0.4 }}>Unassigned</span>;
  return onFilter ? (
    <a
      onClick={(e) => { e.stopPropagation(); onFilter(name); }}
      style={{ color: "#a5b4fc", cursor: "pointer", textDecoration: "none" }}
      title={`Filter by ${name}`}
    >
      {name}
    </a>
  ) : (
    <span>{name}</span>
  );
}

/** Parse text and turn URLs into clickable links */
function RichText({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s)<>]+)/g;
  const parts = text.split(urlRegex);
  return (
    <span>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "#818cf8", wordBreak: "break-all" }}
          >
            {part.length > 80 ? part.slice(0, 77) + "…" : part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

type Col = DataTableColumnDef<ResultRecord>;

/* ── Column factory (adds Jira link + clickable assignee) ──── */
function makeColumns(
  cols: { id: string; accessor: string; header: string; minWidth?: number }[],
  onFilterAssignee?: (name: string) => void,
): Col[] {
  return cols.map((c) => {
    if (c.accessor === "key") {
      return { ...c, cell: ({ value }: { value: unknown }) => <JiraLink value={value} /> };
    }
    if (c.accessor === "latest_assignee" && onFilterAssignee) {
      return { ...c, cell: ({ value }: { value: unknown }) => <AssigneeCell value={value} onFilter={onFilterAssignee} /> };
    }
    return c;
  });
}

const changeColumnDefs = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130 },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 260 },
  { id: "latest_assignee", accessor: "latest_assignee", header: "Assignee", minWidth: 140 },
  { id: "earliest_fv", accessor: "earliest_fv", header: "Prev FV" },
  { id: "latest_fv", accessor: "latest_fv", header: "New FV" },
  { id: "earliest_sprint", accessor: "earliest_sprint", header: "Prev Sprint" },
  { id: "latest_sprint", accessor: "latest_sprint", header: "New Sprint" },
];

const deliveryColumnDefs = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130 },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 260 },
  { id: "latest_assignee", accessor: "latest_assignee", header: "Assignee", minWidth: 140 },
  { id: "earliest_status", accessor: "earliest_status", header: "From" },
  { id: "latest_status", accessor: "latest_status", header: "To" },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version" },
];

const staleColumnDefs = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130 },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 260 },
  { id: "latest_assignee", accessor: "latest_assignee", header: "Assignee", minWidth: 140 },
  { id: "latest_status", accessor: "latest_status", header: "Status" },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version" },
  { id: "last_seen", accessor: "last_seen", header: "Last Seen" },
];

const nearFutureColumnDefs = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130 },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 260 },
  { id: "latest_assignee", accessor: "latest_assignee", header: "Assignee", minWidth: 140 },
  { id: "earliest_status", accessor: "earliest_status", header: "From" },
  { id: "latest_status", accessor: "latest_status", header: "To" },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version" },
];

const portfolioTableColumns: Col[] = [
  { id: "latest_status", accessor: "latest_status", header: "Status", minWidth: 200 },
  { id: "count", accessor: "item_count", header: "Count" },
];

/* ── Signal colors for KPI cards ────────────────────────────── */
const signalStyles = {
  neutral: { bg: "#1a1a2e", border: "#2d2d50", text: "#a0a0c0" },
  warning: { bg: "#2e2a1a", border: "#504d2d", text: "#eab308" },
  success: { bg: "#1a2e1a", border: "#2d502d", text: "#22c55e" },
  danger:  { bg: "#2e1a1a", border: "#502d2d", text: "#ef4444" },
  info:    { bg: "#1a1a2e", border: "#2d3d60", text: "#6366f1" },
};

/* ── KPI Card ───────────────────────────────────────────────── */
function KpiCard({
  label,
  value,
  signal = "neutral",
  loading = false,
  subtitle,
}: {
  label: string;
  value: string | number;
  signal?: keyof typeof signalStyles;
  loading?: boolean;
  subtitle?: string;
}) {
  const c = signalStyles[signal];
  return (
    <Flex
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={4}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: "24px 32px",
        minWidth: 170,
        flex: "1 1 0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow accent */}
      <span style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: 80,
        height: 3,
        borderRadius: "0 0 4px 4px",
        background: c.text,
        opacity: 0.6,
      }} />
      {loading ? (
        <ProgressCircle size="small" />
      ) : (
        <span style={{ fontSize: 42, fontWeight: 800, color: c.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
      )}
      <span style={{ fontSize: 11, fontWeight: 600, color: c.text, opacity: 0.9, textTransform: "uppercase", letterSpacing: 1.5 }}>
        {label}
      </span>
      {subtitle && (
        <span style={{ fontSize: 10, color: c.text, opacity: 0.5, marginTop: 2 }}>
          {subtitle}
        </span>
      )}
    </Flex>
  );
}

/* ── Hero KPI Row ───────────────────────────────────────────── */
function HeroStats({ filters }: { filters: QueryFilters }) {
  const portfolio = useDql({ query: portfolioQuery(filters) });
  const fvChanges = useDql({ query: fvSprintChangesQuery(LOOKBACK_DAYS, filters) });
  const delivery = useDql({ query: deliveryUpdatesQuery(LOOKBACK_DAYS, filters) });
  const stale = useDql({ query: staleItemsQuery(filters) });

  const totalItems = portfolio.data?.records?.reduce(
    (sum, r) => sum + (Number(r.item_count) || 0), 0
  ) ?? 0;

  const fvCount = fvChanges.data?.records?.length ?? 0;
  const deliveryCount = delivery.data?.records?.length ?? 0;
  const staleCount = stale.data?.records?.length ?? 0;

  const anyLoading = portfolio.isLoading || fvChanges.isLoading || delivery.isLoading || stale.isLoading;

  return (
    <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
      <KpiCard label="Active VIs" value={totalItems} signal="info" loading={anyLoading} subtitle="across all statuses" />
      <KpiCard label="Schedule Shifts" value={fvCount} signal={fvCount > 0 ? "warning" : "success"} loading={anyLoading} subtitle={`last ${LOOKBACK_DAYS}d`} />
      <KpiCard label="Status Moves" value={deliveryCount} signal={deliveryCount > 0 ? "success" : "neutral"} loading={anyLoading} subtitle={`last ${LOOKBACK_DAYS}d`} />
      <KpiCard label="Stale Items" value={staleCount} signal={staleCount > 3 ? "danger" : staleCount > 0 ? "warning" : "success"} loading={anyLoading} subtitle="30+ days silent" />
    </Flex>
  );
}

/* ── Charts Row ─────────────────────────────────────────────── */
function ChartsRow({ filters }: { filters: QueryFilters }) {
  const statusResult = useDql({ query: activePortfolioQuery(filters) });
  const assigneeResult = useDql({ query: portfolioByAssigneeQuery(filters) });

  const statusData = useMemo(() => {
    const records = statusResult.data?.records ?? [];
    return records.map((r) => ({
      category: String(r.latest_status ?? "Unknown"),
      value: Number(r.item_count) || 0,
    }));
  }, [statusResult.data]);

  const assigneeData = useMemo(() => {
    const records = assigneeResult.data?.records ?? [];
    return records.map((r) => ({
      category: String(r.latest_assignee ?? "Unassigned"),
      value: Number(r.item_count) || 0,
    }));
  }, [assigneeResult.data]);

  const anyLoading = statusResult.isLoading || assigneeResult.isLoading;

  return (
    <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
      {/* Status breakdown */}
      <Surface style={{ flex: "1 1 45%", minWidth: 340 }}>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Heading level={4}>Active VIs by Status</Heading>
          {anyLoading ? (
            <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
          ) : statusData.length > 0 ? (
            <CategoricalBarChart data={statusData} layout="horizontal" />
          ) : (
            <Paragraph style={{ opacity: 0.5 }}>No data</Paragraph>
          )}
        </Flex>
      </Surface>

      {/* Assignee breakdown */}
      <Surface style={{ flex: "1 1 45%", minWidth: 340 }}>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Heading level={4}>VIs by Execution Assignee</Heading>
          {anyLoading ? (
            <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
          ) : assigneeData.length > 0 ? (
            <CategoricalBarChart data={assigneeData} layout="horizontal" />
          ) : (
            <Paragraph style={{ opacity: 0.5 }}>No data</Paragraph>
          )}
        </Flex>
      </Surface>
    </Flex>
  );
}

/* ── Row Detail (expandable) ────────────────────────────────── */
function RowDetail({ row }: { row: ResultRecord }) {
  const details = String(row.status_details ?? "");
  const key = String(row.key ?? "");
  const status = String(row.latest_status ?? row.earliest_status ?? "");
  const fv = String(row.latest_fv ?? "—");
  const assignee = String(row.latest_assignee ?? "Unassigned");

  const lines = details
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return (
    <Flex flexDirection="column" gap={12} padding={16} style={{ borderLeft: "3px solid #6366f1", marginLeft: 8 }}>
      {/* Header row */}
      <Flex gap={24} flexFlow="wrap" alignItems="center">
        <Flex flexDirection="column" gap={2}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.5 }}>Key</span>
          <Strong><JiraLink value={key} /></Strong>
        </Flex>
        <Flex flexDirection="column" gap={2}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.5 }}>Status</span>
          <span style={{ fontWeight: 600 }}>{status}</span>
        </Flex>
        <Flex flexDirection="column" gap={2}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.5 }}>Fix Version</span>
          <span>{fv}</span>
        </Flex>
        <Flex flexDirection="column" gap={2}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.5 }}>Assignee</span>
          <span>{assignee}</span>
        </Flex>
      </Flex>

      {/* Status details */}
      <Flex flexDirection="column" gap={4}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.5, fontWeight: 600 }}>
          Status Details
        </span>
        {lines.length > 0 ? (
          <Flex flexDirection="column" gap={4} style={{ fontSize: 13, lineHeight: 1.5 }}>
            {lines.map((line, i) => (
              <span key={i} style={{ opacity: i === 0 ? 1 : 0.7 }}>
                <RichText text={line} />
              </span>
            ))}
          </Flex>
        ) : (
          <Paragraph style={{ opacity: 0.4, fontStyle: "italic", fontSize: 13 }}>
            No status details available
          </Paragraph>
        )}
      </Flex>
    </Flex>
  );
}

/* ── Section Card ───────────────────────────────────────────── */
function SectionCard({
  title,
  subtitle,
  query,
  tableColumns,
  emptyMessage = "No changes detected",
  accentColor = "#6366f1",
  expandable = true,
  pageSize,
  onFilterAssignee,
}: {
  title: string;
  subtitle: string;
  query: string;
  tableColumns: Col[];
  emptyMessage?: string;
  accentColor?: string;
  expandable?: boolean;
  pageSize?: number;
  onFilterAssignee?: (name: string) => void;
}) {
  const { data, error, isLoading } = useDql({ query });
  const records = data?.records ?? [];
  const columns = useMemo(
    () => makeColumns(tableColumns as any, onFilterAssignee),
    [tableColumns, onFilterAssignee],
  );

  return (
    <Surface>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Flex alignItems="center" gap={12}>
          <span style={{
            width: 4,
            height: 28,
            borderRadius: 2,
            background: accentColor,
            flexShrink: 0,
          }} />
          <Flex flexDirection="column" gap={2}>
            <Heading level={3}>{title}</Heading>
            <Paragraph style={{ opacity: 0.6, fontSize: 13 }}>{subtitle}</Paragraph>
          </Flex>
          {!isLoading && !error && (
            <span style={{
              marginLeft: "auto",
              background: records.length > 0 ? accentColor : "transparent",
              color: records.length > 0 ? "#fff" : "inherit",
              borderRadius: 20,
              padding: "4px 14px",
              fontSize: 13,
              fontWeight: 600,
              border: records.length > 0 ? "none" : "1px solid rgba(255,255,255,0.15)",
            }}>
              {records.length} {records.length === 1 ? "item" : "items"}
            </span>
          )}
        </Flex>

        {isLoading && (
          <Flex justifyContent="center" padding={16}>
            <ProgressCircle />
          </Flex>
        )}

        {error && (
          <Paragraph style={{ color: Colors.Text.Critical.Default }}>
            Query error: {error.message}
          </Paragraph>
        )}

        {!isLoading && !error && records.length === 0 && (
          <Paragraph style={{ padding: "8px 0", opacity: 0.5, fontStyle: "italic" }}>
            {emptyMessage} in the last {LOOKBACK_DAYS} days.
          </Paragraph>
        )}

        {!isLoading && !error && records.length > 0 && (
          <DataTable data={records} columns={columns}>
            {expandable && (
              <DataTable.ExpandableRow>
                {({ row }) => <RowDetail row={row as ResultRecord} />}
              </DataTable.ExpandableRow>
            )}
            {pageSize && <DataTable.Pagination defaultPageSize={pageSize} />}
          </DataTable>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Filter Bar ─────────────────────────────────────────────── */
function FilterBar({
  filters,
  setFilters,
}: {
  filters: QueryFilters;
  setFilters: React.Dispatch<React.SetStateAction<QueryFilters>>;
}) {
  const { data: assigneeData } = useDql({ query: assigneeListQuery() });
  const { data: componentData } = useDql({ query: componentListQuery() });
  const assignees = assigneeData?.records ?? [];
  const components = componentData?.records ?? [];

  return (
    <Surface>
      <Flex gap={16} padding={16} alignItems="flex-end" flexFlow="wrap">
        <Flex flexDirection="column" gap={4} style={{ minWidth: 240 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, opacity: 0.6 }}>
            Execution Assignee
          </label>
          <Select
            value={filters.executionAssignee ?? ""}
            onChange={(value) => {
              const val = value && value !== "" ? String(value) : null;
              setFilters((prev) => ({ ...prev, executionAssignee: val }));
            }}
          >
            <SelectOption value="">All assignees</SelectOption>
            {assignees.map((a) => (
              <SelectOption key={String(a["Execution Assignee"])} value={String(a["Execution Assignee"])}>
                {String(a["Execution Assignee"])} ({String(a.item_count)})
              </SelectOption>
            ))}
          </Select>
        </Flex>
        <Flex flexDirection="column" gap={4} style={{ minWidth: 240 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, opacity: 0.6 }}>
            Component
          </label>
          <Select
            value={filters.component ?? ""}
            onChange={(value) => {
              const val = value && value !== "" ? String(value) : null;
              setFilters((prev) => ({ ...prev, component: val }));
            }}
          >
            <SelectOption value="">All components</SelectOption>
            {components.map((c) => (
              <SelectOption key={String(c.latest_components)} value={String(c.latest_components)}>
                {String(c.latest_components)} ({String(c.item_count)})
              </SelectOption>
            ))}
          </Select>
        </Flex>
        {(filters.executionAssignee || filters.component) && (
          <button
            onClick={() => setFilters({ executionAssignee: null, component: null })}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 6,
              padding: "6px 14px",
              color: "inherit",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Clear filters
          </button>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Main Dashboard ─────────────────────────────────────────── */
export const Dashboard = () => {
  const [filters, setFilters] = useState<QueryFilters>({
    executionAssignee: null,
    component: null,
  });

  const handleFilterAssignee = (name: string) => {
    setFilters((prev) => ({ ...prev, executionAssignee: name }));
  };

  const filterLabel = filters.executionAssignee
    ? `Filtered: ${filters.executionAssignee}`
    : "All Platform Apps";

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      {/* Hero header */}
      <Flex flexDirection="column" gap={4}>
        <Heading>PAPA Delivery Pulse</Heading>
        <Paragraph style={{ opacity: 0.6 }}>
          Platform Apps delivery health — powered by Grail bizevents
          &nbsp;·&nbsp; Last <Strong>{LOOKBACK_DAYS} days</Strong>
          &nbsp;·&nbsp; {filterLabel}
        </Paragraph>
      </Flex>

      {/* Filter bar */}
      <FilterBar filters={filters} setFilters={setFilters} />

      {/* KPI row */}
      <HeroStats filters={filters} />

      {/* Charts */}
      <ChartsRow filters={filters} />

      {/* Detail sections */}
      <SectionCard
        title="Portfolio Overview"
        subtitle="All value increments grouped by current status"
        query={portfolioQuery(filters)}
        tableColumns={portfolioTableColumns}
        emptyMessage="No PAPA items found"
        accentColor="#6366f1"
        expandable={false}
      />

      <SectionCard
        title="Fix Version & Sprint Changes"
        subtitle="Schedule shifts detected — fix version or sprint changed"
        query={fvSprintChangesQuery(LOOKBACK_DAYS, filters)}
        tableColumns={changeColumnDefs}
        accentColor="#f59e0b"
        onFilterAssignee={handleFilterAssignee}
      />

      <SectionCard
        title="Delivery Status Changes"
        subtitle="Items that moved status — completed, post-GA, release prep"
        query={deliveryUpdatesQuery(LOOKBACK_DAYS, filters)}
        tableColumns={deliveryColumnDefs}
        accentColor="#22c55e"
        onFilterAssignee={handleFilterAssignee}
      />

      <SectionCard
        title="Entering Implementation"
        subtitle="Items recently moved into Implementation — near future"
        query={nearFutureQuery(LOOKBACK_DAYS, filters)}
        tableColumns={nearFutureColumnDefs}
        accentColor="#3b82f6"
        onFilterAssignee={handleFilterAssignee}
      />

      <SectionCard
        title="Stale Items"
        subtitle="Open items with no update in 30+ days — potential risks"
        query={staleItemsQuery(filters)}
        tableColumns={staleColumnDefs}
        emptyMessage="No stale items found"
        accentColor="#ef4444"
        pageSize={50}
        onFilterAssignee={handleFilterAssignee}
      />
    </Flex>
  );
};
