import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Tabular numerals for dates/counts so columns don't jitter row to row. */
  numeric?: boolean;
}

/**
 * A plain, dense table — this is an internal tool for one operator, not a
 * public page, so it favors information density over decorative styling.
 * Wrapped in overflow-x-auto so it degrades to horizontal scroll on small
 * screens instead of breaking the page layout.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
}: {
  columns: Column<T>[];
  rows: T[];
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border-2 border-soft/10 bg-indigo">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-soft/10 text-start">
            {columns.map((col) => (
              <th
                key={col.header}
                className="px-5 py-3 font-display text-xs font-bold tracking-wide text-soft/70 uppercase"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-soft/5 last:border-0 hover:bg-violet/10">
              {columns.map((col) => (
                <td
                  key={col.header}
                  className={`px-5 py-3 text-soft/85 ${col.numeric ? "tabular-nums" : ""}`}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
