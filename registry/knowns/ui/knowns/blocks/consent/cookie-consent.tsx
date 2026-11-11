"use client";
/** @registry name="cookie-consent" type="block" title="Cookie consent" description="A consent banner with Accept all, Reject all and Customize, and a preferences dialog with categories (necessary locked on). Saves the choice, calls back, never blocks the page, and rejecting is as easy as accepting." */
/**
 * Cookie consent: a small card that asks once and never blocks the page. Accept all and Reject all are the same
 * button style side by side; Customize opens a dialog with one switch per category (necessary stays on). The choice
 * is saved in localStorage (versioned: a new category asks again) and handed to `onChange`, so you load scripts
 * only after it. The banner does not trap focus or take it; the dialog does. Call `openCookiePreferences()`
 * from a footer link to reopen the dialog. Renders nothing until it has read the saved choice, so a returning
 * visitor sees no flash.
 */
import { useEffect, useId, useState } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../../button";
import { Dialog } from "../../dialog";
import { Switch } from "../../switch";
import { CONSENT_EVENT, acceptAll, normalizeChoice, readConsent, rejectAll, writeConsent, type ConsentChoice } from "./consent-utils";

export interface ConsentCategory {
  id: string;
  label: string;
  description: string;
  /** Strictly necessary: shown on and locked. */
  required?: boolean;
}

export type ConsentSource = "accept_all" | "reject_all" | "custom";

export const DEFAULT_CONSENT_CATEGORIES: ConsentCategory[] = [
  { id: "necessary", label: "Strictly necessary", description: "Keep you signed in and remember this choice. The site does not work without them.", required: true },
  { id: "analytics", label: "Analytics", description: "Count visits and see which pages are used, so we know what to improve." },
  { id: "marketing", label: "Marketing", description: "Measure campaigns and show relevant offers on other sites." },
];

export interface CookieConsentProps {
  categories?: ConsentCategory[];
  /** localStorage key. `null` keeps the choice in memory only (previews, tests). */
  storageKey?: string | null;
  title?: string;
  description?: string;
  /** A link to your cookie or privacy policy, shown in the text. */
  policy?: { label: string; href: string };
  /** Called with the final choice when someone accepts, rejects or saves. Not called for a choice read from storage. */
  onChange?: (choice: ConsentChoice, source: ConsentSource) => void;
  /** Renders in the flow instead of fixed to the bottom corner (previews, or your own layout). */
  inline?: boolean;
  className?: string;
}

/** A consent banner and preferences dialog that block nothing until people choose. */
export function CookieConsent({
  categories = DEFAULT_CONSENT_CATEGORIES,
  storageKey = "kn-cookie-consent",
  title = "Your cookie choices",
  description = "We use a few cookies to keep the site working and, if you agree, to understand how it is used. Rejecting is fine and changes nothing about what you can do here.",
  policy,
  onChange,
  inline = false,
  className,
}: CookieConsentProps) {
  const uid = useId();
  // "loading": storage not read yet (nothing rendered, so no flash); "ask": show the banner; "done": chosen.
  const [status, setStatus] = useState<"loading" | "ask" | "done">("loading");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentChoice>(() => rejectAll(categories));
  const [saved, setSaved] = useState<ConsentChoice | null>(null);

  useEffect(() => {
    const stored = storageKey ? readConsent(window.localStorage, storageKey, categories) : null;
    setSaved(stored);
    setStatus(stored ? "done" : "ask");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const openPrefs = () => {
    setDraft(saved ?? rejectAll(categories));
    setPrefsOpen(true);
  };
  useEffect(() => {
    window.addEventListener(CONSENT_EVENT, openPrefs);
    return () => window.removeEventListener(CONSENT_EVENT, openPrefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const save = (choice: ConsentChoice, source: ConsentSource) => {
    const final = normalizeChoice(categories, choice);
    if (storageKey) writeConsent(window.localStorage, storageKey, final);
    setSaved(final);
    setStatus("done");
    setPrefsOpen(false);
    onChange?.(final, source);
  };

  if (status === "loading") return null;

  return (
    <>
      {status === "ask" && (
        <section
          role="region"
          aria-labelledby={`${uid}-title`}
          className={cn(
            "rounded-xl border bg-card p-4 text-card-foreground shadow-lg",
            inline ? "relative w-full" : "fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[26rem]",
            className,
          )}
        >
          <h2 id={`${uid}-title`} className="text-[15px] leading-6 font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-[13.5px] leading-5 text-muted-foreground">
            {description}
            {policy && (
              <>
                {" "}
                <a href={policy.href} className={cn("rounded-sm text-foreground underline underline-offset-2 outline-none hover:no-underline", focusRing)}>
                  {policy.label}
                </a>
                .
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => save(acceptAll(categories), "accept_all")}>
              Accept all
            </Button>
            <Button size="sm" variant="secondary" onClick={() => save(rejectAll(categories), "reject_all")}>
              Reject all
            </Button>
            <Button size="sm" variant="quiet" onClick={openPrefs}>
              Customize
            </Button>
          </div>
        </section>
      )}

      <Dialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        title="Cookie preferences"
        description="Choose which cookies we may use. You can change this at any time."
        footer={
          <>
            <Button variant="secondary" onClick={() => save(rejectAll(categories), "reject_all")}>
              Reject all
            </Button>
            <Button variant="secondary" onClick={() => save(acceptAll(categories), "accept_all")}>
              Accept all
            </Button>
            <Button onClick={() => save(draft, "custom")}>Save choices</Button>
          </>
        }
      >
        <ul className="flex flex-col divide-y">
          {categories.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p id={`${uid}-${c.id}`} className="text-[14px] leading-5 font-semibold text-foreground">
                  {c.label}
                </p>
                <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{c.description}</p>
              </div>
              {c.required ? (
                <span className="mt-0.5 shrink-0 text-[12.5px] text-muted-foreground">Always on</span>
              ) : (
                <Switch aria-label={c.label} checked={Boolean(draft[c.id])} onCheckedChange={(on) => setDraft((d) => ({ ...d, [c.id]: on }))} className="mt-0.5 shrink-0" />
              )}
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
