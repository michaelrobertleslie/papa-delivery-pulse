import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
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
  { id: "count", accessor: "count()", header: "Count" },
];

function QuerySection({
  title,
  description,
  query,
  tableColumns,
  emptyMessage = "No changes detected",
}: {
  title: string;
  description: string;
  query: string;
  tableColumns: Col[];
  emptyMessage?: string;
}) {
  const { data, error, isLoading } = useDql({ query });

  const records = data?.records ?? [];

  return (
    <Flex flexDirection="column" gap={8} style={{ width: "100%" }}>
      <Heading level={3}>{title}</Heading>
      <Paragraph>{description}</Paragraph>

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
        <Paragraph>
          <Strong>{emptyMessage}</Strong> in the last {LOOKBACK_DAYS} days.
        </Paragraph>
      )}

      {!isLoading && !error && records.length > 0 && (
        <DataTable data={records} columns={tableColumns} />
      )}
    </Flex>
  );
}

export const Dashboard = () => {
  return (
    <Flex flexDirection="column" padding={32} gap={32}>
      <Flex flexDirection="column" gap={4}>
        <Heading>PAPA Delivery Pulse</Heading>
        <Paragraph>
          Platform Apps delivery health — powered by Grail bizevents.
          Looking back <Strong>{LOOKBACK_DAYS} days</Strong> from today.
        </Paragraph>
      </Flex>

      <QuerySection
        title="Portfolio Overview"
        description="All active PAPA value increments grouped by current status."
        query={portfolioQuery()}
        tableColumns={portfolioColumns}
        emptyMessage="No PAPA items found"
      />

      <QuerySection
        title="Fix Version & Sprint Changes"
        description="Value increments where the fix version or sprint changed — potential schedule shifts."
        query={fvSprintChangesQuery()}
        tableColumns={changeColumns}
      />

      <QuerySection
        title="Delivery Status Changes"
        description="Items that changed delivery status — completed, moved to post-GA, etc."
        query={deliveryUpdatesQuery()}
        tableColumns={deliveryColumns}
      />

      <QuerySection
        title="Entering Implementation"
        description="Items that recently moved into Implementation — the near future pipeline."
        query={nearFutureQuery()}
        tableColumns={nearFutureColumns}
      />

      <QuerySection
        title="Stale Items"
        description="Open items with no data update in 30+ days — potential risks or forgotten work."
        query={staleItemsQuery()}
        tableColumns={staleColumns}
        emptyMessage="No stale items found"
      />
    </Flex>
  );
};
