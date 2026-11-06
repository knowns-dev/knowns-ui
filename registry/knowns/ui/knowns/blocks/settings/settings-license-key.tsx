"use client";
/** @registry name="settings-license-key" type="block" title="Settings: license key" description="License keys that can be shown again, with copy, regenerate behind a confirm, status and dates, and a usage meter." */
/**
 * License key settings: the keys a customer owns, each masked until shown, with Copy and Regenerate
 * (behind a confirm, since the old key stops at once), a status badge, dates, and an optional usage
 * meter. Unlike API keys (shown once), a license key can be revealed again. Callbacks only.
 */
import { writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, type BadgeTone } from "../../badge";
import { Button } from "../../button";
import { Dialog } from "../../dialog";
import { Progress } from "../../progress";
import { SettingsSection } from "./settings-layout";
import { settleResult, shortDate, usageRatio, type SettingsResult } from "./settings-utils";

export type LicenseKeyStatus = "active" | "revoked" | "disabled" | "expired";

export interface LicenseKey {
  id: string;
  /** The full key. Leave it out if your backend only reveals it on request (then pass onReveal). */
  key?: string;
  /** What shows while hidden, e.g. "****-7F3A". */
  display: string;
  status: LicenseKeyStatus;
  createdAt: Date | string | number;
  expiresAt?: Date | string | number | null;
  /** e.g. "Pro lifetime". */
  label?: string;
}

export interface LicenseUsage {
  label: string;
  used: number;
  limit: number | null;
  /** e.g. "Resets at 07:00". */
  note?: ReactNode;
}

export interface LicenseKeySettingsProps {
  keys: LicenseKey[];
  title?: ReactNode;
  description?: ReactNode;
  /** Fetch the full key when it isn't in `keys` (e.g. a server action). */
  onReveal?: (id: string) => Promise<{ ok: true; key: string } | { ok: false; error: string }>;
  /** Issue a new key in place of this one; resolve with the new key to show it right away. */
  onRegenerate?: (id: string) => Promise<{ ok: true; key: string; message?: string } | { ok: false; error: string }>;
  /** Called when a key is shown or hidden, e.g. to fill setup snippets with it. */
  onVisibleChange?: (id: string | null, key: string | null) => void;
  usage?: LicenseUsage | null;
  /** Shown when there are no keys (e.g. a link to pricing). */
  empty?: ReactNode;
  /** A notice above the list, e.g. "Thanks for buying". */
  notice?: ReactNode;
  locale?: string;
}

const STATUS: Record<LicenseKeyStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "success" },
  revoked: { label: "Revoked", tone: "danger" },
  disabled: { label: "Disabled", tone: "warning" },
  expired: { label: "Expired", tone: "neutral" },
};

export function LicenseKeySettings({ keys, title = "License key", description, onReveal, onRegenerate, onVisibleChange, usage, empty, notice, locale = "en-US" }: LicenseKeySettingsProps) {
  const [full, setFull] = useState<Record<string, string>>(() => Object.fromEntries(keys.filter((k) => k.key).map((k) => [k.id, k.key as string])));
  const [shown, setShown] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<LicenseKey | null>(null);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [usedNow, setUsedNow] = useState(usage?.used ?? 0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => setUsedNow(usage?.used ?? 0), [usage?.used]);

  const get = async (k: LicenseKey): Promise<string | null> => {
    if (full[k.id]) return full[k.id];
    if (!onReveal) return null;
    setBusy(`r:${k.id}`);
    const r = await settleResult(onReveal(k.id));
    setBusy(null);
    if (!r.ok) {
      setResult(r);
      return null;
    }
    const key = (r as { key: string }).key;
    setFull((f) => ({ ...f, [k.id]: key }));
    return key;
  };

  const toggle = async (k: LicenseKey) => {
    if (shown === k.id) {
      setShown(null);
      onVisibleChange?.(null, null);
      return;
    }
    const key = await get(k);
    if (!key) return;
    setShown(k.id);
    onVisibleChange?.(k.id, key);
  };

  const copy = async (k: LicenseKey) => {
    const key = await get(k);
    if (!key) return;
    try {
      await writeClipboard(key);
      setCopied(k.id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 1600);
    } catch {
      setResult({ ok: false, error: "Copy was blocked. Show the key and copy it by hand." });
    }
  };

  const regenerate = async () => {
    if (!confirm || !onRegenerate) return;
    const k = confirm;
    setBusy(`g:${k.id}`);
    const r = await settleResult(onRegenerate(k.id));
    setBusy(null);
    if (r.ok) {
      const key = (r as { key: string }).key;
      setFull((f) => ({ ...f, [k.id]: key }));
      setShown(k.id);
      onVisibleChange?.(k.id, key);
      setUsedNow(0); // usage is per key, so a new key starts at 0
      setConfirm(null);
      setResult({ ok: true, message: r.message ?? "New key issued. Update it everywhere you used the old one." });
    } else setResult(r);
  };

  const display = (k: LicenseKey) => (shown === k.id && full[k.id] ? full[k.id] : k.display);

  return (
    <SettingsSection title={title} description={description}>
      <div className="grid gap-4">
        {notice}
        {keys.length === 0 ? (
          (empty ?? <p className="text-[13.5px] text-muted-foreground">No license on this account yet.</p>)
        ) : (
          <ul className="grid gap-3" aria-label="License keys">
            {keys.map((k) => {
              const st = STATUS[k.status];
              const visible = shown === k.id;
              const expires = shortDate(k.expiresAt, locale);
              return (
                <li key={k.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="min-w-0 font-mono text-[13px] break-all" aria-label={visible ? "License key" : "License key, hidden"}>
                        {display(k)}
                      </code>
                      <Badge tone={st.tone} size="sm" dot>
                        {st.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {[k.label, `Created ${shortDate(k.createdAt, locale)}`, expires ? `expires ${expires}` : "no expiry"].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(k.key || onReveal) && (
                      <>
                        <Button size="sm" variant="secondary" aria-pressed={visible} loading={busy === `r:${k.id}`} onClick={() => void toggle(k)}>
                          {visible ? "Hide" : "Show"}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => void copy(k)}>
                          {copied === k.id ? "Copied" : "Copy"}
                        </Button>
                      </>
                    )}
                    {onRegenerate && k.status === "active" && (
                      <Button size="sm" variant="ghost" onClick={() => (setResult(null), setConfirm(k))}>
                        Regenerate
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {usage && (
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
              <span className="font-medium">{usage.label}</span>
              <span className="text-muted-foreground tabular-nums">{usage.limit === null ? `${usedNow.toLocaleString(locale)} (unlimited)` : `${usedNow.toLocaleString(locale)} of ${usage.limit.toLocaleString(locale)}`}</span>
            </div>
            {usage.limit !== null && <Progress value={usageRatio(usedNow, usage.limit) * 100} valueLabel="none" size="sm" tone={usedNow >= usage.limit ? "danger" : usedNow >= usage.limit * 0.8 ? "warning" : "neutral"} aria-label={`${usage.label} used`} />}
            {usage.note && <p className="text-[12px] text-muted-foreground">{usage.note}</p>}
          </div>
        )}

        {result && (
          <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-[12.5px] text-emerald-700 dark:text-emerald-400" : "text-[12.5px] text-red-600 dark:text-red-400"}>
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>

      {onRegenerate && (
        <Dialog
          open={confirm !== null}
          onOpenChange={(o) => !o && setConfirm(null)}
          size="sm"
          title="Regenerate this key?"
          description="The current key stops working at once. Every project and CI secret that uses it needs the new key."
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Keep current key
              </Button>
              <Button variant="destructive" loading={busy?.startsWith("g:")} onClick={() => void regenerate()}>
                Regenerate key
              </Button>
            </>
          }
        />
      )}
    </SettingsSection>
  );
}
