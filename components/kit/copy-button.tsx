"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Copies a value to the clipboard and says so. The label reverts after two seconds.
 */
export function CopyButton({ value, label = "Copy", copiedLabel = "Copied" }: {
  value: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context). Leave the label unchanged.
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={copy}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
