"use client";
/** @registry name="settings-api-keys" type="block" title="API keys settings" description="API keys with live or test environments, idle detection, inline create that shows the secret once, expandable details and hold to revoke." */
/**
 * API keys: the list (name, masked key, environment, scopes, created, last used, expiry), a create form that unfolds
 * in the list and shows the new secret exactly once with a copy button, rename, an expandable details row, idle-key
 * hints, and hold to revoke. Your server creates, stores (hashed) and revokes keys; this block never sees a secret
 * except the one onCreate hands back.
 */
import { Fold, prefersReducedMotion } from "@/registry/knowns/lib/knowns/motion";
import { cn, focusRing, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "../../badge";
import { Button } from "../../button";
import { CheckboxGroup } from "../../checkbox";
import { Dialog } from "../../dialog";
import { Field, Input } from "../../input";
import { Menu } from "../../menu";
import { SegmentedControl } from "../../segmented-control";
import { Select } from "../../select";
import { SettingsSection } from "./settings-layout";
import {
  ENV_LABEL,
  HOLD_MS,
  filterKeysByEnv,
  holdPhase,
  holdProgress,
  idleDays,
  idleLabel,
  isHoldKey,
  keyEnv,
  keyNameError,
  keyState,
  lastUsed,
  lastUsedInline,
  maskKey,
  settleResult,
  shortDate,
  sparkPoints,
  type ApiKey,
  type EnvFilter,
  type KeyEnv,
  type SettingsResult,
} from "./settings-utils";

export interface ApiKeyScope {
  id: string;
  label: string;
  description?: string;
}

export type CreateKeyResult = { ok: true; key: ApiKey; secret: string } | { ok: false; error: string };

export interface ApiKeysSettingsProps {
  keys: ApiKey[];
  scopes: ApiKeyScope[];
  /** Scopes checked by default in the create form. Default: the first one. */
  defaultScopes?: string[];
  /** Days to offer for expiry; null = never. Default [30, 90, 365, null]. */
  expiryOptions?: (number | null)[];
  /** Environments the create form offers, e.g. ["live", "test"]. The choice arrives as `environment`. Default: none. */
  environments?: KeyEnv[];
  /** Mark a key idle after this many days without use. Null turns it off. Default 30. */
  idleAfterDays?: number | null;
  /** Names the sparkline in the details row. Default "Requests per day". */
  usageLabel?: string;
  /** How long Revoke must be held, in ms. Default 1200. */
  holdMs?: number;
  onCreate: (input: { name: string; scopes: string[]; expiresInDays: number | null; environment?: KeyEnv }) => Promise<CreateKeyResult>;
  onRevoke: (id: string) => Promise<SettingsResult>;
  onRename?: (id: string, name: string) => Promise<SettingsResult>;
  /** Max keys; the Create button disables at the limit. */
  limit?: number;
  now?: number;
  locale?: string;
}

const KeyIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="5.5" cy="10.5" r="3" />
    <path d="m7.7 8.3 6-6M11.5 4.5l1.5 1.5M10 6l1.2 1.2" />
  </svg>
);
const MoreIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
    <circle cx="3.5" cy="8" r="1.3" />
    <circle cx="8" cy="8" r="1.3" />
    <circle cx="12.5" cy="8" r="1.3" />
  </svg>
);
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn("transition-transform duration-(--kn-dur-fast) ease-(--kn-ease-inout)", open && "rotate-90")}>
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </svg>
);

const ENV_TONE = { live: "success", test: "info" } as const;

export function ApiKeysSettings({
  keys,
  scopes,
  defaultScopes,
  expiryOptions = [30, 90, 365, null],
  environments,
  idleAfterDays = 30,
  usageLabel = "Requests per day",
  holdMs = HOLD_MS,
  onCreate,
  onRevoke,
  onRename,
  limit,
  now = Date.now(),
  locale = "en-US",
}: ApiKeysSettingsProps) {
  const uid = useId();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [rename, setRename] = useState<ApiKey | null>(null);
  const [notice, setNotice] = useState<SettingsResult | null>(null);
  const [filter, setFilter] = useState<EnvFilter>("all");
  const createBtn = useRef<HTMLButtonElement>(null);
  const atLimit = limit !== undefined && keys.length >= limit;
  const scopeLabel = (id: string) => scopes.find((s) => s.id === id)?.label ?? id;
  const envs = [...new Set(keys.map(keyEnv).filter((e): e is KeyEnv => e !== null))];
  const showFilter = envs.length > 1;
  const shown = filterKeysByEnv(keys, showFilter ? filter : "all");

  return (
    <SettingsSection
      title="API keys"
      description="Keys let scripts and servers call the API as you. Treat them like passwords: keep them out of code and client apps."
      actions={
        <Button ref={createBtn} size="sm" onClick={() => (setNotice(null), setCreating(true))} disabled={atLimit || creating} icon={<KeyIcon />}>
          Create key
        </Button>
      }
      footer={
        notice || limit !== undefined ? (
          <span role="status" aria-live="polite" className={notice && !notice.ok ? "text-red-600 dark:text-red-400" : undefined}>
            {notice ? (notice.ok ? notice.message : notice.error) : `${keys.length} of ${limit} keys used.`}
          </span>
        ) : undefined
      }
    >
      <Fold open={creating}>
        <div className="p-0.5 pb-4">
          <CreateKeyPanel
            scopes={scopes}
            defaultScopes={defaultScopes ?? scopes.slice(0, 1).map((s) => s.id)}
            expiryOptions={expiryOptions}
            environments={environments ?? []}
            taken={keys.map((k) => k.name)}
            onCreate={onCreate}
            onClose={() => {
              setCreating(false);
              createBtn.current?.focus();
            }}
          />
        </div>
      </Fold>

      {showFilter && keys.length > 0 && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <SegmentedControl
            size="sm"
            aria-label="Filter keys by environment"
            value={filter}
            onValueChange={(v) => setFilter(v as EnvFilter)}
            options={[{ value: "all", label: "All" }, ...envs.map((e) => ({ value: e, label: ENV_LABEL[e] }))]}
          />
          <span className="text-[12px] text-muted-foreground" aria-live="polite">
            {shown.length} of {keys.length}
          </span>
        </div>
      )}

      {keys.length === 0 ? (
        !creating && (
          <div className="grid justify-items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
              <KeyIcon />
            </span>
            <p className="text-[13.5px] font-medium">No API keys yet</p>
            <p className="max-w-[40ch] text-[12.5px] text-muted-foreground">Create a key for each script or server, so you can revoke one without breaking the others.</p>
          </div>
        )
      ) : shown.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-[13px] text-muted-foreground">No {filter === "all" ? "" : `${ENV_LABEL[filter].toLowerCase()} `}keys.</p>
      ) : (
        <ul className="-my-2 divide-y" aria-label="API keys">
          {shown.map((k) => {
            const state = keyState(k, now);
            const env = keyEnv(k);
            const idle = idleDays(k, now, idleAfterDays);
            const isOpen = open === k.id;
            const detailId = `${uid}-${k.id}`;
            return (
              <li key={k.id} className="py-3">
                <div className="flex items-start gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-ml-1.5 mt-[-1px]"
                    icon={<ChevronIcon open={isOpen} />}
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    aria-label={`${isOpen ? "Hide" : "Show"} details for ${k.name}`}
                    onClick={() => setOpen(isOpen ? null : k.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium">{k.name}</span>
                      {env && (
                        <Badge size="sm" tone={ENV_TONE[env]}>
                          {ENV_LABEL[env]}
                        </Badge>
                      )}
                      {state !== "active" && (
                        <Badge size="sm" tone={state === "expired" ? "danger" : "warning"}>
                          {state === "expired" ? "Expired" : `Expires ${shortDate(k.expiresAt, locale)}`}
                        </Badge>
                      )}
                      {idle !== null && (
                        <Badge size="sm" tone="warning">
                          Idle
                        </Badge>
                      )}
                    </div>
                    <code className="mt-0.5 block truncate font-mono text-[12px] text-muted-foreground">{maskKey({ prefix: k.prefix, last4: k.last4, env: k.env })}</code>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <Badge key={s} size="sm" variant="outline">
                          {scopeLabel(s)}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                      {`Created ${shortDate(k.createdAt, locale)} · Last used ${lastUsedInline(k.lastUsedAt, now, locale)}${state === "active" && k.expiresAt ? ` · Expires ${shortDate(k.expiresAt, locale)}` : state === "active" ? " · Never expires" : ""}`}
                    </p>
                    {idle !== null && (
                      <p className="mt-1 text-[12px] text-amber-800 dark:text-amber-300">
                        {idleLabel(idle)}. Revoke it if nothing uses it anymore.{" "}
                        <button type="button" className={cn("rounded-sm font-medium underline underline-offset-2", focusRing)} onClick={() => (setNotice(null), setRevoking(k.id))}>
                          Revoke
                        </button>
                      </p>
                    )}
                  </div>
                  <Menu
                    aria-label={`Actions for ${k.name}`}
                    align="end"
                    items={[...(onRename ? [{ id: "rename", label: "Rename" }] : []), { id: "revoke", label: "Revoke", danger: true }]}
                    onSelect={(i) => (setNotice(null), i.id === "rename" ? setRename(k) : setRevoking(k.id))}
                    trigger={<Button size="sm" variant="ghost" icon={<MoreIcon />} aria-label={`Actions for ${k.name}`} />}
                  />
                </div>
                <div id={detailId}>
                  <Fold open={isOpen}>
                    <KeyDetails k={k} now={now} locale={locale} usageLabel={usageLabel} />
                  </Fold>
                </div>
                <Fold open={revoking === k.id}>
                  <RevokeStrip
                    target={k}
                    holdMs={holdMs}
                    onCancel={() => setRevoking(null)}
                    onRevoke={async () => {
                      const r = await settleResult(onRevoke(k.id));
                      if (r.ok) {
                        setNotice({ ok: true, message: r.message ?? `Revoked ${k.name}. Requests with it now fail.` });
                        setRevoking(null);
                      }
                      return r;
                    }}
                  />
                </Fold>
              </li>
            );
          })}
        </ul>
      )}

      {onRename && (
        <RenameDialog
          target={rename}
          taken={keys.filter((k) => k.id !== rename?.id).map((k) => k.name)}
          onClose={() => setRename(null)}
          onRename={async (id, name) => {
            const r = await settleResult(onRename(id, name));
            if (r.ok) setNotice({ ok: true, message: r.message ?? "Renamed." });
            return r;
          }}
        />
      )}
    </SettingsSection>
  );
}

const expiryLabel = (d: number | null) => (d === null ? "Never" : d % 365 === 0 ? `${d / 365} year${d === 365 ? "" : "s"}` : `${d} days`);

function KeyDetails({ k, now, locale, usageLabel }: { k: ApiKey; now: number; locale: string; usageLabel: string }) {
  const usage = k.usage ?? [];
  const W = 160;
  const H = 32;
  const total = usage.reduce((a, b) => a + b, 0);
  return (
    <div className="mt-3 grid gap-3 rounded-lg bg-muted/50 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[12.5px]">
        <dt className="text-muted-foreground">Created by</dt>
        <dd className="truncate">{k.createdBy ?? "Unknown"}</dd>
        <dt className="text-muted-foreground">Created on</dt>
        <dd>{shortDate(k.createdAt, locale)}</dd>
        <dt className="text-muted-foreground">Last used</dt>
        <dd className="truncate">{k.lastUsedAt ? `${lastUsed(k.lastUsedAt, now, locale)}${k.lastUsedFrom ? ` from ${k.lastUsedFrom}` : ""}` : "Never"}</dd>
      </dl>
      {usage.length > 1 && (
        <figure className="grid gap-1">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${usageLabel}, last ${usage.length} days, ${total.toLocaleString(locale)} in total`} className="max-w-full text-sky-700 dark:text-sky-300">
            <polyline points={sparkPoints(usage, W, H)} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <figcaption className="text-[12px] text-muted-foreground">
            {usageLabel}, {usage.length} days: {total.toLocaleString(locale)}
          </figcaption>
        </figure>
      )}
    </div>
  );
}

function CreateKeyPanel({
  scopes,
  defaultScopes,
  expiryOptions,
  environments,
  taken,
  onCreate,
  onClose,
}: {
  scopes: ApiKeyScope[];
  defaultScopes: string[];
  expiryOptions: (number | null)[];
  environments: KeyEnv[];
  taken: string[];
  onCreate: ApiKeysSettingsProps["onCreate"];
  onClose: () => void;
}) {
  const ids = { name: useId(), expiry: useId(), secret: useId() };
  const [name, setName] = useState("");
  const [picked, setPicked] = useState(defaultScopes);
  const [environment, setEnvironment] = useState<KeyEnv | undefined>(environments[0]);
  const [expiry, setExpiry] = useState(String(expiryOptions[1] ?? expiryOptions[0] ?? "never"));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ key: ApiKey; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const secretRef = useRef<HTMLInputElement>(null);

  const nameError = keyNameError(name, taken);
  const submit = async () => {
    setTouched(true);
    if (nameError || picked.length === 0) return;
    setBusy(true);
    setError(null);
    const r = await settleResult(onCreate({ name: name.trim(), scopes: picked, expiresInDays: expiry === "never" ? null : Number(expiry), ...(environment ? { environment } : {}) }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setCreated({ key: r.key, secret: r.secret });
  };
  const copy = async () => {
    if (!created) return;
    try {
      await writeClipboard(created.secret);
      setCopied(true);
    } catch {
      secretRef.current?.select(); // the user can press Cmd/Ctrl+C
    }
  };
  // The secret lives only in this panel's state: closing unmounts it.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !created && !busy) {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <section aria-label={created ? "Copy your new key" : "Create API key"} className="rounded-lg border bg-muted/30 p-4" onKeyDown={onKeyDown}>
      {created ? (
        <div className="grid gap-3">
          <div>
            <h3 className="text-[13.5px] font-medium">Copy your new key</h3>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">This is the only time you'll see the full key. Store it in a secret manager or an environment variable.</p>
          </div>
          <Field label={created.key.name} id={ids.secret}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input ref={secretRef} id={ids.secret} readOnly value={created.secret} className="font-mono" autoFocus onFocus={(e) => e.currentTarget.select()} />
              <Button variant="secondary" onClick={() => void copy()}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </Field>
          <p role="status" aria-live="polite" className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-300">
            {copied ? "Copied to the clipboard. You won't be able to see this key again." : "Copy it now. You won't be able to see this key again."}
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>{copied ? "Done" : "I've stored it"}</Button>
          </div>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), void submit())} noValidate>
          <div>
            <h3 className="text-[13.5px] font-medium">Create API key</h3>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Give each script or server its own key.</p>
          </div>
          <Field label="Name" id={ids.name} error={touched && nameError ? nameError : undefined} hint="For example: Production server, CI, Local scripts.">
            <Input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} maxLength={60} autoFocus invalid={touched && Boolean(nameError)} autoComplete="off" />
          </Field>
          {environments.length > 1 && (
            <div className="grid gap-1.5">
              <span className="text-[13px] font-medium">Environment</span>
              <SegmentedControl size="sm" aria-label="Environment" value={environment ?? environments[0]} onValueChange={(v) => setEnvironment(v as KeyEnv)} options={environments.map((e) => ({ value: e, label: ENV_LABEL[e] }))} />
            </div>
          )}
          <CheckboxGroup legend="Permissions" options={scopes.map((s) => ({ value: s.id, label: s.label, description: s.description }))} value={picked} onValueChange={setPicked} />
          {touched && picked.length === 0 && (
            <p role="alert" className="-mt-2 text-xs text-red-600 dark:text-red-400">
              Pick at least one permission.
            </p>
          )}
          <Field label="Expires after" id={ids.expiry}>
            <Select id={ids.expiry} value={expiry} onChange={(e) => setExpiry(e.target.value)} options={expiryOptions.map((d) => ({ value: d === null ? "never" : String(d), label: expiryLabel(d) }))} />
          </Field>
          {error && (
            <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create key
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Revoke without a dialog: hold the button until it fills; release cancels. Reduced motion gets a confirm step instead. */
function RevokeStrip({ target, holdMs, onCancel, onRevoke }: { target: ApiKey; holdMs: number; onCancel: () => void; onRevoke: () => Promise<SettingsResult> }) {
  const hintId = useId();
  const [reduced, setReduced] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setReduced(prefersReducedMotion()), []);
  const run = async () => {
    setBusy(true);
    setError(null);
    const r = await onRevoke();
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      setConfirming(false);
    }
  };
  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-red-600/25 bg-red-500/5 px-3 py-3">
      <p className="text-[13px]">
        <span className="font-medium">Revoke {target.name}?</span> <span className="text-muted-foreground">Anything using it stops working right away. This can't be undone.</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {reduced ? (
          confirming ? (
            <>
              <Button size="sm" variant="destructive" loading={busy} onClick={() => void run()} autoFocus>
                Yes, revoke key
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                Keep it
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
                Revoke key
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </>
          )
        ) : (
          <>
            <HoldButton duration={holdMs} busy={busy} onComplete={run} describedBy={hintId}>
              Hold to revoke
            </HoldButton>
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          </>
        )}
      </div>
      {!reduced && (
        <p id={hintId} className="text-[12px] text-muted-foreground">
          Press and hold for {(holdMs / 1000).toFixed(1)} seconds, with the mouse, a finger, or Space or Enter. Let go to cancel.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** A button that fires `onComplete` only after a full press-and-hold. Progress fills left to right; releasing resets it. */
function HoldButton({ duration, busy, onComplete, describedBy, children }: { duration: number; busy?: boolean; onComplete: () => void | Promise<void>; describedBy?: string; children: string }) {
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number | null>(null);
  const raf = useRef(0);
  const stop = () => {
    cancelAnimationFrame(raf.current);
    startedAt.current = null;
    setProgress(0);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const begin = () => {
    if (busy || startedAt.current !== null) return;
    startedAt.current = performance.now();
    const tick = () => {
      const at = startedAt.current;
      if (at === null) return;
      const now = performance.now();
      setProgress(holdProgress(now - at, duration));
      if (holdPhase(at, now, duration) === "done") {
        startedAt.current = null;
        void Promise.resolve(onComplete()).finally(() => setProgress(0));
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  return (
    <button
      type="button"
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      disabled={busy}
      className={cn(
        "relative inline-flex h-8 touch-manipulation select-none items-center justify-center overflow-hidden rounded-lg border border-red-600/40 px-3 text-[13px] font-medium text-red-700 dark:border-red-400/40 dark:text-red-300",
        "active:scale-[0.97] transition-transform duration-(--kn-dur-fast) ease-(--kn-ease-out) disabled:opacity-70",
        focusRing,
      )}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        begin();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") e.preventDefault();
        if (isHoldKey(e)) begin();
      }}
      onKeyUp={(e) => (e.key === " " || e.key === "Enter") && stop()}
      onBlur={stop}
    >
      <span aria-hidden="true" className="absolute inset-0 origin-left bg-red-500/25 dark:bg-red-400/25" style={{ transform: `scaleX(${progress})` }} />
      <span className="relative">{busy ? "Revoking..." : children}</span>
    </button>
  );
}

function RenameDialog({ target, taken, onClose, onRename }: { target: ApiKey | null; taken: string[]; onClose: () => void; onRename: (id: string, name: string) => Promise<SettingsResult> }) {
  const id = useId();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => (setName(target?.name ?? ""), setError(null)), [target]);
  const invalid = keyNameError(name, taken);
  const run = async () => {
    if (!target || invalid) return setError(invalid);
    setBusy(true);
    const r = await onRename(target.id, name.trim());
    setBusy(false);
    if (r.ok) onClose();
    else setError(r.error);
  };
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Rename key"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={name.trim() === target?.name} onClick={() => void run()}>
            Save
          </Button>
        </>
      }
    >
      <form className="pb-2" onSubmit={(e) => (e.preventDefault(), void run())}>
        <Field label="Name" id={id} error={error ?? undefined}>
          <Input id={id} value={name} onChange={(e) => (setName(e.target.value), setError(null))} maxLength={60} autoFocus invalid={Boolean(error)} />
        </Field>
      </form>
    </Dialog>
  );
}
