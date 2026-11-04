import Link from "next/link";
import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Column } from "@/lib/content/dashboard";
import { cn } from "@/lib/utils";

export type Row = { id: string; href?: string; cells: Record<string, ReactNode> };

/**
 * One dataset, two markups: a real table from `md` upwards and stacked cards below it,
 * because a nine-column fee table cannot be read at 375px without horizontal scrolling.
 */
export function DataTable({
  columns,
  rows,
  caption,
  rowKeyHref,
}: {
  columns: readonly Column[];
  rows: Row[];
  caption?: string;
  /** Fallback link template for rows that did not set their own. */
  rowKeyHref?: (row: Row) => string | undefined;
}) {
  const linkFor = (row: Row) => row.href ?? rowKeyHref?.(row);

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn("whitespace-nowrap", column.align === "end" && "text-right")}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((column) => {
                  const cell = row.cells[column.key];
                  const href = linkFor(row);
                  return (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "max-w-[26rem] truncate",
                        column.align === "end" && "text-right tabular-nums",
                      )}
                    >
                      {column.key === columns[0].key && href ? (
                        <Link href={href} className="font-medium text-eavi-primary-text underline-offset-4 hover:underline">
                          {cell}
                        </Link>
                      ) : (
                        cell
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 p-4 md:hidden">
        {rows.map((row) => {
          const href = linkFor(row);
          return (
            <li key={row.id} className="rounded-xl border border-eavi-border bg-background p-4">
              <dl className="space-y-1.5">
                {columns.map((column, index) => (
                  <div key={column.key} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-xs text-eavi-muted-text">{column.label}</dt>
                    <dd
                      className={cn(
                        "min-w-0 text-right text-sm",
                        index === 0 && "font-medium",
                        column.align === "end" && "tabular-nums",
                      )}
                    >
                      {column.key === columns[0].key && href ? (
                        <Link href={href} className="text-eavi-primary-text underline-offset-4 hover:underline">
                          {row.cells[column.key]}
                        </Link>
                      ) : (
                        row.cells[column.key]
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}
