"use client";
/** @registry name="settings-api-keys" type="block" title="API keys settings" description="API keys with masked values, scopes, last used and expiry; create shows the secret once with copy; rename and revoke." */
/**
 * API keys: the list (name, masked key, scopes, created, last used, expiry), a create dialog that shows the
 * new secret exactly once with a copy button, rename, and revoke behind a confirmation. Your server creates,
 * stores (hashed) and revokes keys; this block never sees a secret except the one onCreate hands back.
 */
import { writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "../../badge";
import { Button } from "../../button";
import { CheckboxGroup } from "../../checkbox";
import { Dialog } from "../../dialog";
import { Field, Input } from "../../input";
import { Menu } from "../../menu";
import { Select } from "../../select";
import { SettingsSection } from "./settings-layout";
import { keyNameError, keyState, lastUsed, maskKey, settleResult, shortDate, type ApiKey, type SettingsResult } from "./settings-utils";

export interface ApiKeyScope {
  id: string;
  label: string;
  description?: string;
}

export type CreateKeyResult = { ok: true; key: ApiKey; secret: string } | { ok: false; error: string };

export interface ApiKeysSettingsProps {
  keys: ApiKey[];
  scopes: ApiKeyScope[];
  /** Scopes checked by default in the create dialog. Default: the first one. */
  defaultScopes?: string[];
  /** Days to offer for expiry; null = never. Default [30, 90, 365, null]. */
  expiryOptions?: (number | null)[];
  onCreate: (input: { name: string; scopes: string[]; expiresInDays: number | null }) => Promise<CreateKeyResult>;
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

export function ApiKeysSettings({ keys, scopes, defaultScopes, expiryOptions = [30, 90, 365, null], onCreate, onRevoke, onRename, limit, now = Date.now(), locale = "en-US" }: ApiKeysSettingsProps) {
  const [creating, setCreating] = useState(false);
  const [revoke, setRevoke] = useState<ApiKey | null>(null);
  const [rename, setRename] = useState<ApiKey | null>(null);
  const [notice, setNotice] = useState<SettingsResult | null>(null);
  const atLimit = limit !== undefined && keys.length >= limit;
  const scopeLabel = (id: string) => scopes.find((s) => s.id === id)?.label ?? id;

  return (
    <SettingsSection
      title="API keys"
      description="Keys let scripts and servers call the API as you. Treat them like passwords: keep them out of code and client apps."
      actions={
        <Button size="sm" onClick={() => (setNotice(null), setCreating(true))} disabled={atLimit} icon={<KeyIcon />}>
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
      {keys.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
          <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
            <KeyIcon />
          </span>
          <p className="text-[13.5px] font-medium">No API keys yet</p>
          <p className="max-w-[40ch] text-[12.5px] text-muted-foreground">Create a key for each script or server, so you can revoke one without breaking the others.</p>
        </div>
      ) : (
        <ul className="-my-2 divide-y" aria-label="API keys">
          {keys.map((k) => {
            const state = keyState(k, now);
            return (
              <li key={k.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium">{k.name}</span>
                    {state !== "active" && (
                      <Badge size="sm" tone={state === "expired" ? "danger" : "warning"}>
                        {state === "expired" ? "Expired" : `Expires ${shortDate(k.expiresAt, locale)}`}
                      </Badge>
                    )}
                  </div>
                  <code className="mt-0.5 block truncate font-mono text-[12px] text-muted-foreground">{maskKey(k)}</code>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <Badge key={s} size="sm" variant="outline">
                        {scopeLabel(s)}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    {`Created ${shortDate(k.createdAt, locale)} · Last used ${lastUsed(k.lastUsedAt, now, locale).toLowerCase()}${state === "active" && k.expiresAt ? ` · Expires ${shortDate(k.expiresAt, locale)}` : state === "active" ? " · Never expires" : ""}`}
                  </p>
                </div>
                <Menu
                  aria-label={`Actions for ${k.name}`}
                  align="end"
                  items={[...(onRename ? [{ id: "rename", label: "Rename" }] : []), { id: "revoke", label: "Revoke", danger: true }]}
                  onSelect={(i) => (setNotice(null), i.id === "rename" ? setRename(k) : setRevoke(k))}
                  trigger={<Button size="sm" variant="ghost" icon={<MoreIcon />} aria-label={`Actions for ${k.name}`} />}
                />
              </li>
            );
          })}
        </ul>
      )}

      <CreateKeyDialog
        open={creating}
        onOpenChange={setCreating}
        scopes={scopes}
        defaultScopes={defaultScopes ?? scopes.slice(0, 1).map((s) => s.id)}
        expiryOptions={expiryOptions}
        taken={keys.map((k) => k.name)}
        onCreate={onCreate}
      />
      <RevokeDialog
        target={revoke}
        onClose={() => setRevoke(null)}
        onRevoke={async (id) => {
          const r = await settleResult(onRevoke(id));
          if (r.ok) setNotice({ ok: true, message: r.message ?? `Revoked ${revoke?.name}. Requests with it now fail.` });
          return r;
        }}
      />
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

function CreateKeyDialog({
  open,
  onOpenChange,
  scopes,
  defaultScopes,
  expiryOptions,
  taken,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scopes: ApiKeyScope[];
  defaultScopes: string[];
  expiryOptions: (number | null)[];
  taken: string[];
  onCreate: ApiKeysSettingsProps["onCreate"];
}) {
  const ids = { name: useId(), expiry: useId(), secret: useId() };
  const [name, setName] = useState("");
  const [picked, setPicked] = useState(defaultScopes);
  const [expiry, setExpiry] = useState(String(expiryOptions[1] ?? expiryOptions[0] ?? "never"));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ key: ApiKey; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const secretRef = useRef<HTMLInputElement>(null);

  // Fresh form every time it opens; the secret is dropped from memory when it closes.
  useEffect(() => {
    if (!open) return;
    setName("");
    setPicked(defaultScopes);
    setTouched(false);
    setError(null);
    setCreated(null);
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nameError = keyNameError(name, taken);
  const submit = async () => {
    setTouched(true);
    if (nameError || picked.length === 0) return;
    setBusy(true);
    setError(null);
    const r = await settleResult(onCreate({ name: name.trim(), scopes: picked, expiresInDays: expiry === "never" ? null : Number(expiry) }));
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
  const close = () => {
    setCreated(null);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={created ? "Copy your new key" : "Create API key"}
      description={created ? "This is the only time you'll see the full key. Store it in a secret manager or an environment variable." : "Give each script or server its own key."}
      footer={
        created ? (
          <Button onClick={close}>{copied ? "Done" : "I've stored it"}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              Create key
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="grid gap-3 pb-2">
          <Field label={created.key.name} id={ids.secret}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input ref={secretRef} id={ids.secret} readOnly value={created.secret} className="font-mono" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="secondary" onClick={() => void copy()}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </Field>
          <p role="status" aria-live="polite" className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-300">
            {copied ? "Copied to the clipboard. You won't be able to see this key again." : "Copy it now. You won't be able to see this key again."}
          </p>
        </div>
      ) : (
        <form className="grid gap-4 pb-2" onSubmit={(e) => (e.preventDefault(), void submit())} noValidate>
          <Field label="Name" id={ids.name} error={touched && nameError ? nameError : undefined} hint="For example: Production server, CI, Local scripts.">
            <Input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} maxLength={60} autoFocus invalid={touched && Boolean(nameError)} autoComplete="off" />
          </Field>
          <CheckboxGroup
            legend="Permissions"
            options={scopes.map((s) => ({ value: s.id, label: s.label, description: s.description }))}
            value={picked}
            onValueChange={setPicked}
          />
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
        </form>
      )}
    </Dialog>
  );
}

function RevokeDialog({ target, onClose, onRevoke }: { target: ApiKey | null; onClose: () => void; onRevoke: (id: string) => Promise<SettingsResult> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [target]);
  const run = async () => {
    if (!target) return;
    setBusy(true);
    const r = await onRevoke(target.id);
    setBusy(false);
    if (r.ok) onClose();
    else setError(r.error);
  };
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={`Revoke ${target?.name ?? "key"}?`}
      description="Anything using this key stops working right away. This can't be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" loading={busy} onClick={() => void run()}>
            Revoke key
          </Button>
        </>
      }
    >
      {target && <code className="block font-mono text-[12.5px] text-muted-foreground">{maskKey(target)}</code>}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </Dialog>
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
