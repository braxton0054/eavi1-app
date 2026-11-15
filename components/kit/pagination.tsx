import * as React from "react";

import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

import styles from "./pagination.module.css";

/**
 * The pager for a list: previous/next with the current page and total, and an optional
 * page-size picker (CMP-30, CMP-67).
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav data-slot="pagination" className={styles.root} aria-label="Pagination">
      <Button
        variant="secondary"
        size="sm"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span className={styles.status}>
        Page {page} of {Math.max(1, totalPages)}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
      {pageSize && pageSizeOptions && onPageSizeChange ? (
        <label className={styles.pageSize}>
          <span className={styles.pageSizeLabel}>Rows</span>
          <select
            className={styles.pageSizeSelect}
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </nav>
  );
}
