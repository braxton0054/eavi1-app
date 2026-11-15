"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { cx } from "@/lib/cx";

import styles from "./searchable-select.module.css";

export type SearchOption = { value: string; label: string };

const NO_MATCHES = "No matches.";
const SEARCH_PLACEHOLDER = "Search…";

/**
 * A select for long lists (more than ~7 options): type to filter AND scroll (FRM-03/40).
 * Renders a hidden input carrying the chosen value, so it drops into any server-action
 * form exactly where a plain <select> stood. Short lists should stay on <select>.
 */
export function SearchableSelect({
  id,
  name,
  options,
  defaultValue,
  placeholder,
  required,
  className,
}: {
  id: string;
  /** The form field name the chosen value is submitted under. */
  name: string;
  options: readonly SearchOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const initial = options.find((option) => option.value === defaultValue) ?? null;
  const [selected, setSelected] = React.useState<SearchOption | null>(initial);

  return (
    <Combobox.Root
      items={options}
      itemToStringLabel={(option: SearchOption) => option.label}
      itemToStringValue={(option: SearchOption) => option.value}
      isItemEqualToValue={(option: SearchOption, value: unknown) =>
        option.value === (value as SearchOption | null)?.value
      }
      value={selected}
      onValueChange={(value) => setSelected((value as SearchOption | null) ?? null)}
      autoHighlight
    >
      {/* The library's own hidden input is not relied on: this one is deterministic and
          keeps the server action contract identical to the <select> it replaces. */}
      <input type="hidden" name={name} value={selected?.value ?? ""} />
      <Combobox.InputGroup className={cx(styles.group, className)}>
        <Combobox.Input
          id={id}
          required={required}
          placeholder={placeholder ?? SEARCH_PLACEHOLDER}
          autoComplete="off"
          spellCheck={false}
          className={styles.input}
        />
        <Combobox.Trigger aria-label="Open options" className={styles.trigger}>
          <ChevronsUpDownIcon />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className={styles.positioner}>
          <Combobox.Popup className={styles.popup}>
            <Combobox.Empty>
              <p className={styles.empty}>{NO_MATCHES}</p>
            </Combobox.Empty>
            <Combobox.List className={styles.list}>
              {(option: SearchOption) => (
                <Combobox.Item key={option.value} value={option} className={styles.item}>
                  <Combobox.ItemIndicator className={styles.itemIndicator}>
                    <CheckIcon />
                  </Combobox.ItemIndicator>
                  <span className={styles.itemLabel}>{option.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
