"use client";
/** @registry name="toggle-group" type="ui" title="Toggle group" description="Pressable toggles, alone or in a toolbar group: single or multiple, attached or spaced, horizontal or vertical." */

import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Tooltip } from "./tooltip";

export type ToggleVariant = "ghost" | "outline";
export type ToggleSize = "sm" | "md";
export type ToggleOrientation = "horizontal" | "vertical";

/* ── Pure helpers (exported for tests) ── */

/** Pressed values after pressing `value`. Single mode swaps (or clears unless `required`); multiple mode toggles. */
export function nextPressed(current: string[], value: string, type: "single" | "multiple", required = false): string[] {
  const on = current.includes(value);
  if (type === "multiple") return on ? current.filter((v) => v !== value) : [...current, value];
  if (on) return required ? current : [];
  return [value];
}

/**
 * Where roving focus goes for a key, skipping disabled items and wrapping. Only the arrows that
 * match the orientation move (plus Home / End). Returns null for keys it doesn't handle, -1 if nothing is enabled.
 */
export function rovingTarget(items: { disabled?: boolean }[], from: number, key: string, orientation: ToggleOrientation = "horizontal"): number | null {
  const n = items.length;
  const fwd = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  const back = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const scan = (start: number, dir: 1 | -1) => {
    for (let k = 0; k < n; k++) {
      const i = (((start + dir * k) % n) + n) % n;
      if (!items[i].disabled) return i;
    }
    return -1;
  };
  if (key === fwd) return scan(from + 1, 1);
  if (key === back) return scan(from - 1, -1);
  if (key === "Home") return scan(0, 1);
  if (key === "End") return scan(n - 1, -1);
  return null;
}

/** "a" | null | ["a","b"] → string[] */
function toList(v: string | string[] | null | undefined): string[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

/* ── Look ── */

const SIZE: Record<ToggleSize, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-[12.5px] [&_svg]:size-3.5 pointer-coarse:h-9",
  md: "h-8 gap-2 px-3 text-[13.5px] [&_svg]:size-4 pointer-coarse:h-10",
};
const SQUARE: Record<ToggleSize, string> = { sm: "w-7 px-0 pointer-coarse:w-9", md: "w-8 px-0 pointer-coarse:w-10" };

const BASE = cn(
  "relative inline-flex flex-none cursor-pointer items-center justify-center font-medium whitespace-nowrap select-none",
  "transition-[background-color,color,box-shadow] duration-150 ease-[var(--kn-ease-out,cubic-bezier(.22,1,.36,1))] motion-reduce:transition-none",
  "disabled:pointer-events-none disabled:opacity-45 [&_svg]:flex-none",
  focusRing,
);

/* Pressed reads as "ink on": a soft foreground tint and full-strength text. Off is muted. */
const LOOK: Record<ToggleVariant, { off: string; on: string }> = {
  ghost: {
    off: "text-muted-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] hover:text-foreground",
    on: "bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_13%,transparent)]",
  },
  // Off is a quiet outline (border, muted ink, no fill). On is plainly set: full ink, a light fill,
  // a firmer ring (and, for a labelled Toggle, a check).
  outline: {
    off: "bg-transparent text-muted-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] hover:text-foreground",
    on: "bg-[color-mix(in_srgb,var(--foreground)_6%,var(--card))] text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_42%,transparent),inset_0_1px_1px_rgb(0_0_0/0.05)] dark:bg-[color-mix(in_srgb,var(--foreground)_12%,var(--card))] dark:shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_40%,transparent)]",
  },
};

/* ── Toggle ── */

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  /** Glyph before the label. Without children the toggle is square: give it an aria-label. */
  icon?: ReactNode;
  variant?: ToggleVariant;
  size?: ToggleSize;
  /** Hint on hover and focus (recommended for icon-only toggles). */
  tooltip?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** A button that stays pressed (aria-pressed): bold on/off, pin, mute. */
export function Toggle({
  pressed: pressedProp,
  defaultPressed = false,
  onPressedChange,
  icon,
  variant = "ghost",
  size = "md",
  tooltip,
  className,
  children,
  onClick,
  ...rest
}: ToggleProps) {
  const [own, setOwn] = useState(defaultPressed);
  const pressed = pressedProp ?? own;
  const square = children === undefined || children === null || children === false;
  const button = (
    <button
      type="button"
      aria-pressed={pressed}
      data-state={pressed ? "on" : "off"}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (pressedProp === undefined) setOwn(!pressed);
        onPressedChange?.(!pressed);
      }}
      className={cn(BASE, "rounded-[8px]", SIZE[size], square && SQUARE[size], pressed ? LOOK[variant].on : LOOK[variant].off, className)}
      {...rest}
    >
      {icon && <span aria-hidden className="contents">{icon}</span>}
      {!icon && !square && variant === "outline" && pressed && <Check />}
      {!square && <span>{children}</span>}
    </button>
  );
  return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="-ml-0.5">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

/* ── Group ── */

export interface ToggleOption {
  value: string;
  label?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Hover / focus hint. Icon-only options also use it as their accessible name when there's no aria-label. */
  tooltip?: string;
  "aria-label"?: string;
}

interface GroupCommon {
  "aria-label": string;
  /** Items as data. Or pass <ToggleGroupItem> children. */
  options?: ToggleOption[];
  children?: ReactNode;
  /** Default "outline". */
  variant?: ToggleVariant;
  size?: ToggleSize;
  /** Joined segments with shared edges (default) or separate toggles with a gap. */
  attached?: boolean;
  orientation?: ToggleOrientation;
  disabled?: boolean;
  className?: string;
}
export interface ToggleGroupSingleProps extends GroupCommon {
  type: "single";
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Keep one item pressed: pressing the pressed item does nothing. */
  required?: boolean;
}
export interface ToggleGroupMultipleProps extends GroupCommon {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}
export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

type Edge = "first" | "middle" | "last" | "only";

interface GroupCtx {
  pressed: string[];
  press: (value: string) => void;
  tabStop: string | undefined;
  setActive: (value: string) => void;
  register: (value: string, el: HTMLButtonElement | null) => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>, value: string) => void;
  variant: ToggleVariant;
  size: ToggleSize;
  attached: boolean;
  orientation: ToggleOrientation;
  disabled: boolean;
}
const Ctx = createContext<GroupCtx | null>(null);
const EdgeCtx = createContext<Edge>("only");

/* Joined segments: round only the outer corners; hairline dividers between items. */
function edgeClass(edge: Edge, orientation: ToggleOrientation, variant: ToggleVariant): string {
  // Ghost segments sit inside a padded tray, so each keeps its own corners.
  if (variant === "ghost") return "rounded-[7px]";
  const h = orientation === "horizontal";
  const round = {
    only: "rounded-[8px]",
    first: h ? "rounded-l-[8px] rounded-r-none" : "rounded-t-[8px] rounded-b-none",
    last: h ? "rounded-r-[8px] rounded-l-none" : "rounded-b-[8px] rounded-t-none",
    middle: "rounded-none",
  }[edge];
  // Each later segment paints over its neighbour's ring, so touching segments share one hairline;
  // pressed and focused ones are lifted so their stronger ring shows on both sides.
  return cn(round, "focus-visible:z-10 aria-pressed:z-[1]");
}

export interface ToggleGroupItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange"> {
  value: string;
  icon?: ReactNode;
  tooltip?: string;
}

/** One toggle inside a ToggleGroup. */
export function ToggleGroupItem({ value, icon, tooltip, disabled, className, children, onClick, "aria-label": ariaLabel, ...rest }: ToggleGroupItemProps) {
  const g = useContext(Ctx);
  const edge = useContext(EdgeCtx);
  if (!g) throw new Error("ToggleGroupItem must be inside a ToggleGroup");
  const on = g.pressed.includes(value);
  const off = disabled || g.disabled;
  const square = children === undefined || children === null || children === false;
  const button = (
    <button
      type="button"
      ref={(el) => g.register(value, el)}
      aria-pressed={on}
      aria-label={ariaLabel ?? (square ? tooltip : undefined)}
      data-state={on ? "on" : "off"}
      disabled={off}
      tabIndex={g.tabStop === value ? 0 : -1}
      onFocus={() => g.setActive(value)}
      onKeyDown={(e) => g.onKey(e, value)}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) g.press(value);
      }}
      className={cn(
        BASE,
        SIZE[g.size],
        square && SQUARE[g.size],
        on ? LOOK[g.variant].on : LOOK[g.variant].off,
        g.attached ? edgeClass(edge, g.orientation, g.variant) : "rounded-[8px]",
        g.attached && g.orientation === "vertical" && !square && "justify-start",
        className,
      )}
      {...rest}
    >
      {icon && <span aria-hidden className="contents">{icon}</span>}
      {!square && <span>{children}</span>}
    </button>
  );
  return tooltip ? (
    <Tooltip content={tooltip} className={cn(g.orientation === "vertical" && "w-full [&>button]:w-full")}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

/**
 * A set of pressed-state toggles (role="toolbar"): bold / italic / underline, alignment, view.
 * Unlike SegmentedControl, every item is an independent aria-pressed button; arrows only move
 * focus (one tab stop), and Space / Enter press. Single mode may be cleared unless `required`.
 */
export function ToggleGroup(props: ToggleGroupProps) {
  const {
    "aria-label": label,
    options,
    children,
    variant = "outline",
    size = "md",
    attached = true,
    orientation = "horizontal",
    disabled = false,
    className,
    type,
  } = props;

  const [own, setOwn] = useState<string[]>(() => toList(props.defaultValue));
  const pressed = props.value !== undefined ? toList(props.value) : own;
  const required = type === "single" && !!props.required;

  // Items in order, from options or direct <ToggleGroupItem> children.
  const childItems = Children.toArray(children).filter((c): c is ReactElement<ToggleGroupItemProps> => isValidElement(c));
  const items: { value: string; disabled?: boolean }[] = options
    ? options.map((o) => ({ value: o.value, disabled: o.disabled || disabled }))
    : childItems.map((c) => ({ value: c.props.value, disabled: c.props.disabled || disabled }));

  const [active, setActive] = useState<string | undefined>(undefined);
  const enabled = items.filter((i) => !i.disabled);
  const tabStop =
    (active && enabled.some((i) => i.value === active) ? active : undefined) ??
    enabled.find((i) => pressed.includes(i.value))?.value ??
    enabled[0]?.value;

  const els = useRef(new Map<string, HTMLButtonElement>());
  const register = useCallback((value: string, el: HTMLButtonElement | null) => {
    if (el) els.current.set(value, el);
    else els.current.delete(value);
  }, []);

  const press = (value: string) => {
    const next = nextPressed(pressed, value, type, required);
    if (props.value === undefined) setOwn(next);
    if (type === "single") props.onValueChange?.(next[0] ?? null);
    else props.onValueChange?.(next);
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, value: string) => {
    const from = items.findIndex((i) => i.value === value);
    const to = rovingTarget(items, from, e.key, orientation);
    if (to === null || to < 0) return;
    e.preventDefault();
    const v = items[to].value;
    setActive(v);
    els.current.get(v)?.focus();
  };

  const ctx: GroupCtx = { pressed, press, tabStop, setActive, register, onKey, variant, size, attached, orientation, disabled };
  const n = items.length;
  const edgeOf = (i: number): Edge => (n === 1 ? "only" : i === 0 ? "first" : i === n - 1 ? "last" : "middle");

  const content = options
    ? options.map((o, i) => (
        <EdgeCtx.Provider key={o.value} value={edgeOf(i)}>
          <ToggleGroupItem value={o.value} icon={o.icon} disabled={o.disabled} tooltip={o.tooltip} aria-label={o["aria-label"]}>
            {o.label}
          </ToggleGroupItem>
        </EdgeCtx.Provider>
      ))
    : childItems.map((c, i) => (
        <EdgeCtx.Provider key={c.key ?? i} value={edgeOf(i)}>
          {c}
        </EdgeCtx.Provider>
      ));

  return (
    <Ctx.Provider value={ctx}>
      <div
        role="toolbar"
        aria-label={label}
        aria-orientation={orientation}
        aria-disabled={disabled || undefined}
        data-orientation={orientation}
        className={cn(
          "inline-flex w-max",
          orientation === "vertical" ? "flex-col items-stretch" : "items-center",
          attached
            ? variant === "ghost" && "gap-0.5 rounded-[10px] p-0.5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent)]"
            : "gap-1",
          className,
        )}
      >
        {content}
      </div>
    </Ctx.Provider>
  );
}

export default ToggleGroup;
