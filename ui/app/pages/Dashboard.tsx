import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface, TitleBar } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
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
  LOOKBACK_DAYS,
} from "../queries";

type Col = DataTableColumnDef<ResultRecord>;

const changeColumns: Col[] = [
  { id: "key", accessor: "key", header: "Key", minWidth: 140 },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 300 },
  { id: "earliest_fv", accessor: "earliest_fv", header: "Previous FV" },
  { id: "latest_fv", accessor: "latest_fv", header: "Current FV" },
  { id: "earliest_sprint", accessor: "earliest_sprint", header: "Previous Sprint" },
  { id: "latest_sprint", accessor: "latest_sprint", header: "Current Sprint" },
  { id: "latest_status", accessor: "latest_status", header: "Status" },
];

const deliveryColumns: Col[] = [
  { id: "key", accessor: "key", header: "Key", minWidth: 140 },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 300 },
  { id: "earliest_status", accessor: "earliest_status", header: "Previous Status" },
  { id: "latest_status", accessor: "latest_status", header: "Current Status" },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version" },
];

const staleColumns: Col[] = [
  { id: "key", accessor: "key", header: "Key", minWidth: 140 },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 300 },
  { id: "latest_status", accessor: "latest_status", header: "Status" },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version" },
  { id: "last_seen", accessor: "last_seen", header: "Last Seen" },
];

const nearFutureColumns: Col[] = [
  { id: "key", accessor: "key", header: "Key", minWidth: 140 },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 300 },
  { id: "earliest_status", accessor: "earliest_status", header: "Previous Status" },
  { id: "latest_status", accessor: "latest_status", header: "Current Status" },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version" },
];

const portfolioColumns: Col[] = [
  { id: "latest_status", accessor: "latest_status", header: "Status", minWidth: 200 },
  { id: "count", accessor: "item_count", header: "Count" },
];

/* ── Signal colors for KPI cards ────────────────────────────── */
const signalColors = {
  neutral: { bg: "#1a1a2e", border: "#2d2d50", text: "#a0a0c0" },
  warning: { bg: "#2e2a1a", border: "#504d2d", text: "#c0b060" },
  success: { bg: "#1a2e1a", border: "#2d502d", text: "#60c060" },
  danger:  { bg: "#2e1a1a", border: "#502d2d", text: "#c06060" },
  info:    { bg: "#1a1a2e", border: "#2d3d60", text: "#6090c0" },
};

/* ── KPI Card ───────────────────────────────────────────────── */
function KpiCard({
  label,
  value,
  signal = "neutral",
  loading = false,
}: {
  label: string;
  value: string | number;
  signal?: keyof typeof signalColors;
  loading?: boolean;
}) {
  const c = signalColors[signal];
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
        padding: "20px 28px",
        minWidth: 160,
        flex: "1 1 0",
      }}
    >
      {loading ? (
        <ProgressCircle size="small" />
      ) : (
        <span style={{ fontSize: 36, fontWeight: 700, color: c.text, lineHeight: 1 }}>
          {value}
        </span>
      )}
      <span style={{ fontSize: 12, fontWeight: 500, color: c.text, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
    </Flex>
  );
}

/* ── Hero KPI Row ───────────────────────────────────────────── */
function HeroStats() {
  const portfolio = useDql({ query: portfolioQuery() });
  const fvChanges = useDql({ query: fvSprintChangesQuery() });
  const delivery = useDql({ query: deliveryUpdatesQuery() });
  const stale = useDql({ query: staleItemsQuery() });

  const totalItems = portfolio.data?.records?.reduce(
    (sum, r) => sum + (Number(r.item_count) || 0), 0
  ) ?? 0;

  const fvCount = fvChanges.data?.records?.length ?? 0;
  const deliveryCount = delivery.data?.records?.length ?? 0;
  const staleCount = stale.data?.records?.length ?? 0;

  const anyLoading = portfolio.isLoading || fvChanges.isLoading || delivery.isLoading || stale.isLoading;

  return (
    <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
      <KpiCard label="Active VIs" value={totalItems} signal="info" loading={anyLoading} />
      <KpiCard label="FV/Sprint Shifts" value={fvCount} signal={fvCount > 0 ? "warning" : "success"} loading={anyLoading} />
      <KpiCard label="Status Changes" value={deliveryCount} signal={deliveryCount > 0 ? "success" : "neutral"} loading={anyLoading} />
      <KpiCard label="Stale Items" value={staleCount} signal={staleCount > 3 ? "danger" : staleCount > 0 ? "warning" : "success"} loading={anyLoading} />
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
}: {
  title: string;
  subtitle: string;
  query: string;
  tableColumns: Col[];
  emptyMessage?: string;
  accentColor?: string;
}) {
  const { data, error, isLoading } = useDql({ query });
  const records = data?.records ?? [];

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
            <Paragraph style={{ opacity: 0.7, fontSize: 13 }}>{subtitle}</Paragraph>
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
          <Paragraph style={{ padding: "8px 0", opacity: 0.6 }}>
            {emptyMessage} in the last {LOOKBACK_DAYS} days.
          </Paragraph>
        )}

        {!isLoading && !error && records.length > 0 && (
          <DataTable data={records} columns={tableColumns} />
        )}
      </Flex>
    </Surface>
  );
}

/* ── Main Dashboard ─────────────────────────────────────────── */
export const Dashboard = () => {
  return (
    <Flex flexDirection="column" padding={32} gap={32}>
      {/* Hero header */}
      <Flex flexDirection="column" gap={4}>
        <Heading>PAPA Delivery Pulse</Heading>
        <Paragraph style={{ opacity: 0.7 }}>
          Platform Apps delivery health — powered by Grail bizevents
          &nbsp;·&nbsp; Last <Strong>{LOOKBACK_DAYS} days</Strong>
        </Paragraph>
      </Flex>

      {/* KPI row */}
      <HeroStats />

      {/* Section cards */}
      <SectionCard
        title="Portfolio Overview"
        subtitle="All active PAPA value increments grouped by current status"
        query={portfolioQuery()}
        tableColumns={portfolioColumns}
        emptyMessage="No PAPA items found"
        accentColor="#6366f1"
      />

      <SectionCard
        title="Fix Version & Sprint Changes"
        subtitle="Schedule shifts detected — fix version or sprint changed"
        query={fvSprintChangesQuery()}
        tableColumns={changeColumns}
        accentColor="#f59e0b"
      />

      <SectionCard
        title="Delivery Status Changes"
        subtitle="Items that moved status — completed, post-GA, release prep"
        query={deliveryUpdatesQuery()}
        tableColumns={deliveryColumns}
        accentColor="#22c55e"
      />

      <SectionCard
        title="Entering Implementation"
        subtitle="Items recently moved into Implementation — the near future"
        query={nearFutureQuery()}
        tableColumns={nearFutureColumns}
        accentColor="#3b82f6"
      />

      <SectionCard
        title="Stale Items"
        subtitle="Open items with no update in 30+ days — potential risks"
        query={staleItemsQuery()}
        tableColumns={staleColumns}
        emptyMessage="No stale items found"
        accentColor="#ef4444"
      />
    </Flex>
  );
};
