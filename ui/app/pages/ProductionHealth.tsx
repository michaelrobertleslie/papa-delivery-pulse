import React, { useMemo } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import { CategoricalBarChart, TimeseriesChart } from "@dynatrace/strato-components/charts";
import type { ResultRecord } from "@dynatrace-sdk/client-query";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import {
  userActionVolumeQuery,
  frontendErrorRateQuery,
  frontendErrorTrendQuery,
  webVitalsSummaryQuery,
  topExceptionsQuery,
  requestErrorsQuery,
  activeProblemsByCategoryQuery,
  problemTrendQuery,
  recentProblemsQuery,
  PAPA_FRONTENDS,
  PAPA_APP_NAMES,
} from "../queries";

type Col = DataTableColumnDef<ResultRecord>;

/** Map frontend.name (app ID) to display name */
function displayName(frontendName: unknown): string {
  const key = String(frontendName ?? "");
  return PAPA_FRONTENDS[key] ?? key;
}

/* ── App overview: actions + error rate side by side ─── */
function AppOverview() {
  const actionsResult = useDql({ query: userActionVolumeQuery() });
  const errorsResult = useDql({ query: frontendErrorRateQuery() });

  const actionData = useMemo(
    () =>
      (actionsResult.data?.records ?? []).map((r) => ({
        category: displayName(r["frontend.name"]),
        value: Number(r.total_actions) || 0,
      })),
    [actionsResult.data],
  );

  const errorColumns: Col[] = useMemo(
    () => [
      {
        id: "app",
        accessor: "frontend.name",
        header: "App",
        minWidth: 180,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>{displayName(value)}</span>
        ),
      },
      {
        id: "error_rate_pct",
        accessor: "error_rate_pct",
        header: "Error %",
        minWidth: 100,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const pct = Number(value) || 0;
          const color = pct >= 10 ? Colors.Charts.Apdex.Unacceptable.Default : pct >= 3 ? Colors.Charts.Apdex.Poor.Default : undefined;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color, fontWeight: pct >= 10 ? 700 : 400 }}>
              {pct.toFixed(2)}%
            </span>
          );
        },
      },
      {
        id: "total_errors",
        accessor: "total_errors",
        header: "Errors",
        minWidth: 100,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            {Number(value)?.toLocaleString() ?? "—"}
          </span>
        ),
      },
      {
        id: "total_requests",
        accessor: "total_requests",
        header: "Requests",
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

  const anyLoading = actionsResult.isLoading || errorsResult.isLoading;

  return (
    <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
      {/* User actions chart */}
      <Surface style={{ flex: "1 1 45%", minWidth: 340 }}>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Heading level={4}>User Actions (2h)</Heading>
          {anyLoading ? (
            <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
          ) : actionData.length > 0 ? (
            <CategoricalBarChart data={actionData} layout="horizontal">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          ) : (
            <Paragraph style={{ opacity: 0.5 }}>No RUM data for PAPA apps</Paragraph>
          )}
        </Flex>
      </Surface>

      {/* Error rate table */}
      <Surface style={{ flex: "1 1 45%", minWidth: 400 }}>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Heading level={4}>Frontend Error Rate (2h)</Heading>
          {anyLoading ? (
            <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
          ) : (errorsResult.data?.records?.length ?? 0) > 0 ? (
            <DataTable data={errorsResult.data?.records ?? []} columns={errorColumns} sortable resizable />
          ) : (
            <Paragraph style={{ opacity: 0.5 }}>No RUM data for PAPA apps</Paragraph>
          )}
        </Flex>
      </Surface>
    </Flex>
  );
}

/* ── Error trend timeseries ─────────────────────────── */
function ErrorTrend() {
  const { data, isLoading } = useDql({ query: frontendErrorTrendQuery() });

  const chartData = useMemo(() => {
    if (!data?.records?.length) return [];
    return data.records.map((rec) => {
      const timeframe = rec.timeframe as { start: string; end: string } | undefined;
      const values = rec.errors as number[] | undefined;
      const interval = Number(rec.interval) || 3600000000000;
      if (!timeframe || !values) return null;
      const startMs = new Date(timeframe.start).getTime();
      const intervalMs = interval / 1_000_000;
      return {
        name: displayName(rec["frontend.name"]),
        datapoints: values.map((v, i) => ({
          start: new Date(startMs + i * intervalMs),
          end: new Date(startMs + (i + 1) * intervalMs),
          value: v ?? 0,
        })),
      };
    }).filter(Boolean) as { name: string; datapoints: { start: Date; end: Date; value: number }[] }[];
  }, [data]);

  return (
    <Surface style={{ width: "100%" }}>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Heading level={4}>Frontend Error Trend (24h)</Heading>
        {isLoading ? (
          <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
        ) : chartData.length > 0 ? (
          <TimeseriesChart data={chartData} height={250}>
            <TimeseriesChart.YAxis label="Errors" />
          </TimeseriesChart>
        ) : (
          <Paragraph style={{ opacity: 0.5 }}>No RUM data for PAPA apps</Paragraph>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Core Web Vitals ────────────────────────────────── */
function WebVitals() {
  const { data, isLoading } = useDql({ query: webVitalsSummaryQuery() });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "app",
        accessor: "frontend.name",
        header: "App",
        minWidth: 180,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>{displayName(value)}</span>
        ),
      },
      {
        id: "lcp",
        accessor: "lcp_p75",
        header: "LCP p75",
        minWidth: 100,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const ns = Number(value) || 0;
          const ms = ns / 1_000_000;
          const s = ms / 1000;
          const color = s > 4 ? Colors.Charts.Apdex.Unacceptable.Default : s > 2.5 ? Colors.Charts.Apdex.Poor.Default : undefined;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color }}>
              {s < 10 ? s.toFixed(2) + "s" : s.toFixed(1) + "s"}
            </span>
          );
        },
      },
      {
        id: "inp",
        accessor: "inp_p75",
        header: "INP p75",
        minWidth: 100,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const ns = Number(value) || 0;
          const ms = ns / 1_000_000;
          const color = ms > 500 ? Colors.Charts.Apdex.Unacceptable.Default : ms > 200 ? Colors.Charts.Apdex.Poor.Default : undefined;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color }}>
              {ms.toFixed(0)}ms
            </span>
          );
        },
      },
      {
        id: "cls",
        accessor: "cls_p75",
        header: "CLS p75",
        minWidth: 100,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const v = Number(value) || 0;
          const color = v > 0.25 ? Colors.Charts.Apdex.Unacceptable.Default : v > 0.1 ? Colors.Charts.Apdex.Poor.Default : undefined;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color }}>
              {v.toFixed(3)}
            </span>
          );
        },
      },
      {
        id: "samples",
        accessor: "samples",
        header: "Samples",
        minWidth: 90,
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
    <Surface style={{ width: "100%" }}>
      <Flex flexDirection="column" gap={12} padding={24}>
        <Heading level={4}>Core Web Vitals (p75, 2h)</Heading>
        {isLoading ? (
          <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
        ) : (data?.records?.length ?? 0) > 0 ? (
          <DataTable data={data?.records ?? []} columns={columns} sortable resizable />
        ) : (
          <Paragraph style={{ opacity: 0.5 }}>No Web Vitals data for PAPA apps</Paragraph>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Top JS exceptions ──────────────────────────────── */
function TopExceptions() {
  const { data, isLoading } = useDql({ query: topExceptionsQuery() });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "app",
        accessor: "frontend.name",
        header: "App",
        minWidth: 160,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>{displayName(value)}</span>
        ),
      },
      { id: "message", accessor: "exception.message", header: "Exception", minWidth: 320 },
      {
        id: "count",
        accessor: "exception_count",
        header: "Count",
        minWidth: 90,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            {Number(value)?.toLocaleString() ?? "—"}
          </span>
        ),
      },
      {
        id: "sessions",
        accessor: "affected_sessions",
        header: "Sessions",
        minWidth: 90,
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
        <Heading level={4}>Top JS Exceptions (2h)</Heading>
        {isLoading ? (
          <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
        ) : (data?.records?.length ?? 0) > 0 ? (
          <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <Paragraph style={{ opacity: 0.5 }}>No exceptions found</Paragraph>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Request errors ─────────────────────────────────── */
function RequestErrors() {
  const { data, isLoading } = useDql({ query: requestErrorsQuery() });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "app",
        accessor: "frontend.name",
        header: "App",
        minWidth: 160,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>{displayName(value)}</span>
        ),
      },
      { id: "error", accessor: "error.display_name", header: "Request Error", minWidth: 320 },
      {
        id: "count",
        accessor: "error_count",
        header: "Count",
        minWidth: 90,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            {Number(value)?.toLocaleString() ?? "—"}
          </span>
        ),
      },
      {
        id: "sessions",
        accessor: "affected_sessions",
        header: "Sessions",
        minWidth: 90,
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
        <Heading level={4}>Request Errors (2h)</Heading>
        {isLoading ? (
          <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>
        ) : (data?.records?.length ?? 0) > 0 ? (
          <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <Paragraph style={{ opacity: 0.5 }}>No request errors found</Paragraph>
        )}
      </Flex>
    </Surface>
  );
}

/* ── Davis problems ─────────────────────────────────── */
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
      <Surface style={{ flex: "0 0 200px" }}>
        <Flex flexDirection="column" gap={8} padding={24} alignItems="center">
          <Heading level={5} style={{ opacity: 0.6 }}>Active Problems</Heading>
          {isLoading ? (
            <ProgressCircle />
          ) : (
            <Heading level={1} style={{ color: total > 0 ? Colors.Charts.Apdex.Unacceptable.Default : Colors.Charts.Apdex.Good.Default }}>
              {total.toLocaleString()}
            </Heading>
          )}
        </Flex>
      </Surface>
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
            <Paragraph style={{ opacity: 0.5 }}>No active problems for PAPA apps</Paragraph>
          )}
        </Flex>
      </Surface>
    </Flex>
  );
}

function ProblemTrend() {
  const { data, isLoading } = useDql({ query: problemTrendQuery() });

  const chartData = useMemo(() => {
    if (!data?.records?.length) return [];
    const rec = data.records[0];
    const timeframe = rec.timeframe as { start: string; end: string } | undefined;
    const values = rec.problem_count as number[] | undefined;
    const interval = Number(rec.interval) || 86400000000000;
    if (!timeframe || !values) return [];
    const startMs = new Date(timeframe.start).getTime();
    const intervalMs = interval / 1_000_000;
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
          <TimeseriesChart data={chartData} height={200}>
            <TimeseriesChart.YAxis label="Problems" />
          </TimeseriesChart>
        ) : (
          <Paragraph style={{ opacity: 0.5 }}>No problem data</Paragraph>
        )}
      </Flex>
    </Surface>
  );
}

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
      { id: "title", accessor: "title", header: "Title", minWidth: 280 },
      {
        id: "entity",
        accessor: "affected_entity_names",
        header: "Affected Entity",
        minWidth: 180,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {String(value ?? "")}
          </span>
        ),
      },
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
          <Paragraph style={{ opacity: 0.5 }}>No active problems for PAPA apps</Paragraph>
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
        RUM metrics, Web Vitals, and Davis problems for PAPA apps: {PAPA_APP_NAMES.join(", ")}.
      </Paragraph>

      {/* Row 1: User actions + error rate */}
      <AppOverview />

      {/* Row 2: Error trend */}
      <ErrorTrend />

      {/* Row 3: Web Vitals */}
      <WebVitals />

      {/* Row 4: JS exceptions + request errors */}
      <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
        <TopExceptions />
        <RequestErrors />
      </Flex>

      {/* Row 5: Davis problems overview */}
      <ProblemSummary />

      {/* Row 6: Problem trend */}
      <ProblemTrend />

      {/* Row 7: Recent problems detail */}
      <RecentProblems />
    </Flex>
  );
};
