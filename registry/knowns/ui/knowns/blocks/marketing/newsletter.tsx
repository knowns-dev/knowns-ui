"use client";
/** @registry name="newsletter" type="block" title="Newsletter" description="Email sign-up as an inline band or a compact card: address check, busy state, returned or thrown errors, and a confirmation in the same space. A side offer, separate from the CTA section's capture." deps="marketing-core" */

/**
 * Newsletter sign-up: an inline band (copy left, form right) or a compact card. Checks the address,
 * shows a loading state, then a success or error message in the same space so nothing jumps.
 * You send the email: `onSubscribe` resolves when it worked and throws (or returns an error string)
 * when it didn't.
 */
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { buttonClass } from "../../button";
import { Input } from "../../input";
import { newsletterError } from "./marketing-2b-utils";

export type NewsletterState = "idle" | "loading" | "success" | "error";

export interface NewsletterProps {
  /** Send the address. Resolve on success; throw or return a message on failure. */
  onSubscribe: (email: string) => Promise<void | string | null | undefined> | void | string | null | undefined;
  /** "inline": copy left, form right (default). "centered": a centred band. "card": a compact card for a sidebar or post. */
  variant?: "inline" | "centered" | "card";
  title?: ReactNode;
  text?: ReactNode;
  placeholder?: string;
  /** Submit button label. Default "Subscribe". */
  submitLabel?: string;
  /** Small print under the form. `true` for the default; `false` to hide. */
  note?: ReactNode | boolean;
  /** What to say once it worked. Receives the address. */
  successText?: (email: string) => ReactNode;
  /** Shown with the form, e.g. "Every other Tuesday · 6,000 readers". */
  meta?: ReactNode;
  className?: string;
}

const DEFAULT_NOTE = "No spam. One email a month, and you can unsubscribe in one click.";

function Mail() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
      <path d="m3 5.5 7 5.5 7-5.5" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

export function Newsletter({ onSubscribe, variant = "inline", title = "Get the changelog by email", text = "New components, fixes and the occasional deep dive. Written by the people who build it.", placeholder = "you@company.com", submitLabel = "Subscribe", note = true, successText, meta, className }: NewsletterProps) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<NewsletterState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const fieldError = touched ? newsletterError(email) : null;
  const shownError = fieldError ?? (state === "error" ? error : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const bad = newsletterError(email);
    if (bad) {
      (e.currentTarget as HTMLFormElement).querySelector("input")?.focus();
      return;
    }
    setState("loading");
    setError(null);
    try {
      const r = await onSubscribe(email.trim());
      if (typeof r === "string" && r) {
        setError(r);
        setState("error");
      } else setState("success");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "We couldn't sign you up. Try again in a moment.");
      setState("error");
    }
  };

  const noteText = note === true ? DEFAULT_NOTE : note || null;
  const msgId = `${id}-msg`;

  const form =
    state === "success" ? (
      <div role="status" className="flex min-h-10 items-center gap-3 rounded-xl border bg-card px-4 py-2 text-left text-[14px]">
        <span className="grid size-6 flex-none place-items-center rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
          <Check />
        </span>
        <span className="min-w-0">
          {successText ? (
            successText(email.trim())
          ) : (
            <>
              Check <span className="font-medium break-all">{email.trim()}</span> to confirm your subscription.
            </>
          )}
        </span>
      </div>
    ) : (
      <form noValidate onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`${id}-email`} className="sr-only">
            Email address
          </label>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={placeholder}
            value={email}
            invalid={!!shownError}
            aria-describedby={shownError ? msgId : undefined}
            disabled={state === "loading"}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "error") setState("idle");
            }}
            onBlur={() => email && setTouched(true)}
            className="min-w-0 sm:flex-1"
          />
          <button type="submit" disabled={state === "loading"} aria-busy={state === "loading" || undefined} className={buttonClass("primary", "md", false, "relative flex-none sm:min-w-[7.5rem]")}>
            <span className={cn(state === "loading" && "invisible")}>{submitLabel}</span>
            {state === "loading" && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden />
                <span className="sr-only">Subscribing</span>
              </span>
            )}
          </button>
        </div>
        <p id={msgId} aria-live="polite" className={cn("min-h-5 text-[13px]", shownError ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
          {shownError ?? noteText}
        </p>
      </form>
    );

  if (variant === "card")
    return (
      <section className={cn("mx-auto w-full max-w-md rounded-2xl border bg-card p-6", className)} aria-labelledby={`${id}-title`}>
        <span className="mb-4 grid size-10 place-items-center rounded-xl border bg-background text-muted-foreground">
          <Mail />
        </span>
        <h2 id={`${id}-title`} className="text-[20px] font-semibold">
          {title}
        </h2>
        {text && <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{text}</p>}
        {meta && <p className="mt-3 text-[13px] text-muted-foreground">{meta}</p>}
        <div className="mt-5">{form}</div>
      </section>
    );

  if (variant === "centered")
    return (
      <section data-slot="newsletter" className={cn("mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24", className)} aria-labelledby={`${id}-title`}>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h2 id={`${id}-title`} className="text-balance text-[28px] leading-tight font-semibold sm:text-[32px]">
            {title}
          </h2>
          {text && <p className="text-pretty text-[16px] leading-relaxed text-muted-foreground">{text}</p>}
          {meta && <p className="text-[13px] text-muted-foreground">{meta}</p>}
          <div className="mt-4 w-full max-w-md text-left">{form}</div>
        </div>
      </section>
    );

  return (
    <section data-slot="newsletter" className={cn("@container mx-auto w-full max-w-6xl border-y px-4 py-12 sm:px-6 [border-color:color-mix(in_srgb,var(--foreground)_8%,transparent)]", className)} aria-labelledby={`${id}-title`}>
      <div className="grid items-start gap-x-10 gap-y-5 @[720px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-2">
          <h2 id={`${id}-title`} className="text-balance text-[24px] leading-tight font-semibold">
            {title}
          </h2>
          {text && <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">{text}</p>}
          {meta && <p className="mt-1 text-[13px] text-muted-foreground">{meta}</p>}
        </div>
        <div className="@[720px]:pt-1">{form}</div>
      </div>
    </section>
  );
}

export default Newsletter;
