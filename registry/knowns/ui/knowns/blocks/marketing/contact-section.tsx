"use client";
/** @registry name="contact-section" type="block" title="Contact section" description="Contact methods beside a form with name, email, topic and message: labelled fields, errors that clear as they are fixed, focus on the first problem, a callback, and a same-height thank-you panel." */

/**
 * Contact page section: heading, the ways to reach you (email, chat, office...), and a form with
 * name, email, topic and message. Validates on submit and as fields are fixed, calls `onSubmit`,
 * and swaps the form for a thank-you panel of the same height so the page doesn't jump.
 */
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { buttonClass } from "../../button";
import { Field, Input, Textarea } from "../../input";
import { Select } from "../../select";
import { SectionHeading } from "./section-heading";
import { contactErrors, type ContactErrors, type ContactValues } from "./marketing-2b-utils";

export interface ContactMethod {
  label: string;
  /** "hello@acme.dev", "Mon to Fri, 9 to 5 CET"... */
  value: ReactNode;
  href?: string;
  icon?: ReactNode;
  /** Small line under the value. */
  note?: ReactNode;
}

export interface ContactSectionProps {
  /** Send the message. Resolve on success; throw or return a message on failure. */
  onSubmit: (values: ContactValues) => Promise<void | string | null | undefined> | void | string | null | undefined;
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  /** Topic choices. Pass [] to drop the field. */
  topics?: string[];
  methods?: ContactMethod[];
  /** Message length limits. Default 10 to 2000. */
  minMessage?: number;
  maxMessage?: number;
  submitLabel?: string;
  /** Thank-you text. Receives what was sent. */
  successText?: (values: ContactValues) => ReactNode;
  /**
   * "split": methods beside the form (default). "cards": methods as cards above a centred form.
   * "simple": a centred form with the methods as one line of links under it.
   */
  layout?: "split" | "cards" | "simple";
  /** Split layout: form on the right (default) or left of the methods. */
  formSide?: "left" | "right";
  className?: string;
}

const DEFAULT_TOPICS = ["General question", "Sales", "Support", "Partnership"];
const EMPTY: ContactValues = { name: "", email: "", topic: "", message: "" };

export const MethodIcons = {
  email: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
      <path d="m3 5.5 7 5.5 7-5.5" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-3.5 3v-3a2 2 0 0 1-2-2z" />
    </svg>
  ),
  office: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M10 17.5s5.5-4.6 5.5-9a5.5 5.5 0 0 0-11 0c0 4.4 5.5 9 5.5 9z" />
      <circle cx="10" cy="8.5" r="2" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 3h3l1.5 4-2 1.2a9 9 0 0 0 4.8 4.8L13 11l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A13.5 13.5 0 0 1 3 4.6 1.5 1.5 0 0 1 4.5 3z" />
    </svg>
  ),
} as const;

function Methods({ methods }: { methods: ContactMethod[] }) {
  if (!methods.length) return null;
  return (
    <ul className="flex flex-col divide-y [&>li]:[border-color:color-mix(in_srgb,var(--foreground)_8%,transparent)]">
      {methods.map((m) => {
        const body = (
          <>
            {m.icon && <span className="grid size-9 flex-none place-items-center rounded-lg border bg-card text-muted-foreground [&>svg]:size-[18px]">{m.icon}</span>}
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] text-muted-foreground">{m.label}</span>
              <span className="text-[15px] font-medium break-words">{m.value}</span>
              {m.note && <span className="mt-1 text-[13px] text-muted-foreground">{m.note}</span>}
            </span>
          </>
        );
        return (
          <li key={m.label} className="py-4 first:pt-0 last:pb-0">
            {m.href ? (
              <a href={m.href} className={cn("-m-1 flex items-start gap-3 rounded-lg p-1 transition-colors hover:[&_span.font-medium]:underline", focusRing)}>
                {body}
              </a>
            ) : (
              <div className="flex items-start gap-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ContactSection({
  onSubmit,
  eyebrow,
  title = "Talk to us",
  lead = "Questions about plans, a bug you can't shake, or an idea for a component. A person reads every message.",
  topics = DEFAULT_TOPICS,
  methods = [],
  minMessage = 10,
  maxMessage = 2000,
  submitLabel = "Send message",
  successText,
  layout = "split",
  formSide = "right",
  className,
}: ContactSectionProps) {
  const id = useId();
  const [v, setV] = useState<ContactValues>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [tried, setTried] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [sent, setSent] = useState<ContactValues | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const rules = { topics: topics.length ? topics : undefined, minMessage, maxMessage };

  const set = <K extends keyof ContactValues>(k: K, val: string) => {
    const next = { ...v, [k]: val };
    setV(next);
    // After the first submit, errors clear as the person fixes each field.
    if (tried) setErrors(contactErrors(next, rules));
    if (state === "error") setState("idle");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    const errs = contactErrors(v, rules);
    setErrors(errs);
    const first = (["name", "email", "topic", "message"] as const).find((k) => errs[k]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setState("loading");
    setFailure(null);
    try {
      const clean = { name: v.name.trim(), email: v.email.trim(), topic: v.topic, message: v.message.trim() };
      const r = await onSubmit(clean);
      if (typeof r === "string" && r) {
        setFailure(r);
        setState("error");
        return;
      }
      setHeight(formRef.current?.offsetHeight ?? null);
      setSent(clean);
      setState("success");
    } catch (err) {
      setFailure(err instanceof Error && err.message ? err.message : "Your message didn't go through. Try again, or email us directly.");
      setState("error");
    }
  };

  const reset = () => {
    setV(EMPTY);
    setErrors({});
    setTried(false);
    setSent(null);
    setState("idle");
    setHeight(null);
  };

  const fid = (k: string) => `${id}-${k}`;
  const busy = state === "loading";

  const form =
    state === "success" && sent ? (
      <div role="status" style={height ? { minHeight: height } : undefined} className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-6 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
          <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
        </span>
        <p className="text-[20px] font-medium">Message sent</p>
        <p className="max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          {successText ? (
            successText(sent)
          ) : (
            <>
              Thanks, {sent.name.split(/\s+/)[0]}. We'll reply to <span className="font-medium text-foreground break-all">{sent.email}</span>, usually within one business day.
            </>
          )}
        </p>
        <button type="button" onClick={reset} className={buttonClass("ghost", "sm", false, "mt-1")}>
          Send another message
        </button>
      </div>
    ) : (
      <form ref={formRef} noValidate onSubmit={submit} aria-label="Contact form" className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={fid("name")} label="Name" required error={errors.name}>
            <Input id={fid("name")} name="name" autoComplete="name" value={v.name} disabled={busy} invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field id={fid("email")} label="Email" required error={errors.email}>
            <Input id={fid("email")} name="email" type="email" autoComplete="email" inputMode="email" value={v.email} disabled={busy} invalid={!!errors.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
        </div>
        {topics.length > 0 && (
          <Field id={fid("topic")} label="Topic" required error={errors.topic}>
            <Select id={fid("topic")} name="topic" options={topics} placeholder="Choose a topic" value={v.topic} disabled={busy} invalid={!!errors.topic} onChange={(e) => set("topic", e.target.value)} />
          </Field>
        )}
        <Field id={fid("message")} label="Message" required error={errors.message}>
          <Textarea id={fid("message")} name="message" rows={5} maxLength={maxMessage} value={v.message} disabled={busy} invalid={!!errors.message} onChange={(e) => set("message", e.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className={cn("text-[13px]", state === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
            {state === "error" ? failure : "We only use your email to reply."}
          </p>
          <button type="submit" disabled={busy} aria-busy={busy || undefined} className={buttonClass("primary", "md", false, "relative flex-none")}>
            <span className={cn(busy && "invisible")}>{submitLabel}</span>
            {busy && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden />
                <span className="sr-only">Sending</span>
              </span>
            )}
          </button>
        </div>
      </form>
    );

  const pad = "@container mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24";

  if (layout === "cards")
    return (
      <section data-slot="contact-section" className={cn(pad, "flex flex-col gap-12", className)}>
        <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        {methods.length > 0 && (
          <ul className="grid gap-4 @[640px]:grid-cols-3">
            {methods.map((m) => (
              <li key={m.label} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
                {m.icon && <span className="grid size-9 place-items-center rounded-lg border bg-background text-muted-foreground [&>svg]:size-[18px]">{m.icon}</span>}
                <span className="text-[13px] text-muted-foreground">{m.label}</span>
                {m.href ? (
                  <a href={m.href} className={cn("w-fit rounded-sm text-[15px] font-medium break-words hover:underline", focusRing)}>
                    {m.value}
                  </a>
                ) : (
                  <span className="text-[15px] font-medium break-words">{m.value}</span>
                )}
                {m.note && <span className="text-[13px] text-muted-foreground">{m.note}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mx-auto w-full max-w-2xl">{form}</div>
      </section>
    );

  if (layout === "simple")
    return (
      <section data-slot="contact-section" className={cn(pad, "flex flex-col items-center gap-8", className)}>
        <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        <div className="w-full max-w-xl">{form}</div>
        {methods.some((m) => m.href) && (
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[14px] text-muted-foreground">
            {methods
              .filter((m) => m.href)
              .map((m) => (
                <a key={m.label} href={m.href} className={cn("rounded-sm hover:text-foreground hover:underline", focusRing)}>
                  {m.label}: <span className="text-foreground">{m.value}</span>
                </a>
              ))}
          </p>
        )}
      </section>
    );

  return (
    <section data-slot="contact-section" className={cn(pad, className)}>
      <div className="grid gap-x-12 gap-y-8 @[820px]:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className={cn("flex flex-col gap-8", formSide === "left" && "@[820px]:order-2")}>
          <SectionHeading eyebrow={eyebrow} title={title} lead={lead} align="start" />
          <Methods methods={methods} />
        </div>
        <div className="min-w-0">{form}</div>
      </div>
    </section>
  );
}

export default ContactSection;
