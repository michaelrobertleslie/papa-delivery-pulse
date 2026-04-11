import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import type { ResultRecord } from "@dynatrace-sdk/client-query";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { allItemsQuery } from "../queries";

type Col = DataTableColumnDef<ResultRecord>;

const columns: Col[] = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130 },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 350 },
  { id: "latest_status", accessor: "latest_status", header: "Status", minWidth: 150 },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version", minWidth: 120 },
  { id: "latest_sprint", accessor: "latest_sprint", header: "Sprint", minWidth: 120 },
];

export const Explorer = () => {
  const { data, error, isLoading } = useDql({ query: allItemsQuery() });
  const records = data?.records ?? [];

  return (
    <Flex flexDirection="column" padding={32} gap={16}>
      <Heading>VI Explorer</Heading>
      <Paragraph>
        All Platform Apps value increments — latest snapshot from Grail.
      </Paragraph>

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

      {!isLoading && !error && (
        <>
          <Paragraph>{records.length} value increments found.</Paragraph>
          <DataTable data={records} columns={columns} sortable />
        </>
      )}
    </Flex>
  );
};
