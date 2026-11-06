"use client";
/** @registry name="cta-section" type="block" title="CTA section" description="Closing call to action: headline, lead, one or two buttons or an email capture with validation, busy, error and thank-you states, on a plain, accent or inverted panel or over a background. Centred or split layout." */

/**
 * CTASection: the closing ask. A headline, a lead, one or two buttons or an email capture, on a tone:
 * plain, accent, inverted, or your own background (one of our Backgrounds) behind the panel.
 */
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../../button";
import { Input } from "../../input";
import { ActionButton } from "./section-heading";
import type { MarketingAction } from "./marketing-utils";

export type { MarketingAction } from "./marketing-utils";

export interface CTASectionProps {
  title: ReactNode;
  lead?: ReactNode;
  primary?: MarketingAction;
  secondary?: MarketingAction;
  /** An email field and button instead of (or with) the buttons. Throw with a message to show an error. */
  capture?: {
    onSubmit: (email: string) => void | Promise<void>;
    placeholder?: string;
    button?: string;
    thanks?: ReactNode;
    /** Small print under the field, e.g. "No credit card needed." */
    note?: ReactNode;
  };
  tone?: "plain" | "accent" | "inverted";
  /** Behind the panel: one of our Backgrounds, sized to fill. */
  background?: ReactNode;
  /** Centred (default) or text left with actions right from 1024px. */
  layout?: "center" | "split";
  className?: string;
}

const TONE = {
  plain: "bg-card text-foreground border",
  accent: "bg-indigo-600 text-white dark:bg-indigo-500",
  inverted: "bg-foreground text-background",
};

export function looksLikeEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

function Capture({ cfg, onDark }: { cfg: NonNullable<CTASectionProps["capture"]>; onDark: boolean }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!looksLikeEmail(email)) {
      setState("error");
      setError("Enter an email address like name@example.com.");
      return;
    }
    setState("busy");
    setError(null);
    try {
      await cfg.onSubmit(email.trim());
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error && err.message ? err.message : "That didn't work. Try again in a moment.");
    }
  };
  if (state === "done")
    return (
      <p role="status" className="flex min-h-10 items-center text-[16px] font-semibold">
        {cfg.thanks ?? "You're on the list. Check your inbox."}
      </p>
    );
  return (
    <form onSubmit={submit} noValidate className="flex w-full max-w-md flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-e`} className="sr-only">
          Email address
        </label>
        <Input
          id={`${id}-e`}
          type="email"
          size="lg"
          autoComplete="email"
          placeholder={cfg.placeholder ?? "you@company.com"}
          value={email}
          invalid={state === "error"}
          aria-describedby={`${id}-msg`}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") {
              setState("idle");
              setError(null);
            }
          }}
          className={cn("min-w-0 flex-1", onDark && "text-foreground")}
        />
        <Button type="submit" size="lg" variant={onDark ? "secondary" : "primary"} loading={state === "busy"}>
          {cfg.button ?? "Get started"}
        </Button>
      </div>
      <p id={`${id}-msg`} role={error ? "alert" : undefined} className={cn("min-h-5 text-[13px] leading-5", error ? (onDark ? "font-semibold" : "text-red-600 dark:text-red-400") : "opacity-80")}>
        {error ?? cfg.note ?? " "}
      </p>
    </form>
  );
}

export function CTASection({ title, lead, primary, secondary, capture, tone = "plain", background, layout = "center", className }: CTASectionProps) {
  const onDark = tone !== "plain";
  const split = layout === "split";
  return (
    <section data-slot="cta-section" className={cn("mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24", className)}>
      <div className={cn("relative isolate overflow-hidden rounded-2xl px-6 py-12 sm:px-12 sm:py-16", TONE[tone])}>
        {background && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [&>*]:size-full">
            {background}
          </div>
        )}
        <div className={cn("flex flex-col gap-8", split ? "lg:flex-row lg:items-center lg:justify-between" : "items-center text-center")}>
          <div className={cn("flex max-w-2xl flex-col gap-4", !split && "items-center")}>
            <h2 className="text-balance text-[32px] leading-10 font-semibold sm:text-[36px] sm:leading-[44px]">{title}</h2>
            {lead && <p className={cn("text-pretty text-[16px] leading-7", onDark ? "opacity-80" : "text-muted-foreground")}>{lead}</p>}
          </div>
          <div className={cn("flex flex-col gap-4", split ? "lg:items-end" : "items-center", "w-full lg:w-auto")}>
            {capture && <Capture cfg={capture} onDark={onDark} />}
            {(primary || secondary) && (
              <div className={cn("flex flex-wrap gap-3", !split && "justify-center")}>
                {primary && (
                  <ActionButton action={primary} variant={onDark ? "secondary" : "primary"} />
                )}
                {secondary && (
                  <ActionButton
                    action={secondary}
                    variant="ghost"
                    className={onDark ? "text-current hover:bg-white/10 dark:hover:bg-black/10" : undefined}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
