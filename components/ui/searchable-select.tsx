"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SearchOption = { value: string; label: string };

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
      <Combobox.InputGroup
        className={cn(
          "flex h-11 w-full min-w-0 items-center gap-1 rounded-lg border border-input bg-eavi-card px-3 py-2 text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm",
          className,
        )}
      >
        <Combobox.Input
          id={id}
          required={required}
          placeholder={placeholder ?? "Search…"}
          autoComplete="off"
          spellCheck={false}
          className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-base outline-none placeholder:text-eavi-muted-text md:text-sm"
        />
        <Combobox.Trigger
          aria-label="Open options"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-eavi-muted-text hover:bg-eavi-primary-soft hover:text-eavi-primary-text"
        >
          <ChevronsUpDownIcon className="size-4" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="outline-none">
          <Combobox.Popup
            className="w-[var(--anchor-width)] max-w-[var(--available-width)] origin-[var(--transform-origin)] rounded-lg border border-eavi-border bg-popover text-popover-foreground shadow-md transition-[scale,opacity] duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
          >
            <Combobox.Empty>
              <p className="px-3 py-3 text-sm text-eavi-muted-text">No matches.</p>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain py-1 outline-none">
              {(option: SearchOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="cn-menu-target grid cursor-pointer grid-cols-[1.25rem_1fr] items-center gap-1 rounded-md px-2 py-2 text-sm outline-none data-highlighted:bg-eavi-primary-soft"
                >
                  <Combobox.ItemIndicator className="col-start-1 text-eavi-primary-text">
                    <CheckIcon className="size-4" />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2 truncate">{option.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
