import type { ReactNode } from "react";

export interface DataTableColumn<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  mobileLabel?: string;
}

export interface DataTableProps<Row> {
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string;
  caption?: string;
  empty?: ReactNode;
  onRowClick?: (row: Row) => void;
}

export function DataTable<Row>({ columns, rows, rowKey, caption, empty, onRowClick }: DataTableProps<Row>) {
  return (
    <div className="ui-table-scroll">
      <table className="ui-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={`align-${column.align ?? "left"}`} style={{ width: column.width }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? "is-clickable" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => {
                if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onRowClick(row);
                }
              }}
            >
              {columns.map((column) => (
                <td key={column.id} className={`align-${column.align ?? "left"}`} data-label={column.mobileLabel ?? column.header}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && empty && (
            <tr>
              <td className="ui-table-empty" colSpan={columns.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
