"use client";
/** @registry name="settings-profile" type="block" title="Profile settings" description="Avatar upload, name, username, email change and bio with Save/Discard, and account deletion behind a typed confirmation." */
/**
 * Profile settings: avatar (upload with preview, remove), name, username, email (changed through your own
 * verify flow), bio, and deleting the account behind a typed confirmation. Callbacks only.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Avatar } from "../../avatar";
import { Button } from "../../button";
import { Dialog } from "../../dialog";
import { Field, Input, Textarea } from "../../input";
import { OtpInput } from "../../otp-input";
import { DangerZone, SaveBar, SettingsRow, SettingsSection } from "./settings-layout";
import { avatarFileError, changedKeys, confirmMatches, settleResult, usernameError, type SettingsResult } from "./settings-utils";

export interface ProfileValue {
  name: string;
  /** Omit to hide the username field. */
  username?: string;
  email: string;
  /** Omit to hide the bio field. */
  bio?: string;
  avatarUrl?: string | null;
}

export interface ProfileSettingsProps {
  value: ProfileValue;
  /** Saves name, username and bio. Resolve with the error to show, e.g. "That username is taken." */
  onSave: (next: Pick<ProfileValue, "name" | "username" | "bio">) => Promise<SettingsResult>;
  /** Uploads a new avatar; resolve with its URL. Without it the avatar can't be changed. */
  onAvatarUpload?: (file: File) => Promise<({ ok: true; url: string } | { ok: false; error: string })>;
  onAvatarRemove?: () => Promise<SettingsResult>;
  /** Starts your own email-change flow. Or pass the two callbacks below and the block runs it. */
  onChangeEmail?: () => void;
  /** Built-in email change, step 1: send a code to the new address. */
  onRequestEmailChange?: (newEmail: string) => Promise<SettingsResult>;
  /** Step 2: check the code; on { ok: true } the dialog closes and shows the message. */
  onConfirmEmailChange?: (newEmail: string, code: string) => Promise<SettingsResult>;
  /** Digits in the email-change code. Default 6. */
  emailCodeLength?: number;
  /** Under the Profile title. Default "How you appear to your team." */
  description?: ReactNode;
  /** What deleting removes (and keeps), for the danger zone row. */
  deleteDescription?: ReactNode;
  /** More sections (security, connected apps) between the profile and the danger zone, which stays last. */
  children?: ReactNode;
  /** Deletes the account. Without it the danger zone is hidden. */
  onDeleteAccount?: () => Promise<SettingsResult>;
  /** Shown before the username, e.g. "knowns.dev/". */
  usernamePrefix?: ReactNode;
  /** Max avatar size in MB. Default 2. */
  avatarMaxMb?: number;
}

const BIO_MAX = 160;

export function ProfileSettings({
  value,
  onSave,
  onAvatarUpload,
  onAvatarRemove,
  onChangeEmail,
  onRequestEmailChange,
  onConfirmEmailChange,
  emailCodeLength = 6,
  description = "How you appear to your team.",
  deleteDescription,
  children,
  onDeleteAccount,
  usernamePrefix,
  avatarMaxMb = 2,
}: ProfileSettingsProps) {
  const ids = { name: useId(), username: useId(), email: useId(), bio: useId(), file: useId(), confirm: useId() };
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const builtInEmail = Boolean(onRequestEmailChange && onConfirmEmailChange);
  const saved = { name: value.name, username: value.username ?? "", bio: value.bio ?? "" };
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [avatar, setAvatar] = useState<string | null>(value.avatarUrl ?? null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const preview = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // A new saved value from the app (after save, or a reload) resets the draft.
  const savedKey = JSON.stringify(saved);
  useEffect(() => setDraft(JSON.parse(savedKey)), [savedKey]);
  useEffect(() => setAvatar(value.avatarUrl ?? null), [value.avatarUrl]);
  useEffect(() => () => void (preview.current && URL.revokeObjectURL(preview.current)), []);

  const hasUsername = value.username !== undefined;
  const hasBio = value.bio !== undefined;
  const nameError = draft.name.trim() ? null : "Enter your name.";
  const userError = hasUsername && draft.username !== saved.username ? usernameError(draft.username) : null;
  const dirty = changedKeys(saved, draft).length > 0;
  const valid = !nameError && !userError;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const r = await settleResult(onSave({ name: draft.name.trim(), ...(hasUsername ? { username: draft.username.trim() } : {}), ...(hasBio ? { bio: draft.bio.trim() } : {}) }));
    setSaving(false);
    setResult(r);
  };

  const pick = async (file: File | undefined) => {
    if (!file || !onAvatarUpload) return;
    const err = avatarFileError(file, avatarMaxMb);
    if (err) return setAvatarError(err);
    setAvatarError(null);
    const before = avatar;
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = URL.createObjectURL(file);
    setAvatar(preview.current); // show it right away
    setAvatarBusy(true);
    const r = await settleResult(onAvatarUpload(file));
    setAvatarBusy(false);
    if (r.ok && "url" in r) setAvatar(r.url);
    else {
      setAvatar(before);
      setAvatarError(r.ok ? null : r.error);
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const remove = async () => {
    if (!onAvatarRemove) return;
    setAvatarBusy(true);
    const r = await settleResult(onAvatarRemove());
    setAvatarBusy(false);
    if (r.ok) setAvatar(null);
    else setAvatarError(r.error);
  };

  return (
    <>
      <SettingsSection
        title="Profile"
        description={description}
        footer={<SaveBar dirty={dirty} saving={saving} result={result} onSave={save} onDiscard={() => (setDraft(saved), setResult(null))} />}
      >
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar label={draft.name || value.email} src={avatar ?? undefined} size="xl" />
            <div className="grid gap-1.5">
              <div className="flex flex-wrap gap-2">
                {onAvatarUpload && (
                  <>
                    <input ref={fileInput} id={ids.file} type="file" aria-label="Upload avatar" tabIndex={-1} accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
                    <Button size="sm" variant="secondary" loading={avatarBusy} onClick={() => fileInput.current?.click()}>
                      {avatar ? "Change photo" : "Upload photo"}
                    </Button>
                  </>
                )}
                {onAvatarRemove && avatar && (
                  <Button size="sm" variant="ghost" disabled={avatarBusy} onClick={() => void remove()}>
                    Remove
                  </Button>
                )}
              </div>
              {(avatarError || onAvatarUpload) && (
                <p className={avatarError ? "text-[12px] text-red-600 dark:text-red-400" : "text-[12px] text-muted-foreground"} role={avatarError ? "alert" : undefined}>
                  {avatarError ?? `PNG, JPG, WebP or GIF, up to ${avatarMaxMb} MB.`}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" id={ids.name} error={draft.name !== saved.name ? (nameError ?? undefined) : undefined}>
              <Input id={ids.name} autoComplete="name" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} invalid={draft.name !== saved.name && Boolean(nameError)} />
            </Field>
            {hasUsername && (
              <Field label="Username" id={ids.username} error={userError ?? undefined} hint={userError ? undefined : "Lowercase letters, digits, - and _."}>
                <Input
                  id={ids.username}
                  autoComplete="username"
                  spellCheck={false}
                  prefix={usernamePrefix}
                  value={draft.username}
                  maxLength={30}
                  onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                  invalid={Boolean(userError)}
                />
              </Field>
            )}
          </div>

          <SettingsRow
            label="Email"
            description={
              emailNote ? (
                <span role="status" className="text-emerald-700 dark:text-emerald-400">
                  {emailNote}
                </span>
              ) : (
                value.email
              )
            }
            className="py-0"
          >
            {onChangeEmail || builtInEmail ? (
              <Button size="sm" variant="secondary" onClick={() => (builtInEmail ? (setEmailNote(null), setEmailOpen(true)) : onChangeEmail?.())} aria-label={`Change email (${value.email})`}>
                Change email
              </Button>
            ) : (
              <span className="text-[12.5px] text-muted-foreground">Contact support to change it.</span>
            )}
          </SettingsRow>

          {hasBio && (
            <Field label="Bio" id={ids.bio} optional hint={`${draft.bio.length}/${BIO_MAX}`}>
              <Textarea id={ids.bio} rows={3} autoGrow maxLength={BIO_MAX} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} placeholder="A line about what you work on." />
            </Field>
          )}
        </div>
      </SettingsSection>

      {builtInEmail && onRequestEmailChange && onConfirmEmailChange && (
        <EmailChangeDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          current={value.email}
          codeLength={emailCodeLength}
          onRequest={onRequestEmailChange}
          onConfirm={onConfirmEmailChange}
          onDone={(email, message) => setEmailNote(message ?? `Your email is now ${email}.`)}
        />
      )}
      {children}
      {onDeleteAccount && <DeleteAccount email={value.email} onDelete={onDeleteAccount} confirmId={ids.confirm} description={deleteDescription} />}
    </>
  );
}

/** Two steps: the new address, then the code sent to it. Errors stay in the dialog. */
function EmailChangeDialog({
  open,
  onOpenChange,
  current,
  codeLength,
  onRequest,
  onConfirm,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: string;
  codeLength: number;
  onRequest: (email: string) => Promise<SettingsResult>;
  onConfirm: (email: string, code: string) => Promise<SettingsResult>;
  onDone: (email: string, message?: string) => void;
}) {
  const ids = { email: useId(), code: useId() };
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = email.trim();
  const emailError = next && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) ? "Enter a valid email address." : next.toLowerCase() === current.toLowerCase() ? "That's your current email." : null;
  const reset = () => (setStep("email"), setEmail(""), setCode(""), setError(null), setBusy(false));
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) reset();
  };
  const send = async () => {
    if (!next || emailError) return;
    setBusy(true);
    setError(null);
    const r = await settleResult(onRequest(next));
    setBusy(false);
    if (r.ok) setStep("code");
    else setError(r.error);
  };
  const confirm = async (c = code) => {
    if (c.length !== codeLength) return;
    setBusy(true);
    setError(null);
    const r = await settleResult(onConfirm(next, c));
    setBusy(false);
    if (r.ok) {
      onDone(next, r.message);
      close(false);
    } else {
      setError(r.error);
      setCode("");
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      size="sm"
      title="Change your email"
      description={step === "email" ? `You sign in with ${current}. We'll send a code to the new address.` : `Enter the ${codeLength}-digit code we sent to ${next}.`}
      footer={
        step === "email" ? (
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!next || Boolean(emailError)} onClick={() => void send()}>
              Send code
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" disabled={busy} onClick={() => (setStep("email"), setCode(""), setError(null))}>
              Use another email
            </Button>
            <Button loading={busy} disabled={code.length !== codeLength} onClick={() => void confirm()}>
              Change email
            </Button>
          </>
        )
      }
    >
      {step === "email" ? (
        <form onSubmit={(e) => (e.preventDefault(), void send())}>
          <Field label="New email" id={ids.email} error={(emailError || error) ?? undefined}>
            <Input id={ids.email} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => (setEmail(e.target.value), setError(null))} invalid={Boolean(emailError || error)} />
          </Field>
        </form>
      ) : (
        <div className="grid gap-2">
          <label htmlFor={ids.code} className="text-[13px] font-medium">
            Code
          </label>
          <OtpInput id={ids.code} length={codeLength} value={code} onValueChange={(v) => (setCode(v), setError(null))} onComplete={(c) => void confirm(c)} invalid={Boolean(error)} disabled={busy} autoFocus aria-label="Email change code" />
          {error && (
            <p role="alert" className="text-[12.5px] text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function DeleteAccount({ email, onDelete, confirmId, description }: { email: string; onDelete: () => Promise<SettingsResult>; confirmId: string; description?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = confirmMatches(typed, email);
  const close = (o: boolean) => (setOpen(o), !o && (setTyped(""), setError(null)));
  const run = async () => {
    if (!ok) return;
    setBusy(true);
    const r = await settleResult(onDelete());
    setBusy(false);
    if (r.ok) close(false);
    else setError(r.error);
  };
  return (
    <>
      <DangerZone>
        <SettingsRow label="Delete account" description={description ?? "Deletes your profile and personal data. Teams you own must be transferred or deleted first. This can't be undone."}>
          <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </SettingsRow>
      </DangerZone>
      {/* Outside the divided list, so it adds no divider under the last row. */}
      <Dialog
        open={open}
        onOpenChange={close}
        size="sm"
        title="Delete your account?"
        description="Everything tied to your account is removed. This can't be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={busy} disabled={!ok} onClick={() => void run()}>
              Delete account
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => (e.preventDefault(), void run())}>
          <Field label={<>Type <span className="font-mono">{email}</span> to confirm</>} id={confirmId} error={error ?? undefined}>
            <Input id={confirmId} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} autoFocus invalid={Boolean(error)} />
          </Field>
        </form>
      </Dialog>
    </>
  );
}
