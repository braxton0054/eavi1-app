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
  mobile,
}: {
  columns: readonly Column[];
  rows: Row[];
  caption?: string;
  /** Fallback link template for rows that did not set their own. */
  rowKeyHref?: (row: Row) => string | undefined;
  /**
   * Replaces the stacked label/value cards below `md`. A row with a dozen columns is not
   * readable as a card, so a screen whose rows carry that much can hand in its own layout.
   */
  mobile?: ReactNode;
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
                  className={cn(
                    // Only a short header may be kept on one line: a table of long labels
                    // cannot shrink, and the last column then falls off a laptop screen.
                    column.key !== columns[0].key && "whitespace-nowrap",
                    column.align === "end" && "text-right",
                  )}
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
                        column.interactive
                          ? "align-top whitespace-nowrap"
                          : "align-top",
                        column.key !== columns[0].key && "max-w-[22rem] break-words",
                        column.align === "end" && "text-right tabular-nums",
                      )}
                    >
                      {column.key === columns[0].key && href ? (
                        <Link href={href} className="font-medium whitespace-nowrap text-eavi-primary-text underline-offset-4 hover:underline">
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

      {/* The custom mobile view must also hide at md, otherwise it renders on desktop. */}
      {mobile ? (
        <div className="md:hidden">{mobile}</div>
      ) : (
        <ul className="space-y-3 p-4 md:hidden">
          {rows.map((row) => {
            const href = linkFor(row);
            return (
              <li key={row.id} className="rounded-xl border border-eavi-border bg-background p-4">
                <dl className="space-y-1.5">
                  {columns.map((column, index) => {
                    const isFirst = index === 0;
                    const linked = isFirst && href;
                    return (
                      <div
                        key={column.key}
                        className={cn("flex justify-between gap-3", isFirst ? "items-center" : "items-baseline")}
                      >
                        <dt className="shrink-0 text-xs text-eavi-muted-text">{column.label}</dt>
                        <dd
                          className={cn(
                            "min-w-0 flex-1 text-right text-sm break-words",
                            isFirst && "font-medium",
                            column.align === "end" && "tabular-nums",
                          )}
                        >
                          {linked ? (
                            <Link
                              href={href}
                              className="inline-flex min-h-11 w-full items-center justify-end text-eavi-primary-text underline-offset-4 hover:underline"
                            >
                              {row.cells[column.key]}
                            </Link>
                          ) : (
                            row.cells[column.key]
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
