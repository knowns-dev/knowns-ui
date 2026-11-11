"use client";
/** @registry name="alert" type="ui" title="Alert" description="An inline callout with info, success, warning and error tones, an optional title, one action and a dismiss button." */

import { cva } from "class-variance-authority";
import { useId, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "./button";

export type AlertTone = "neutral" | "accent" | "info" | "success" | "warning" | "danger";

/**
 * One signal per tone: the icon. Its colour and its shape (circle-i, check, triangle, octagon) both say which
 * tone it is, so it holds up without colour. The surface stays a plain card with a hairline border and the
 * text stays foreground: no tinted fill, coloured border and dot stacked on top of each other.
 */
const TONE_VAR: Record<AlertTone, string> = {
  neutral: "[--alert-tone:var(--muted-foreground)]",
  accent: "[--alert-tone:var(--kn-accent,var(--primary))]",
  info: "[--alert-tone:var(--color-sky-600)] dark:[--alert-tone:var(--color-sky-400)]",
  success: "[--alert-tone:var(--color-emerald-600)] dark:[--alert-tone:var(--color-emerald-400)]",
  warning: "[--alert-tone:var(--color-amber-600)] dark:[--alert-tone:var(--color-amber-400)]",
  danger: "[--alert-tone:var(--color-red-600)] dark:[--alert-tone:var(--color-red-400)]",
};

/** The surface as a cva map. Each tone sets `--alert-tone`, the icon colour: add your own tone under `tone`. */
export const alertVariants = cva("flex gap-3 rounded-xl border bg-card p-3.5 text-[13.5px] leading-relaxed text-card-foreground", { variants: { tone: TONE_VAR }, defaultVariants: { tone: "info" } });

const GLYPH: Record<AlertTone, ReactNode> = {
  neutral: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v3.5M8 5.2v.05" />
    </>
  ),
  accent: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v3.5M8 5.2v.05" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v3.5M8 5.2v.05" />
    </>
  ),
  success: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5.4 8.2l1.8 1.8 3.4-3.7" />
    </>
  ),
  warning: (
    <>
      <path d="M8 2.2l6 10.6H2z" />
      <path d="M8 6.6v2.6M8 11v.05" />
    </>
  ),
  danger: (
    <>
      <path d="M5.2 1.9h5.6l3.3 3.3v5.6l-3.3 3.3H5.2L1.9 10.8V5.2z" />
      <path d="M8 5.3v3.2M8 10.5v.05" />
    </>
  ),
};

/** Warning and danger interrupt a screen reader (role=alert); info and success wait their turn (role=status). */
export function alertRole(tone: AlertTone): "alert" | "status" {
  return tone === "warning" || tone === "danger" ? "alert" : "status";
}

export interface AlertProps {
  /** Default "info". */
  tone?: AlertTone;
  /** Bold first line. Without it the message is the only line. */
  title?: ReactNode;
  children?: ReactNode;
  /** One button, e.g. { label: "Retry", onClick }. It does not dismiss the alert. */
  action?: { label: string; onClick: () => void };
  /** Shows a dismiss button; the alert hides itself and calls this. Controlled use: render it conditionally. */
  onDismiss?: () => void;
  /** Replaces the tone's icon. */
  icon?: ReactNode;
  className?: string;
}

/**
 * Alert: an inline callout that sits in the flow of a page or a form, beside what it is about. For a message
 * that appears from an event and fades, use Toast; for one the user must answer, use Dialog.
 */
export function Alert({ tone = "info", title, children, action, onDismiss, icon, className }: AlertProps) {
  const [hidden, setHidden] = useState(false);
  const titleId = useId();
  if (hidden) return null;
  return (
    <div
      role={alertRole(tone)}
      aria-labelledby={title ? titleId : undefined}
      data-tone={tone}
      className={cn(alertVariants({ tone }), className)}
    >
      <span aria-hidden="true" className={cn("mt-px flex size-5 flex-none items-center justify-center text-(--alert-tone) [&_svg]:size-[18px]")}>
        {icon ?? (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {GLYPH[tone]}
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        {title && (
          <div id={titleId} className="font-medium">
            {title}
          </div>
        )}
        {children && <div className={cn(title && "mt-0.5 text-muted-foreground")}>{children}</div>}
        {action && (
          <div className="mt-2.5">
            <Button variant="secondary" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setHidden(true);
            onDismiss();
          }}
          className={cn("-m-1.5 -mr-1.5 flex size-8 flex-none cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:size-11", focusRing)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      )}
    </div>
  );
}
