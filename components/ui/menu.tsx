"use client";

import * as React from "react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import { CheckIcon, ChevronRightIcon } from "lucide-react";

import { cx } from "@/lib/cx";

import styles from "./menu.module.css";

/** A small token-styled menu over unstyled Radix behaviour. */
const Menu = MenuPrimitive.Root;
const MenuTrigger = MenuPrimitive.Trigger;
const MenuGroup = MenuPrimitive.Group;
const MenuRadioGroup = MenuPrimitive.RadioGroup;

function MenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="menu-content"
        align={align}
        sideOffset={sideOffset}
        className={cx(styles.content, className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

function MenuItem({
  className,
  inset = false,
  variant = "default",
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & {
  /** Indents the item to line up with the items that carry a check or a radio mark. */
  inset?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      data-inset={inset || undefined}
      data-variant={variant}
      className={cx(styles.item, className)}
      {...props}
    />
  );
}

function MenuCheckboxItem({
  className,
  children,
  inset = false,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItem> & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menu-checkbox-item"
      data-inset={inset || undefined}
      className={cx(styles.item, styles.checkable, className)}
      {...props}
    >
      <span className={styles.indicator}>
        <MenuPrimitive.ItemIndicator>
          <CheckIcon />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function MenuRadioItem({
  className,
  children,
  inset = false,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem> & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menu-radio-item"
      data-inset={inset || undefined}
      className={cx(styles.item, styles.checkable, className)}
      {...props}
    >
      <span className={styles.indicator}>
        <MenuPrimitive.ItemIndicator>
          <CheckIcon />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function MenuLabel({
  className,
  inset = false,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <MenuPrimitive.Label
      data-slot="menu-label"
      data-inset={inset || undefined}
      className={cx(styles.label, className)}
      {...props}
    />
  );
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cx(styles.separator, className)}
      {...props}
    />
  );
}

/** A right-aligned hint, such as a keyboard shortcut. */
function MenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="menu-shortcut" className={cx(styles.shortcut, className)} {...props} />;
}

const MenuSub = MenuPrimitive.Sub;

function MenuSubTrigger({
  className,
  inset = false,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <MenuPrimitive.SubTrigger
      data-slot="menu-sub-trigger"
      data-inset={inset || undefined}
      className={cx(styles.item, className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className={styles.subArrow} />
    </MenuPrimitive.SubTrigger>
  );
}

function MenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.SubContent
      data-slot="menu-sub-content"
      className={cx(styles.subContent, className)}
      {...props}
    />
  );
}

export {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuLabel,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubTrigger,
  MenuSubContent,
  MenuGroup,
};
