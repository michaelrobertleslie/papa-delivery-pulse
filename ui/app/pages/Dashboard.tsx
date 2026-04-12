import React, { useState, useMemo } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { Select, SelectOption, SelectContent } from "@dynatrace/strato-components/forms";
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
  portfolioItemsQuery,
  staleItemsQuery,
  nearFutureQuery,
  activePortfolioQuery,
  portfolioByAssigneeQuery,
  componentBreakdownQuery,
  deliveryKpiQuery,
  fixVersionSlippageQuery,
  missingFvAtStartQuery,
  deliveryTimelineQuery,
  visByFixVersionQuery,
  slippedVisDetailQuery,
  noFvAtStartDetailQuery,
  staleUpdateVisDetailQuery,
  rallyMilestonesQuery,
  rallyMilestoneVisQuery,
  LOOKBACK_DAYS,
  type QueryFilters,
} from "../queries";

const JIRA_BASE = "https://dt-rnd.atlassian.net/browse/";

/** Render a Jira key as a clickable link opening in a new tab */
function JiraLink({ value }: { value: unknown }) {
  const key = String(value ?? "");
  if (!key) return <span style={{ display: "flex", alignItems: "center", height: "100%" }}>—</span>;
  return (
    <a
      href={`${JIRA_BASE}${key}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{ color: "#818cf8", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", height: "100%" }}
    >
      {key}
    </a>
  );
}

/** Render an assignee name as a clickable filter trigger */
function AssigneeCell({ value, onFilter }: { value: unknown; onFilter?: (name: string) => void }) {
  const name = String(value ?? "");
  const centerStyle: React.CSSProperties = { display: "flex", alignItems: "center", height: "100%" };
  if (!name || name === "null" || name === "undefined") return <span style={{ ...centerStyle, opacity: 0.4 }}>Unassigned</span>;
  if (!onFilter) return <span style={centerStyle}>{name}</span>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onFilter(name); }}
      style={{
        ...centerStyle,
        background: "none",
        border: "none",
        padding: 0,
        color: "#a5b4fc",
        cursor: "pointer",
        textDecoration: "underline",
        textDecorationStyle: "dotted",
        textUnderlineOffset: "3px",
        fontSize: "inherit",
        fontFamily: "inherit",
      }}
      title={`Filter by ${name}`}
    >
      {name}
    </button>
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
  cols: { id: string; accessor: string; header: string; minWidth?: number; alignment?: "left" | "center" | "right" }[],
  onFilterAssignee?: (name: string) => void,
): Col[] {
  return cols.map((c) => {
    if (c.accessor === "key") {
      return { ...c, cell: ({ value }: { value: unknown }) => <JiraLink value={value} /> };
    }
    if ((c.accessor === "latest_assignee" || c.accessor === "latest_reporter") && onFilterAssignee) {
      return { ...c, cell: ({ value }: { value: unknown }) => <AssigneeCell value={value} onFilter={onFilterAssignee} /> };
    }
    return c;
  });
}

const changeColumnDefs = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130, alignment: "center" as const },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 260 },
  { id: "latest_assignee", accessor: "latest_assignee", header: "TEL", minWidth: 140, alignment: "center" as const },
  { id: "latest_reporter", accessor: "latest_reporter", header: "PM", minWidth: 140, alignment: "center" as const },
  { id: "earliest_fv", accessor: "earliest_fv", header: "Prev FV", alignment: "center" as const },
  { id: "latest_fv", accessor: "latest_fv", header: "New FV", alignment: "center" as const },
  { id: "earliest_sprint", accessor: "earliest_sprint", header: "Prev Sprint", alignment: "center" as const },
  { id: "latest_sprint", accessor: "latest_sprint", header: "New Sprint", alignment: "center" as const },
];

const deliveryColumnDefs = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130, alignment: "center" as const },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 260 },
  { id: "latest_assignee", accessor: "latest_assignee", header: "TEL", minWidth: 140, alignment: "center" as const },
  { id: "latest_reporter", accessor: "latest_reporter", header: "PM", minWidth: 140, alignment: "center" as const },
  { id: "earliest_status", accessor: "earliest_status", header: "From", alignment: "center" as const },
  { id: "latest_status", accessor: "latest_status", header: "To", alignment: "center" as const },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version", alignment: "center" as const },
];

const staleColumnDefs = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130, alignment: "center" as const },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 260 },
  { id: "latest_assignee", accessor: "latest_assignee", header: "TEL", minWidth: 140, alignment: "center" as const },
  { id: "latest_reporter", accessor: "latest_reporter", header: "PM", minWidth: 140, alignment: "center" as const },
  { id: "latest_status", accessor: "latest_status", header: "Status", alignment: "center" as const },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version", alignment: "center" as const },
  { id: "last_updated", accessor: "last_updated", header: "Last Updated", alignment: "center" as const },
];

const nearFutureColumnDefs = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130, alignment: "center" as const },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 260 },
  { id: "latest_assignee", accessor: "latest_assignee", header: "TEL", minWidth: 140, alignment: "center" as const },
  { id: "latest_reporter", accessor: "latest_reporter", header: "PM", minWidth: 140, alignment: "center" as const },
  { id: "earliest_status", accessor: "earliest_status", header: "From", alignment: "center" as const },
  { id: "latest_status", accessor: "latest_status", header: "To", alignment: "center" as const },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version", alignment: "center" as const },
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
  const dkpi = useDql({ query: deliveryKpiQuery() });

  const totalItems = portfolio.data?.records?.reduce(
    (sum, r) => sum + (Number(r.item_count) || 0), 0
  ) ?? 0;

  const fvCount = fvChanges.data?.records?.length ?? 0;
  const deliveryCount = delivery.data?.records?.length ?? 0;
  const staleCount = stale.data?.records?.length ?? 0;
  const slippedCount = Number(dkpi.data?.records?.[0]?.slipped) || 0;

  const anyLoading = portfolio.isLoading || fvChanges.isLoading || delivery.isLoading || stale.isLoading || dkpi.isLoading;

  return (
    <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
      <KpiCard label="Active VIs" value={totalItems} signal="info" loading={anyLoading} subtitle="across all statuses" />
      <KpiCard label="Schedule Shifts" value={fvCount} signal={fvCount > 0 ? "warning" : "success"} loading={anyLoading} subtitle={`last ${LOOKBACK_DAYS}d`} />
      <KpiCard label="FV Slipped" value={slippedCount} signal={slippedCount > 3 ? "danger" : slippedCount > 0 ? "warning" : "success"} loading={anyLoading} subtitle="fix version moved" />
      <KpiCard label="Status Moves" value={deliveryCount} signal={deliveryCount > 0 ? "success" : "neutral"} loading={anyLoading} subtitle={`last ${LOOKBACK_DAYS}d`} />
      <KpiCard label="Stale Items" value={staleCount} signal={staleCount > 3 ? "danger" : staleCount > 0 ? "warning" : "success"} loading={anyLoading} subtitle="60+ days silent" />
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
            <CategoricalBarChart data={statusData} layout="horizontal">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
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
            <CategoricalBarChart data={assigneeData} layout="horizontal">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
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

/* ── Compact Filter Chips ───────────────────────────────────── */
const ALL = "__all__";

function FilterChips({
  filters,
  setFilters,
}: {
  filters: QueryFilters;
  setFilters: React.Dispatch<React.SetStateAction<QueryFilters>>;
}) {
  const { data: assigneeData, error: assigneeError, isLoading: assigneeLoading } = useDql({ query: portfolioByAssigneeQuery() });
  const { data: componentData, error: componentError, isLoading: componentLoading } = useDql({ query: componentBreakdownQuery() });
  const assignees = assigneeData?.records ?? [];
  const components = componentData?.records ?? [];

  return (
    <Flex gap={8} alignItems="center" flexFlow="wrap">
      <Flex flexDirection="column" gap={2} style={{ width: 320 }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, opacity: 0.5 }}>
          Execution Assignee
        </span>
        {assigneeLoading ? (
          <ProgressCircle size="small" />
        ) : assigneeError ? (
          <Paragraph style={{ color: "#f87171", fontSize: 11 }}>Error loading assignees</Paragraph>
        ) : (
          <Select
            style={{ width: "100%" }}
            value={filters.executionAssignee ?? ALL}
            onChange={(value) => {
              const val = value === ALL ? null : String(value);
              setFilters((prev) => ({ ...prev, executionAssignee: val }));
            }}
          >
            <SelectContent style={{ minWidth: 320 }}>
              <SelectOption value={ALL}>All assignees ({assignees.length})</SelectOption>
              {assignees.map((a) => {
                const name = String(a.latest_assignee ?? "");
                if (!name) return null;
                return (
                  <SelectOption key={name} value={name}>
                    {name} ({String(a.item_count)})
                  </SelectOption>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </Flex>
      <Flex flexDirection="column" gap={2} style={{ width: 360 }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, opacity: 0.5 }}>
          Component
        </span>
        {componentLoading ? (
          <ProgressCircle size="small" />
        ) : componentError ? (
          <Paragraph style={{ color: "#f87171", fontSize: 11 }}>Error loading components</Paragraph>
        ) : (
          <Select
            style={{ width: "100%" }}
            value={filters.component ?? ALL}
            onChange={(value) => {
              const val = value === ALL ? null : String(value);
              setFilters((prev) => ({ ...prev, component: val }));
            }}
          >
            <SelectContent style={{ minWidth: 360 }}>
              <SelectOption value={ALL}>All components ({components.length})</SelectOption>
              {components.map((c) => {
                const raw = String(c.latest_components ?? "");
                if (!raw) return null;
                const label = raw.replace(/^\["?|"?\]$/g, "").replace(/","/g, ", ");
                return (
                  <SelectOption key={raw} value={raw}>
                    {label} ({String(c.item_count)})
                  </SelectOption>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </Flex>
      {(filters.executionAssignee || filters.component) && (
        <button
          onClick={() => setFilters({ executionAssignee: null, component: null })}
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 16,
            padding: "4px 12px",
            color: "#f87171",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            alignSelf: "flex-end",
          }}
        >
          ✕ Clear
        </button>
      )}
    </Flex>
  );
}

/* ── Portfolio Card with Status Drill-Down ──────────────────── */
function PortfolioStatusItems({ status, filters }: { status: string; filters: QueryFilters }) {
  const { data, isLoading, error } = useDql({ query: portfolioItemsQuery(status, filters) });
  const records = data?.records ?? [];

  if (isLoading) return <Flex justifyContent="center" padding={8}><ProgressCircle size="small" /></Flex>;
  if (error) return <Paragraph style={{ color: Colors.Text.Critical.Default, fontSize: 12 }}>Error: {error.message}</Paragraph>;
  if (records.length === 0) return <Paragraph style={{ opacity: 0.4, fontSize: 12 }}>No items in this status</Paragraph>;

  return (
    <Flex flexDirection="column" gap={0} style={{ width: "100%", minWidth: 700 }}>
      {/* Header */}
      <Flex
        gap={0}
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          padding: "6px 0",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          opacity: 0.5,
        }}
      >
        <span style={{ width: 120, flexShrink: 0, textAlign: "center" }}>Key</span>
        <span style={{ flex: "1 1 auto" }}>Summary</span>
        <span style={{ width: 140, flexShrink: 0, textAlign: "center" }}>TEL</span>
        <span style={{ width: 140, flexShrink: 0, textAlign: "center" }}>PM</span>
        <span style={{ width: 100, flexShrink: 0, textAlign: "center" }}>Fix Version</span>
      </Flex>
      {/* Rows */}
      {records.map((r) => (
        <Flex
          key={String(r.key)}
          gap={0}
          alignItems="center"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            padding: "8px 0",
            fontSize: 13,
          }}
        >
          <span style={{ width: 120, flexShrink: 0, textAlign: "center" }}>
            <JiraLink value={r.key} />
          </span>
          <span style={{ flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {String(r.latest_summary ?? "")}
          </span>
          <span style={{ width: 140, flexShrink: 0, textAlign: "center", opacity: r.latest_assignee ? 1 : 0.4 }}>
            {String(r.latest_assignee ?? "Unassigned")}
          </span>
          <span style={{ width: 140, flexShrink: 0, textAlign: "center", opacity: r.latest_reporter ? 1 : 0.4 }}>
            {String(r.latest_reporter ?? "—")}
          </span>
          <span style={{ width: 100, flexShrink: 0, textAlign: "center", opacity: 0.7 }}>
            {String(r.latest_fv ?? "—")}
          </span>
        </Flex>
      ))}
    </Flex>
  );
}

function PortfolioRow({ record, filters }: { record: ResultRecord; filters: QueryFilters }) {
  const [expanded, setExpanded] = useState(false);
  const status = String(record.latest_status ?? "");
  const count = Number(record.item_count) || 0;

  return (
    <Flex flexDirection="column" gap={0}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: expanded ? "rgba(99,102,241,0.08)" : "transparent",
          border: "none",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          color: "inherit",
          fontSize: 14,
          fontFamily: "inherit",
        }}
      >
        <span style={{ opacity: 0.5, fontSize: 12, width: 16 }}>{expanded ? "▼" : "▶"}</span>
        <span style={{ flex: "1 1 auto", fontWeight: 600 }}>{status}</span>
        <span style={{
          background: "rgba(99,102,241,0.2)",
          borderRadius: 12,
          padding: "2px 10px",
          fontSize: 12,
          fontWeight: 700,
          color: "#a5b4fc",
        }}>
          {count}
        </span>
      </button>
      {expanded && (
        <Flex padding={16} style={{ borderLeft: "3px solid #6366f1", marginLeft: 16 }}>
          <PortfolioStatusItems status={status} filters={filters} />
        </Flex>
      )}
    </Flex>
  );
}

function PortfolioCard({ filters }: { filters: QueryFilters }) {
  const { data, error, isLoading } = useDql({ query: portfolioQuery(filters) });
  const records = data?.records ?? [];

  return (
    <Surface>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Flex alignItems="center" gap={12}>
          <span style={{ width: 4, height: 28, borderRadius: 2, background: "#6366f1", flexShrink: 0 }} />
          <Flex flexDirection="column" gap={2}>
            <Heading level={3}>Portfolio Overview</Heading>
            <Paragraph style={{ opacity: 0.6, fontSize: 13 }}>Click a status to see the items</Paragraph>
          </Flex>
        </Flex>

        {isLoading && <Flex justifyContent="center" padding={16}><ProgressCircle /></Flex>}
        {error && <Paragraph style={{ color: Colors.Text.Critical.Default }}>Query error: {error.message}</Paragraph>}

        {!isLoading && !error && records.length > 0 && (
          <Flex flexDirection="column" gap={0} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
            {records.map((r) => (
              <PortfolioRow key={String(r.latest_status)} record={r} filters={filters} />
            ))}
          </Flex>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Milestone / Delivery Tracking ───────────────────────────── */

const slippageColumnDefs = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130, alignment: "center" as const },
  { id: "summary", accessor: "summary", header: "Summary", minWidth: 260 },
  { id: "statusCurrent", accessor: "statusCurrent", header: "Status", minWidth: 140, alignment: "center" as const },
  { id: "fvi.name", accessor: "fvi.name", header: "Original FV", minWidth: 120, alignment: "center" as const },
  { id: "fv.name", accessor: "fv.name", header: "Current FV", minWidth: 120, alignment: "center" as const },
  { id: "fixVersionDeltaMonths", accessor: "fixVersionDeltaMonths", header: "Slipped (months)", minWidth: 130, alignment: "right" as const },
];

const missingFvColumnDefs = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130, alignment: "center" as const },
  { id: "summary", accessor: "summary", header: "Summary", minWidth: 260 },
  { id: "statusCurrent", accessor: "statusCurrent", header: "Status", minWidth: 140, alignment: "center" as const },
  { id: "currentFv", accessor: "currentFv", header: "Current FV", minWidth: 120, alignment: "center" as const },
  { id: "daysSinceUpdate", accessor: "daysSinceUpdate", header: "Days Since Update", minWidth: 140, alignment: "right" as const },
];

function DeliveryTimeline() {
  const { data, isLoading } = useDql({ query: deliveryTimelineQuery() });
  const [expandedFv, setExpandedFv] = useState<string | null>(null);

  const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

  const chartData = useMemo(() => {
    const byFv: Record<string, number> = {};
    for (const r of data?.records ?? []) {
      const fv = String(r["fv.name"] ?? "");
      byFv[fv] = (byFv[fv] || 0) + (Number(r.vi_count) || 0);
    }
    return Object.entries(byFv)
      .map(([name, count]) => {
        const parts = name.match(/^(\w+)\s+(\d{4})$/);
        const sortKey = parts ? Number(parts[2]) * 12 + (MONTHS[parts[1]] ?? 0) : 9999;
        return { category: name, value: count, sortKey };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [data]);

  // Determine which FVs are overdue (month end is before today)
  const now = new Date();
  const isOverdue = (fvName: string): boolean => {
    const parts = fvName.match(/^(\w+)\s+(\d{4})$/);
    if (!parts) return false;
    const m = MONTHS[parts[1]];
    const y = Number(parts[2]);
    if (m === undefined) return false;
    // FV "Apr 2026" is overdue if we're past April 2026 (i.e. May 2026+)
    const fvEnd = new Date(y, m + 1, 0); // last day of that month
    return now > fvEnd;
  };

  return (
    <Surface style={{ flex: "1 1 45%", minWidth: 340 }}>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Heading level={4}>Delivery Timeline</Heading>
        <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Active VIs by target fix version — click a version to drill down</Paragraph>
        {isLoading ? (
          <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
        ) : chartData.length > 0 ? (
          <>
            <CategoricalBarChart data={chartData}>
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
            <Flex flexDirection="column" gap={0} style={{ marginTop: 4 }}>
              {chartData.map(({ category, value }) => {
                const overdue = isOverdue(category);
                const isExpanded = expandedFv === category;
                return (
                  <React.Fragment key={category}>
                    <Flex
                      alignItems="center" gap={8}
                      style={{
                        padding: "8px 12px", cursor: "pointer",
                        borderRadius: 6,
                        background: isExpanded ? "rgba(99,102,241,0.12)" : "transparent",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                      onClick={() => setExpandedFv(isExpanded ? null : category)}
                    >
                      <span style={{ fontSize: 12, opacity: 0.5, width: 16 }}>{isExpanded ? "▼" : "▶"}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: "1 1 auto", color: overdue ? "#f87171" : "inherit" }}>
                        {category}{overdue ? " ⚠" : ""}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 12,
                        background: overdue ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)",
                        color: overdue ? "#f87171" : "#818cf8",
                      }}>
                        {value} VI{value !== 1 ? "s" : ""}
                      </span>
                    </Flex>
                    {isExpanded && <HealthDrillDown query={visByFixVersionQuery(category)} />}
                  </React.Fragment>
                );
              })}
            </Flex>
          </>
        ) : (
          <Paragraph style={{ opacity: 0.5 }}>No data</Paragraph>
        )}
      </Flex>
    </Surface>
  );
}

function HealthDrillDown({ query }: { query: string }) {
  const { data, isLoading } = useDql({ query });
  const records = data?.records ?? [];

  if (isLoading) return <Flex justifyContent="center" padding={8}><ProgressCircle size="small" /></Flex>;
  if (records.length === 0) return <Paragraph style={{ opacity: 0.4, fontSize: 12 }}>No items</Paragraph>;

  return (
    <Flex flexDirection="column" gap={0} style={{ width: "100%", marginTop: 4 }}>
      {records.map((r) => {
        const key = String(r.key ?? "");
        return (
          <Flex key={key} gap={8} alignItems="center" style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
            <span style={{ width: 110, flexShrink: 0 }}><JiraLink value={key} /></span>
            <span style={{ flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(r.summary ?? "")}</span>
            <span style={{ width: 100, flexShrink: 0, textAlign: "center", opacity: 0.6 }}>{String(r.statusCurrent ?? r.status ?? "")}</span>
            <span style={{ width: 80, flexShrink: 0, textAlign: "center", opacity: 0.6 }}>{String(r["fv.name"] ?? r.fixVersions ?? "—")}</span>
          </Flex>
        );
      })}
    </Flex>
  );
}

function SlippageSummary() {
  const { data, isLoading } = useDql({ query: deliveryKpiQuery() });
  const [expanded, setExpanded] = useState<string | null>(null);
  const rec = data?.records?.[0];
  const total = Number(rec?.total) || 0;
  const slipped = Number(rec?.slipped) || 0;
  const noFv = Number(rec?.no_fv_at_start) || 0;
  const staleUpdates = Number(rec?.stale_updates) || 0;

  const rows: { id: string; label: string; count: number; color: (n: number) => string; query: string }[] = [
    { id: "total", label: "Active VIs tracked", count: total, color: () => "inherit", query: "" },
    { id: "slipped", label: "Fix version slipped", count: slipped, color: (n) => n > 3 ? "#ef4444" : n > 0 ? "#eab308" : "#22c55e", query: slippedVisDetailQuery() },
    { id: "no_fv", label: "No FV at implementation start", count: noFv, color: (n) => n > 5 ? "#ef4444" : n > 0 ? "#eab308" : "#22c55e", query: noFvAtStartDetailQuery() },
    { id: "stale", label: "Status update >14 days ago", count: staleUpdates, color: (n) => n > 5 ? "#ef4444" : n > 0 ? "#eab308" : "#22c55e", query: staleUpdateVisDetailQuery() },
  ];

  return (
    <Surface style={{ flex: "1 1 45%", minWidth: 340 }}>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Heading level={4}>Delivery Health Snapshot</Heading>
        <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>From VI Analyzer — click a row to see the issues</Paragraph>
        {isLoading ? (
          <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
        ) : (
          <Flex flexDirection="column" gap={0}>
            {rows.map((row) => {
              const c = row.color(row.count);
              const isOpen = expanded === row.id;
              const clickable = row.query && row.count > 0;
              return (
                <Flex key={row.id} flexDirection="column">
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && setExpanded(isOpen ? null : row.id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 4px",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      background: isOpen ? "rgba(99,102,241,0.06)" : "transparent",
                      border: "none",
                      borderBlockEnd: "1px solid rgba(255,255,255,0.06)",
                      cursor: clickable ? "pointer" : "default",
                      color: "inherit",
                      fontSize: 13,
                      fontFamily: "inherit",
                      width: "100%",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ color: c }}>
                      {clickable && <span style={{ opacity: 0.4, fontSize: 10, marginRight: 6 }}>{isOpen ? "▼" : "▶"}</span>}
                      {row.label}
                    </span>
                    <Strong style={{ color: c }}>{row.count}</Strong>
                  </button>
                  {isOpen && row.query && (
                    <Flex padding={8} style={{ borderLeft: "3px solid #6366f1", marginLeft: 8, marginBottom: 4 }}>
                      <HealthDrillDown query={row.query} />
                    </Flex>
                  )}
                </Flex>
              );
            })}
          </Flex>
        )}
      </Flex>
    </Surface>
  );
}

function MilestoneVisDetail({ milestoneKey }: { milestoneKey: string }) {
  const { data, isLoading } = useDql({ query: rallyMilestoneVisQuery(milestoneKey) });
  const records = data?.records ?? [];

  if (isLoading) return <Flex justifyContent="center" padding={8}><ProgressCircle size="small" /></Flex>;
  if (records.length === 0) return <Paragraph style={{ opacity: 0.4, fontSize: 12 }}>No linked VIs found</Paragraph>;

  return (
    <Flex flexDirection="column" gap={0} style={{ width: "100%" }}>
      {records.map((r) => {
        const key = String(r.key ?? "");
        return (
          <Flex key={key} gap={8} alignItems="center" style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
            <span style={{ width: 110, flexShrink: 0 }}><JiraLink value={key} /></span>
            <span style={{ flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(r.summary ?? "")}</span>
            <span style={{ width: 110, flexShrink: 0, textAlign: "center", opacity: 0.6 }}>{String(r.status ?? "")}</span>
            <span style={{ width: 80, flexShrink: 0, textAlign: "center", opacity: 0.6 }}>{String(r.fixVersions ?? "—")}</span>
          </Flex>
        );
      })}
    </Flex>
  );
}

function RallyMilestones() {
  const { data, isLoading } = useDql({ query: rallyMilestonesQuery() });
  const [expanded, setExpanded] = useState<string | null>(null);
  const records = data?.records ?? [];

  // Group by program, sorted latest rally first
  const byProgram = useMemo(() => {
    const MONTHS: Record<string, number> = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11, Jan: 0, Feb: 1, Mar: 2, Apr: 3, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const groups: Record<string, typeof records> = {};
    for (const r of records) {
      const prog = String(r["ms_program"] ?? "Unknown");
      if (!groups[prog]) groups[prog] = [];
      groups[prog].push(r);
    }
    // Extract year + month from program name for chronological sort
    const sortKey = (name: string): number => {
      const m = name.match(/(\d{4})\s+(\w+)/);
      if (m) return Number(m[1]) * 12 + (MONTHS[m[2]] ?? 0);
      const m2 = name.match(/(\w+)\s+(\d{4})/);
      if (m2) return Number(m2[2]) * 12 + (MONTHS[m2[1]] ?? 0);
      return 0;
    };
    const sorted = Object.keys(groups).sort((a, b) => sortKey(b) - sortKey(a));
    const result: [string, typeof records][] = sorted.map((k) => [k, groups[k]]);
    return result;
  }, [records]);

  return (
    <Surface>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Flex alignItems="center" gap={12}>
          <span style={{ width: 4, height: 28, borderRadius: 2, background: "#14b8a6", flexShrink: 0 }} />
          <Flex flexDirection="column" gap={2}>
            <Heading level={3}>Rally Milestones</Heading>
            <Paragraph style={{ opacity: 0.6, fontSize: 13 }}>Rally milestones that Platform Apps VIs contribute to — click to see linked VIs</Paragraph>
          </Flex>
        </Flex>

        {isLoading ? (
          <Flex justifyContent="center" padding={16}><ProgressCircle /></Flex>
        ) : records.length === 0 ? (
          <Paragraph style={{ opacity: 0.5, fontStyle: "italic" }}>No rally milestones linked to PAPA VIs</Paragraph>
        ) : (
          <Flex flexDirection="column" gap={16}>
            {byProgram.map(([program, milestones]) => (
              <Flex key={program} flexDirection="column" gap={8}>
                <Heading level={5} style={{ color: "#14b8a6" }}>{program}</Heading>
                <Flex flexDirection="column" gap={0} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
                  {milestones.map((m) => {
                    const msKey = String(m["link.key"] ?? "");
                    const progress = Math.round(Number(m["ms_progress"]) || 0);
                    const viCount = Number(m["vi_count"]) || 0;
                    const isOpen = expanded === msKey;
                    const progressColor = progress >= 100 ? "#22c55e" : progress >= 50 ? "#eab308" : "#ef4444";

                    return (
                      <Flex key={msKey} flexDirection="column">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : msKey)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "12px 16px", background: isOpen ? "rgba(20,184,166,0.06)" : "transparent",
                            border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)",
                            cursor: "pointer", width: "100%", textAlign: "left",
                            color: "inherit", fontSize: 13, fontFamily: "inherit",
                          }}
                        >
                          <span style={{ opacity: 0.4, fontSize: 10, width: 12 }}>{isOpen ? "▼" : "▶"}</span>
                          {/* Progress bar */}
                          <span style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden", flexShrink: 0 }}>
                            <span style={{ display: "block", height: "100%", width: `${Math.min(100, progress)}%`, background: progressColor, borderRadius: 3 }} />
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: progressColor, width: 40, flexShrink: 0 }}>{progress}%</span>
                          <span style={{ flex: "1 1 auto", fontWeight: 500 }}>{String(m["ms_summary"] ?? "")}</span>
                          <a
                            href={`${JIRA_BASE}${msKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: "#818cf8", textDecoration: "none", fontSize: 11, flexShrink: 0 }}
                          >
                            {msKey} ↗
                          </a>
                          <span style={{
                            background: "rgba(20,184,166,0.2)", borderRadius: 12,
                            padding: "2px 10px", fontSize: 11, fontWeight: 700, color: "#5eead4", flexShrink: 0,
                          }}>
                            {viCount} VIs
                          </span>
                        </button>
                        {isOpen && (
                          <Flex padding={16} style={{ borderLeft: "3px solid #14b8a6", marginLeft: 16 }}>
                            <MilestoneVisDetail milestoneKey={msKey} />
                          </Flex>
                        )}
                      </Flex>
                    );
                  })}
                </Flex>
              </Flex>
            ))}
          </Flex>
        )}
      </Flex>
    </Surface>
  );
}

function MilestoneTracking() {
  const slippage = useDql({ query: fixVersionSlippageQuery() });
  const missingFv = useDql({ query: missingFvAtStartQuery() });

  const slippageColumns = useMemo(
    () => makeColumns(slippageColumnDefs as any),
    [],
  );
  const missingFvColumns = useMemo(
    () => makeColumns(missingFvColumnDefs as any),
    [],
  );

  return (
    <>
      {/* Row: Timeline + Health snapshot */}
      <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
        <DeliveryTimeline />
        <SlippageSummary />
      </Flex>

      {/* Fix Version Slippage table */}
      <Surface>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Flex alignItems="center" gap={12}>
            <span style={{ width: 4, height: 28, borderRadius: 2, background: "#f59e0b", flexShrink: 0 }} />
            <Flex flexDirection="column" gap={2}>
              <Heading level={3}>Fix Version Slippage</Heading>
              <Paragraph style={{ opacity: 0.6, fontSize: 13 }}>VIs whose fix version moved later than originally planned</Paragraph>
            </Flex>
            {!slippage.isLoading && (
              <span style={{
                marginLeft: "auto",
                background: (slippage.data?.records?.length ?? 0) > 0 ? "#f59e0b" : "transparent",
                color: (slippage.data?.records?.length ?? 0) > 0 ? "#000" : "inherit",
                borderRadius: 20, padding: "4px 14px", fontSize: 13, fontWeight: 600,
                border: (slippage.data?.records?.length ?? 0) > 0 ? "none" : "1px solid rgba(255,255,255,0.15)",
              }}>
                {slippage.data?.records?.length ?? 0} items
              </span>
            )}
          </Flex>
          {slippage.isLoading ? (
            <Flex justifyContent="center" padding={16}><ProgressCircle /></Flex>
          ) : (slippage.data?.records?.length ?? 0) > 0 ? (
            <DataTable data={slippage.data?.records ?? []} columns={slippageColumns} sortable resizable>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          ) : (
            <Paragraph style={{ opacity: 0.5, fontStyle: "italic" }}>No fix version slippage detected — solid planning!</Paragraph>
          )}
        </Flex>
      </Surface>

      {/* Missing FV at implementation start */}
      <Surface>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Flex alignItems="center" gap={12}>
            <span style={{ width: 4, height: 28, borderRadius: 2, background: "#8b5cf6", flexShrink: 0 }} />
            <Flex flexDirection="column" gap={2}>
              <Heading level={3}>No Fix Version at Implementation Start</Heading>
              <Paragraph style={{ opacity: 0.6, fontSize: 13 }}>VIs that entered Implementation without a fix version — planning gap</Paragraph>
            </Flex>
            {!missingFv.isLoading && (
              <span style={{
                marginLeft: "auto",
                background: (missingFv.data?.records?.length ?? 0) > 0 ? "#8b5cf6" : "transparent",
                color: (missingFv.data?.records?.length ?? 0) > 0 ? "#fff" : "inherit",
                borderRadius: 20, padding: "4px 14px", fontSize: 13, fontWeight: 600,
                border: (missingFv.data?.records?.length ?? 0) > 0 ? "none" : "1px solid rgba(255,255,255,0.15)",
              }}>
                {missingFv.data?.records?.length ?? 0} items
              </span>
            )}
          </Flex>
          {missingFv.isLoading ? (
            <Flex justifyContent="center" padding={16}><ProgressCircle /></Flex>
          ) : (missingFv.data?.records?.length ?? 0) > 0 ? (
            <DataTable data={missingFv.data?.records ?? []} columns={missingFvColumns} sortable resizable>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          ) : (
            <Paragraph style={{ opacity: 0.5, fontStyle: "italic" }}>All VIs had fix versions set at implementation start — excellent!</Paragraph>
          )}
        </Flex>
      </Surface>

      {/* Rally Milestones */}
      <RallyMilestones />
    </>
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

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      {/* Hero header with inline filters */}
      <Flex justifyContent="space-between" alignItems="flex-start" flexFlow="wrap" gap={16}>
        <Flex flexDirection="column" gap={4} style={{ flex: "1 1 auto" }}>
          <Heading>PAPA Delivery Pulse</Heading>
          <Paragraph style={{ opacity: 0.6 }}>
            Platform Apps delivery health — powered by Grail bizevents
            &nbsp;·&nbsp; Last <Strong>{LOOKBACK_DAYS} days</Strong>
          </Paragraph>
        </Flex>
        <FilterChips filters={filters} setFilters={setFilters} />
      </Flex>

      {/* Active filter indicator */}
      {(filters.executionAssignee || filters.component) && (
        <Flex gap={8} flexFlow="wrap">
          {filters.executionAssignee && (
            <span style={{
              background: "rgba(99,102,241,0.15)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 16,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "#a5b4fc",
            }}>
              Assignee: {filters.executionAssignee}
            </span>
          )}
          {filters.component && (
            <span style={{
              background: "rgba(34,197,94,0.15)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 16,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "#86efac",
            }}>
              Component: {filters.component}
            </span>
          )}
        </Flex>
      )}

      {/* KPI row */}
      <HeroStats filters={filters} />

      {/* Charts */}
      <ChartsRow filters={filters} />

      {/* Milestone / Delivery Tracking */}
      <MilestoneTracking />

      {/* Detail sections */}
      <PortfolioCard filters={filters} />

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
        subtitle="Open items with no update in 60+ days — potential risks"
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
