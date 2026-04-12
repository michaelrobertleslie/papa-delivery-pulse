import React, { useMemo } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import { CategoricalBarChart, TimeseriesChart } from "@dynatrace/strato-components/charts";
import type { ResultRecord } from "@dynatrace-sdk/client-query";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import {
  activeProblemsByCategoryQuery,
  problemTrendQuery,
  topErrorServicesQuery,
  serviceHealthOverviewQuery,
  recentProblemsQuery,
} from "../queries";

type Col = DataTableColumnDef<ResultRecord>;

/* ── Summary tiles row ──────────────────────────────── */
function ProblemSummary() {
  const { data, isLoading } = useDql({ query: activeProblemsByCategoryQuery() });

  const records = data?.records ?? [];
  const total = records.reduce((sum, r) => sum + (Number(r.problem_count) || 0), 0);

  const categoryData = useMemo(
    () =>
      records.map((r) => ({
        category: String(r["event.category"] ?? "UNKNOWN"),
        value: Number(r.problem_count) || 0,
      })),
    [records],
  );

  return (
    <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
      {/* Total count */}
      <Surface style={{ flex: "0 0 200px" }}>
        <Flex flexDirection="column" gap={8} padding={24} alignItems="center">
          <Heading level={5} style={{ opacity: 0.6 }}>Active Problems</Heading>
          {isLoading ? (
            <ProgressCircle />
          ) : (
            <Heading level={1} style={{ color: total > 1000 ? Colors.Charts.Apdex.Unacceptable.Default : Colors.Charts.Apdex.Fair.Default }}>
              {total.toLocaleString()}
            </Heading>
          )}
        </Flex>
      </Surface>

      {/* By category chart */}
      <Surface style={{ flex: "1 1 400px", minWidth: 340 }}>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Heading level={4}>Problems by Category</Heading>
          {isLoading ? (
            <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
          ) : categoryData.length > 0 ? (
            <CategoricalBarChart data={categoryData} layout="horizontal">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          ) : (
            <Paragraph style={{ opacity: 0.5 }}>No active problems</Paragraph>
          )}
        </Flex>
      </Surface>
    </Flex>
  );
}

/* ── Problem trend (7-day timeseries) ───────────────── */
function ProblemTrend() {
  const { data, isLoading } = useDql({ query: problemTrendQuery() });

  const chartData = useMemo(() => {
    if (!data?.records?.length) return [];
    const rec = data.records[0];
    const timeframe = rec.timeframe as { start: string; end: string } | undefined;
    const values = rec.problem_count as number[] | undefined;
    const interval = Number(rec.interval) || 86400000000000; // 1 day in nanos
    if (!timeframe || !values) return [];

    const startMs = new Date(timeframe.start).getTime();
    const intervalMs = interval / 1_000_000; // nanos → ms

    return [
      {
        name: "Problems",
        datapoints: values.map((v, i) => ({
          start: new Date(startMs + i * intervalMs),
          end: new Date(startMs + (i + 1) * intervalMs),
          value: v ?? 0,
        })),
      },
    ];
  }, [data]);

  return (
    <Surface style={{ width: "100%" }}>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Heading level={4}>Problem Trend (7 days)</Heading>
        {isLoading ? (
          <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
        ) : chartData.length > 0 ? (
          <TimeseriesChart data={chartData} height={220}>
            <TimeseriesChart.Bar data={chartData[0]} />
            <TimeseriesChart.YAxis label="Problems" />
          </TimeseriesChart>
        ) : (
          <Paragraph style={{ opacity: 0.5 }}>No data</Paragraph>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Top error services ─────────────────────────────── */
function TopErrorServices() {
  const { data, isLoading } = useDql({ query: topErrorServicesQuery() });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "service",
        accessor: "dt.service.name",
        header: "Service",
        minWidth: 280,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {String(value ?? "")}
          </span>
        ),
      },
      {
        id: "error_pct",
        accessor: "error_pct",
        header: "Error %",
        minWidth: 100,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const pct = Number(value) || 0;
          const color = pct >= 50 ? Colors.Charts.Apdex.Unacceptable.Default : pct >= 10 ? Colors.Charts.Apdex.Poor.Default : undefined;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color, fontWeight: pct >= 50 ? 700 : 400 }}>
              {pct.toFixed(1)}%
            </span>
          );
        },
      },
      {
        id: "total_reqs",
        accessor: "total_reqs",
        header: "Requests",
        minWidth: 100,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            {Number(value)?.toLocaleString() ?? "—"}
          </span>
        ),
      },
      {
        id: "total_fails",
        accessor: "total_fails",
        header: "Failures",
        minWidth: 100,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            {Number(value)?.toLocaleString() ?? "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <Surface style={{ flex: "1 1 45%", minWidth: 400 }}>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Heading level={4}>Top Error Services (1h)</Heading>
        {isLoading ? (
          <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
        ) : (data?.records?.length ?? 0) > 0 ? (
          <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <Paragraph style={{ opacity: 0.5 }}>No services with error rate &gt; 1%</Paragraph>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Service health overview ────────────────────────── */
function ServiceHealthOverview() {
  const { data, isLoading } = useDql({ query: serviceHealthOverviewQuery() });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "service",
        accessor: "dt.service.name",
        header: "Service",
        minWidth: 280,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {String(value ?? "")}
          </span>
        ),
      },
      {
        id: "total_reqs",
        accessor: "total_reqs",
        header: "Throughput",
        minWidth: 110,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            {Number(value)?.toLocaleString() ?? "—"}
          </span>
        ),
      },
      {
        id: "error_pct",
        accessor: "error_pct",
        header: "Error %",
        minWidth: 100,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const pct = Number(value) || 0;
          const color = pct >= 50 ? Colors.Charts.Apdex.Unacceptable.Default : pct >= 5 ? Colors.Charts.Apdex.Poor.Default : undefined;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color }}>
              {pct.toFixed(1)}%
            </span>
          );
        },
      },
      {
        id: "p95_ms",
        accessor: "p95_ms",
        header: "p95 (ms)",
        minWidth: 110,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const ms = Number(value) || 0;
          const color = ms > 3000 ? Colors.Charts.Apdex.Unacceptable.Default : ms > 1000 ? Colors.Charts.Apdex.Poor.Default : undefined;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color }}>
              {ms.toFixed(0)}
            </span>
          );
        },
      },
    ],
    [],
  );

  return (
    <Surface style={{ flex: "1 1 45%", minWidth: 400 }}>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Heading level={4}>Service Health (Top 20 by Throughput, 1h)</Heading>
        {isLoading ? (
          <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
        ) : (data?.records?.length ?? 0) > 0 ? (
          <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <Paragraph style={{ opacity: 0.5 }}>No data</Paragraph>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Recent problems table ──────────────────────────── */
function RecentProblems() {
  const { data, isLoading } = useDql({ query: recentProblemsQuery() });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "display_id",
        accessor: "display_id",
        header: "ID",
        minWidth: 120,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600 }}>
            {String(value ?? "")}
          </span>
        ),
      },
      { id: "title", accessor: "title", header: "Title", minWidth: 320 },
      {
        id: "category",
        accessor: "event.category",
        header: "Category",
        minWidth: 140,
        alignment: "center" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {String(value ?? "")}
          </span>
        ),
      },
      {
        id: "timestamp",
        accessor: "timestamp",
        header: "Detected",
        minWidth: 180,
        cell: ({ value }: { value: unknown }) => {
          const ts = value ? new Date(String(value)) : null;
          return (
            <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
              {ts ? ts.toLocaleString() : "—"}
            </span>
          );
        },
      },
    ],
    [],
  );

  return (
    <Surface style={{ width: "100%" }}>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Heading level={4}>Recent Active Problems (24h)</Heading>
        {isLoading ? (
          <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
        ) : (data?.records?.length ?? 0) > 0 ? (
          <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <Paragraph style={{ opacity: 0.5 }}>No active problems</Paragraph>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Main page ──────────────────────────────────────── */
export const ProductionHealth = () => {
  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <Heading level={2}>Production Health</Heading>
      <Paragraph style={{ opacity: 0.6 }}>
        Live Davis problems, service error rates, and latency across the environment.
      </Paragraph>

      {/* Row 1: Problem summary + category chart */}
      <ProblemSummary />

      {/* Row 2: Problem trend */}
      <ProblemTrend />

      {/* Row 3: Error services + service health side by side */}
      <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
        <TopErrorServices />
        <ServiceHealthOverview />
      </Flex>

      {/* Row 4: Recent problems table */}
      <RecentProblems />
    </Flex>
  );
};
