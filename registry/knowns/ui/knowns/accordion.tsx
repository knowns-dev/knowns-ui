"use client";

import { createContext, useContext, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";

type Kind = "single" | "multiple";

type Ctx = {
  kind: Kind;
  open: Set<string>;
  toggle: (v: string) => void;
  collapsible: boolean;
  id: string;
};
const AccordionCtx = createContext<Ctx | null>(null);
const ItemCtx = createContext<string | null>(null);

const useAcc = () => {
  const c = useContext(AccordionCtx);
  if (!c) throw new Error("Accordion parts must be inside <Accordion>");
  return c;
};

export interface AccordionProps {
  /** "single" opens one item; "multiple" allows several. */
  type?: Kind;
  /** For type="single", whether the open item can be closed. */
  collapsible?: boolean;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  children: ReactNode;
  className?: string;
}

function asSet(v: string | string[] | undefined): Set<string> {
  if (v == null || v === "") return new Set();
  return new Set(Array.isArray(v) ? v : [v]);
}

function emit(kind: Kind, open: Set<string>): string | string[] {
  const list = [...open];
  return kind === "single" ? (list[0] ?? "") : list;
}

/** A list of collapsible sections. Keyboard: Enter/Space toggles, Up/Down moves between headers. */
export function Accordion({
  type = "single",
  collapsible = true,
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: AccordionProps) {
  const [own, setOwn] = useState(() => asSet(defaultValue));
  const open = value !== undefined ? asSet(value) : own;
  const id = useId();
  const toggle = (v: string) => {
    const next = new Set(open);
    if (next.has(v)) {
      if (type === "single" && !collapsible) return;
      next.delete(v);
    } else {
      if (type === "single") next.clear();
      next.add(v);
    }
    if (value === undefined) setOwn(next);
    onValueChange?.(emit(type, next));
  };
  return (
    <AccordionCtx.Provider value={{ kind: type, open, toggle, collapsible, id }}>
      <div data-acc-root="" className={cn("flex flex-col", className)}>
        {children}
      </div>
    </AccordionCtx.Provider>
  );
}

export function AccordionItem({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <ItemCtx.Provider value={value}>
      <div className={cn("border-b", className)} data-open={useAcc().open.has(value) || undefined}>
        {children}
      </div>
    </ItemCtx.Provider>
  );
}

export function AccordionTrigger({ children, className }: { children: ReactNode; className?: string }) {
  const acc = useAcc();
  const value = useContext(ItemCtx);
  if (!value) throw new Error("AccordionTrigger must be inside AccordionItem");
  const on = acc.open.has(value);
  const panel = `${acc.id}-${value}`;
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const root = e.currentTarget.closest("[data-acc-root]") ?? e.currentTarget.parentElement?.parentElement?.parentElement;
    const buttons = [...(root?.querySelectorAll<HTMLButtonElement>("[data-acc-trigger]") ?? [])];
    const i = buttons.indexOf(e.currentTarget);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : e.key === "ArrowDown" ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  return (
    <h3 className="m-0">
      <button
        type="button"
        data-acc-trigger=""
        aria-expanded={on}
        aria-controls={panel}
        onClick={() => acc.toggle(value)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-4 py-4 text-left text-[15px] font-medium outline-none hover:text-foreground",
          on ? "text-foreground" : "text-foreground/90",
          focusRing,
          className,
        )}
      >
        {children}
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", on ? "rotate-180" : "rotate-0")}
        >
          <path d="M4 6.5 8 10.5 12 6.5" />
        </svg>
      </button>
    </h3>
  );
}

export function AccordionContent({ children, className }: { children: ReactNode; className?: string }) {
  const acc = useAcc();
  const value = useContext(ItemCtx);
  if (!value) throw new Error("AccordionContent must be inside AccordionItem");
  const on = acc.open.has(value);
  return (
    <div
      id={`${acc.id}-${value}`}
      role="region"
      inert={!on}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
        on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={cn("pb-5 text-[14px] leading-relaxed text-muted-foreground", className)}>{children}</div>
      </div>
    </div>
  );
}
