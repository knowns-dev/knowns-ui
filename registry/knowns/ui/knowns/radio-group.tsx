"use client";
/** @registry name="radio-group" type="ui" title="Radio group" description="One choice from a few options; arrow keys move and select; card variant." */

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

/**
 * The next enabled option from `from` in direction `dir`, wrapping around. From -1 it starts at
 * the first (dir 1) or last (dir -1). Returns -1 when every option is disabled.
 */
export function nextEnabled(options: { disabled?: boolean }[], from: number, dir: 1 | -1): number {
  const n = options.length;
  if (!n) return -1;
  let i = from < 0 ? (dir === 1 ? -1 : n) : from;
  for (let step = 0; step < n; step++) {
    i = (i + dir + n) % n;
    if (!options[i].disabled) return i;
  }
  return -1;
}

/** Which radio takes Tab: the selected one if it can, else the first enabled one. */
export function tabStop(options: { value: string; disabled?: boolean }[], value: string | undefined): number {
  const i = options.findIndex((o) => o.value === value && !o.disabled);
  return i >= 0 ? i : nextEnabled(options, -1, 1);
}

export interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Visible title of the group. Without it, pass aria-label. */
  legend?: ReactNode;
  "aria-label"?: string;
  /** Muted line under the legend. */
  description?: ReactNode;
  orientation?: "vertical" | "horizontal";
  size?: "sm" | "md";
  /** "card": each option is a bordered row that lights up when selected. */
  variant?: "default" | "card";
  /** Submitted with forms through a hidden input. */
  name?: string;
  disabled?: boolean;
  className?: string;
}

const SIZE = {
  sm: { dot: "size-3.5", inner: "size-1.5", text: "text-[12.5px]", desc: "text-[12px]", gap: "gap-2", pad: "pt-[3px]" },
  md: { dot: "size-4", inner: "size-1.5", text: "text-[13.5px]", desc: "text-[12.5px]", gap: "gap-2.5", pad: "pt-0.5" },
};

/**
 * One choice from a short list. Tab enters on the selected radio; the arrow keys move and select,
 * skipping disabled options; Home and End jump to the ends.
 */
export function RadioGroup({
  options,
  value,
  defaultValue,
  onValueChange,
  legend,
  "aria-label": ariaLabel,
  description,
  orientation = "vertical",
  size = "md",
  variant = "default",
  name,
  disabled = false,
  className,
}: RadioGroupProps) {
  const [local, setLocal] = useState(defaultValue);
  const selected = value !== undefined ? value : local;
  const items = options.map((o) => ({ ...o, disabled: disabled || o.disabled }));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const stop = tabStop(items, selected);
  const s = SIZE[size];
  const card = variant === "card";

  const choose = (i: number) => {
    const o = items[i];
    if (!o || o.disabled) return;
    refs.current[i]?.focus();
    if (o.value === selected) return;
    if (value === undefined) setLocal(o.value);
    onValueChange?.(o.value);
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const back = e.key === "ArrowUp" || e.key === "ArrowLeft";
    const fwd = e.key === "ArrowDown" || e.key === "ArrowRight";
    let to = -1;
    if (fwd || back) to = nextEnabled(items, i, fwd ? 1 : -1);
    else if (e.key === "Home") to = nextEnabled(items, -1, 1);
    else if (e.key === "End") to = nextEnabled(items, -1, -1);
    else if (e.key === " ") to = i;
    else return;
    e.preventDefault();
    if (to >= 0) choose(to);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {legend && (
        <div id={`${base}-legend`} className="text-[13px] font-medium">
          {legend}
        </div>
      )}
      {description && (
        <p id={`${base}-desc`} className="-mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      )}
      <div
        role="radiogroup"
        aria-label={legend ? undefined : ariaLabel}
        aria-labelledby={legend ? `${base}-legend` : undefined}
        aria-describedby={description ? `${base}-desc` : undefined}
        aria-orientation={orientation}
        aria-disabled={disabled || undefined}
        className={cn("flex", orientation === "horizontal" ? "flex-row flex-wrap" : "flex-col", card ? "gap-2" : orientation === "horizontal" ? "gap-x-5 gap-y-2" : "gap-2.5")}
      >
        {items.map((o, i) => {
          const on = o.value === selected;
          const id = `${base}-${i}`;
          return (
            <button
              key={o.value}
              ref={(el) => void (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={o.disabled || undefined}
              aria-labelledby={`${id}-l`}
              aria-describedby={o.description ? `${id}-d` : undefined}
              tabIndex={i === stop ? 0 : -1}
              onClick={() => choose(i)}
              onKeyDown={(e) => onKey(e, i)}
              data-state={on ? "checked" : "unchecked"}
              className={cn(
                "group/radio flex cursor-pointer items-start text-left outline-none",
                s.gap,
                s.text,
                o.disabled && "cursor-not-allowed opacity-50",
                card
                  ? cn(
                      "rounded-[10px] px-3 py-2.5 transition-[background-color,box-shadow] duration-(--kn-dur-fast) ease-(--kn-ease-out)",
                      on
                        ? "bg-[color-mix(in_srgb,var(--primary)_5%,var(--card))] shadow-[0_0_0_1.5px_var(--primary),0_1px_2px_rgb(0_0_0/0.06)]"
                        : "bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_12%,transparent),0_1px_2px_rgb(0_0_0/0.04)]",
                      !o.disabled && !on && "hover:bg-[color-mix(in_srgb,var(--muted)_45%,var(--card))]",
                      "focus-visible:shadow-[0_0_0_1.5px_var(--ring),0_0_0_5px_color-mix(in_srgb,var(--ring)_22%,transparent)]",
                      orientation === "horizontal" && "min-w-40 flex-1",
                    )
                  : "rounded-[6px]",
              )}
            >
              <span className={cn("flex-none", s.pad)}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid place-items-center rounded-full transition-[background-color,box-shadow] duration-(--kn-dur-fast) ease-(--kn-ease-out)",
                    on
                      ? "bg-primary shadow-[0_0_0_1px_var(--primary)]"
                      : "bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_24%,transparent),0_1px_1px_rgb(0_0_0/0.05)]",
                    // The keyboard ring sits on the circle in the plain variant; cards ring the whole row.
                    !card && "group-focus-visible/radio:outline-2 group-focus-visible/radio:outline-offset-2 group-focus-visible/radio:outline-ring",
                    s.dot,
                  )}
                >
                  <span className={cn("rounded-full bg-primary-foreground transition-[scale,opacity] ease-(--kn-ease-out)", s.inner, on ? "scale-100 opacity-100 duration-(--kn-dur)" : "scale-90 opacity-0 duration-(--kn-dur-fast)")} />
                </span>
              </span>
              <span className="flex min-w-0 flex-col">
                <span id={`${id}-l`} className="font-medium leading-snug">
                  {o.label}
                </span>
                {o.description && (
                  <span id={`${id}-d`} className={cn("text-muted-foreground", s.desc)}>
                    {o.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {name && <input type="hidden" name={name} value={selected ?? ""} disabled={disabled} />}
    </div>
  );
}
