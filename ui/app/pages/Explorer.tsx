import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import type { ResultRecord } from "@dynatrace-sdk/client-query";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { allItemsQuery } from "../queries";

type Col = DataTableColumnDef<ResultRecord>;

const columns: Col[] = [
  { id: "key", accessor: "key", header: "Key", minWidth: 130 },
  { id: "latest_summary", accessor: "latest_summary", header: "Summary", minWidth: 300 },
  { id: "latest_status", accessor: "latest_status", header: "Status", minWidth: 130 },
  { id: "latest_assignee", accessor: "latest_assignee", header: "Assignee", minWidth: 140 },
  { id: "latest_fv", accessor: "latest_fv", header: "Fix Version", minWidth: 100 },
  { id: "latest_sprint", accessor: "latest_sprint", header: "Sprint", minWidth: 100 },
  { id: "latest_components", accessor: "latest_components", header: "Components", minWidth: 140 },
];

function ExplorerRowDetail({ row }: { row: ResultRecord }) {
  const details = String(row.status_details ?? "");
  const lines = details.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  return (
    <Flex flexDirection="column" gap={8} padding={16} style={{ borderLeft: "3px solid #6366f1", marginLeft: 8 }}>
      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.5, fontWeight: 600 }}>
        Status Details
      </span>
      {lines.length > 0 ? (
        <Flex flexDirection="column" gap={4} style={{ fontSize: 13, lineHeight: 1.5 }}>
          {lines.map((line, i) => (
            <span key={i} style={{ opacity: i === 0 ? 1 : 0.7 }}>{line}</span>
          ))}
        </Flex>
      ) : (
        <Paragraph style={{ opacity: 0.4, fontStyle: "italic", fontSize: 13 }}>
          No status details available
        </Paragraph>
      )}
    </Flex>
  );
}

export const Explorer = () => {
  const { data, error, isLoading } = useDql({ query: allItemsQuery() });
  const records = data?.records ?? [];

  return (
    <Flex flexDirection="column" padding={32} gap={16}>
      <Heading>VI Explorer</Heading>
      <Paragraph>
        All Platform Apps value increments — latest snapshot from Grail. Click a row to see status details.
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
          <Paragraph><Strong>{records.length}</Strong> value increments found.</Paragraph>
          <DataTable data={records} columns={columns} sortable>
            <DataTable.ExpandableRow>
              {({ row }) => <ExplorerRowDetail row={row as ResultRecord} />}
            </DataTable.ExpandableRow>
          </DataTable>
        </>
      )}
    </Flex>
  );
};
