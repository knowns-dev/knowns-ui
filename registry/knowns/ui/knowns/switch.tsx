"use client";

import { useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/** On/off toggle (role="switch"). Controlled with `checked`, or uncontrolled with `defaultChecked`. */
export function Switch({ checked, defaultChecked = false, onCheckedChange, label, disabled, id, className, ...aria }: SwitchProps) {
  const [own, setOwn] = useState(defaultChecked);
  const on = checked ?? own;
  const toggle = () => {
    if (checked === undefined) setOwn(!on);
    onCheckedChange?.(!on);
  };
  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "relative inline-flex h-5 w-8.5 flex-none cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        on ? "bg-primary" : "bg-[color-mix(in_srgb,var(--foreground)_16%,transparent)]",
        focusRing,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-[translate] duration-200 ease-[cubic-bezier(.22,1,.36,1)]",
          on && "translate-x-3.5",
          on && "dark:bg-[var(--primary-foreground)]",
        )}
      />
    </button>
  );
  if (!label) return <span className={className}>{control}</span>;
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5 text-[13.5px]", className)}>
      {control}
      <span>{label}</span>
    </label>
  );
}
