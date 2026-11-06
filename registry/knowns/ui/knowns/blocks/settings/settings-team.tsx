"use client";
/** @registry name="settings-team" type="block" title="Team settings" description="Invite by email with a role, change roles, remove or leave, pending invites; protects the last owner and your own role." */
/**
 * Team members: invite by email (several at once) with a role, the member list with role changes and
 * remove/leave, and pending invites with resend and cancel. The rules that keep a team safe are built in
 * (see settings-utils): you can't change your own role, and the last owner can't be demoted or removed.
 * Your server must enforce the same rules; these only keep the UI honest.
 */
import { useId, useState } from "react";
import { Avatar } from "../../avatar";
import { Badge } from "../../badge";
import { Button } from "../../button";
import { Dialog } from "../../dialog";
import { Field, Input } from "../../input";
import { Select } from "../../select";
import { SettingsSection } from "./settings-layout";
import {
  ROLE_HINT,
  ROLE_LABEL,
  alreadyOnTeam,
  assignableRoles,
  parseEmails,
  removeError,
  roleChangeError,
  settleResult,
  shortDate,
  type SettingsResult,
  type TeamInvite,
  type TeamMember,
  type TeamRole,
} from "./settings-utils";

export interface TeamSettingsProps {
  members: TeamMember[];
  invites?: TeamInvite[];
  /** The signed-in member. */
  currentUserId: string;
  /** Roles offered in the pickers, in order. Default all four. */
  roles?: TeamRole[];
  onInvite?: (emails: string[], role: TeamRole) => Promise<SettingsResult>;
  onRoleChange?: (memberId: string, role: TeamRole) => Promise<SettingsResult>;
  /** Removing yourself is "Leave team". */
  onRemove?: (memberId: string) => Promise<SettingsResult>;
  onResendInvite?: (email: string) => Promise<SettingsResult>;
  onCancelInvite?: (email: string) => Promise<SettingsResult>;
  /** "3 of 5 seats". Invites count as used. */
  seats?: { limit: number };
  teamName?: string;
  locale?: string;
}

export function TeamSettings({
  members,
  invites = [],
  currentUserId,
  roles = ["owner", "admin", "member", "viewer"],
  onInvite,
  onRoleChange,
  onRemove,
  onResendInvite,
  onCancelInvite,
  seats,
  teamName = "this team",
  locale = "en-US",
}: TeamSettingsProps) {
  const me = members.find((m) => m.id === currentUserId);
  const canManage = me?.role === "owner" || me?.role === "admin";
  const offer = (me ? assignableRoles(me.role) : []).filter((r) => roles.includes(r));
  const [notice, setNotice] = useState<SettingsResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const used = members.length + invites.length;
  const full = seats !== undefined && used >= seats.limit;

  const run = async (key: string, fn: () => Promise<SettingsResult>, ok: string) => {
    setBusy(key);
    const r = await settleResult(fn());
    setBusy(null);
    setNotice(r.ok ? { ok: true, message: r.message ?? ok } : r);
    return r;
  };

  const changeRole = (m: TeamMember, role: TeamRole) => {
    if (!onRoleChange || role === m.role) return;
    const err = roleChangeError(members, currentUserId, m.id, role);
    if (err) return setNotice({ ok: false, error: err });
    void run(`role:${m.id}`, () => onRoleChange(m.id, role), `${m.name} is now ${ROLE_LABEL[role].toLowerCase()}.`);
  };

  return (
    <>
      {onInvite && canManage && <InviteForm members={members} invites={invites} roles={offer} disabled={full} onInvite={onInvite} seatsLeft={seats ? Math.max(0, seats.limit - used) : undefined} />}

      <SettingsSection
        title="Members"
        description={seats ? `${used} of ${seats.limit} seats used${invites.length ? `, including ${invites.length} pending invite${invites.length === 1 ? "" : "s"}` : ""}.` : undefined}
        footer={
          notice ? (
            <span role="status" aria-live="polite" className={notice.ok ? undefined : "text-red-600 dark:text-red-400"}>
              {notice.ok ? notice.message : notice.error}
            </span>
          ) : undefined
        }
      >
        <ul className="-my-2 divide-y" aria-label="Members">
          {members.map((m) => {
            const self = m.id === currentUserId;
            const lockedRole = !onRoleChange || !canManage || self || (m.role === "owner" && me?.role !== "owner");
            const removeBlock = onRemove ? removeError(members, currentUserId, m.id) : "no";
            const canRemove = removeBlock === null && (self || canManage);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <Avatar label={m.name || m.email} src={m.avatarUrl} size="md" decorative />
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
                    <span className="truncate">{m.name || m.email}</span>
                    {self && (
                      <Badge size="sm" variant="outline">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-[12.5px] text-muted-foreground">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {lockedRole ? (
                    <span className="w-28 text-[13px] text-muted-foreground" title={self && onRoleChange ? "You can't change your own role." : undefined}>
                      {ROLE_LABEL[m.role]}
                    </span>
                  ) : (
                    <Select
                      size="sm"
                      className="w-28"
                      aria-label={`Role for ${m.name || m.email}`}
                      value={m.role}
                      disabled={busy === `role:${m.id}`}
                      onChange={(e) => changeRole(m, e.target.value as TeamRole)}
                      options={[...new Set([m.role, ...offer])].map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                    />
                  )}
                  {onRemove && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!canRemove}
                      title={!canRemove && removeBlock && removeBlock !== "no" ? removeBlock : undefined}
                      onClick={() => (setNotice(null), setRemoving(m))}
                      aria-label={self ? "Leave team" : `Remove ${m.name || m.email}`}
                    >
                      {self ? "Leave" : "Remove"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {invites.length > 0 && (
          <>
            <h3 className="mt-5 mb-1 text-[12.5px] font-medium text-muted-foreground">Pending invites</h3>
            <ul className="divide-y" aria-label="Pending invites">
              {invites.map((i) => (
                <li key={i.email} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                  <span aria-hidden="true" className="grid size-8 place-items-center rounded-full border border-dashed text-muted-foreground">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
                      <path d="m2.5 4.5 5.5 4 5.5-4" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="truncate text-[13.5px]">{i.email}</div>
                    <div className="text-[12px] text-muted-foreground">{`${ROLE_LABEL[i.role]} · invited ${shortDate(i.sentAt, locale)}`}</div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      {onResendInvite && (
                        <Button size="sm" variant="ghost" loading={busy === `resend:${i.email}`} onClick={() => void run(`resend:${i.email}`, () => onResendInvite(i.email), `Sent the invite to ${i.email} again.`)} aria-label={`Resend invite to ${i.email}`}>
                          Resend
                        </Button>
                      )}
                      {onCancelInvite && (
                        <Button size="sm" variant="ghost" loading={busy === `cancel:${i.email}`} onClick={() => void run(`cancel:${i.email}`, () => onCancelInvite(i.email), `Canceled the invite to ${i.email}.`)} aria-label={`Cancel invite to ${i.email}`}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </SettingsSection>

      {onRemove && (
        <Dialog
          open={removing !== null}
          onOpenChange={(o) => !o && setRemoving(null)}
          size="sm"
          title={removing?.id === currentUserId ? `Leave ${teamName}?` : `Remove ${removing?.name || removing?.email}?`}
          description={removing?.id === currentUserId ? "You lose access right away. An admin can invite you back." : "They lose access right away. Their work stays in the team."}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                loading={removing !== null && busy === `remove:${removing.id}`}
                onClick={() => {
                  const m = removing;
                  if (!m) return;
                  void run(`remove:${m.id}`, () => onRemove(m.id), m.id === currentUserId ? `You left ${teamName}.` : `Removed ${m.name || m.email}.`).then((r) => r.ok && setRemoving(null));
                }}
              >
                {removing?.id === currentUserId ? "Leave team" : "Remove"}
              </Button>
            </>
          }
        >
          {notice && !notice.ok && (
            <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
              {notice.error}
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}

function InviteForm({ members, invites, roles, disabled, seatsLeft, onInvite }: { members: TeamMember[]; invites: TeamInvite[]; roles: TeamRole[]; disabled: boolean; seatsLeft?: number; onInvite: (emails: string[], role: TeamRole) => Promise<SettingsResult> }) {
  const ids = { emails: useId(), role: useId() };
  const [text, setText] = useState("");
  const [role, setRole] = useState<TeamRole>(roles.includes("member") ? "member" : (roles[roles.length - 1] ?? "member"));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SettingsResult | null>(null);

  const submit = async () => {
    const { valid, invalid } = parseEmails(text);
    const dupes = alreadyOnTeam(valid, members, invites);
    if (invalid.length) return setResult({ ok: false, error: `Check ${invalid.length === 1 ? "this address" : "these addresses"}: ${invalid.join(", ")}.` });
    if (valid.length === 0) return setResult({ ok: false, error: "Enter at least one email address." });
    if (dupes.length) return setResult({ ok: false, error: `Already on the team or invited: ${dupes.join(", ")}.` });
    if (seatsLeft !== undefined && valid.length > seatsLeft) return setResult({ ok: false, error: `Only ${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left.` });
    setBusy(true);
    const r = await settleResult(onInvite(valid, role));
    setBusy(false);
    setResult(r.ok ? { ok: true, message: r.message ?? `Sent ${valid.length} invite${valid.length === 1 ? "" : "s"}.` } : r);
    if (r.ok) setText("");
  };

  return (
    <SettingsSection
      title="Invite people"
      description="They get an email with a link to join. Separate several addresses with commas."
      footer={
        <>
          <span role="status" aria-live="polite" className={result && !result.ok ? "text-red-600 dark:text-red-400" : undefined}>
            {result ? (result.ok ? result.message : result.error) : disabled ? "All seats are in use. Remove someone or add seats to invite more." : ROLE_HINT[role]}
          </span>
          <Button size="sm" loading={busy} disabled={disabled || text.trim() === ""} onClick={() => void submit()}>
            Send invites
          </Button>
        </>
      }
    >
      <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]" onSubmit={(e) => (e.preventDefault(), void submit())} noValidate>
        <Field label="Email addresses" id={ids.emails}>
          <Input id={ids.emails} type="text" inputMode="email" autoComplete="off" spellCheck={false} placeholder="sam@northwind.dev, lee@northwind.dev" value={text} onChange={(e) => (setText(e.target.value), result && !result.ok && setResult(null))} disabled={disabled} invalid={Boolean(result && !result.ok)} />
        </Field>
        <Field label="Role" id={ids.role}>
          <Select id={ids.role} value={role} onChange={(e) => setRole(e.target.value as TeamRole)} options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} disabled={disabled} />
        </Field>
      </form>
    </SettingsSection>
  );
}
