"use client";
/** @registry name="settings-security" type="block" title="Settings: security" description="Connected logins (connect, disconnect) and active sessions (this device marked, sign out one or all others). Callbacks only." */
/**
 * Security settings: connected logins (OAuth providers you can connect and disconnect) and active
 * sessions (this device marked, sign out one or all others). Callbacks only; works with any auth backend.
 */
import { useState, type ReactNode } from "react";
import { Badge } from "../../badge";
import { Button } from "../../button";
import { SettingsSection } from "./settings-layout";
import { lastUsed, settleResult, type SettingsResult } from "./settings-utils";

export interface ConnectedLogin {
  /** Provider id, e.g. "github". */
  id: string;
  label: string;
  icon?: ReactNode;
  connected: boolean;
  /** The account shown when connected, e.g. "@mina" or an email. */
  account?: string;
}

export interface SessionInfo {
  id: string;
  /** "Chrome on macOS". */
  device: string;
  /** "Vietnam" or "Hanoi, VN". */
  location?: string | null;
  lastActive: Date | string | number;
  current?: boolean;
}

export interface SecuritySettingsProps {
  /** Connected logins; leave out (or empty) to hide the section. */
  logins?: ConnectedLogin[];
  /** Starts the provider's connect redirect. Resolve an error to show it. */
  onConnect?: (id: string) => Promise<SettingsResult | void>;
  onDisconnect?: (id: string) => Promise<SettingsResult>;
  /** Under the Connected logins title. */
  loginsDescription?: ReactNode;
  sessions?: SessionInfo[];
  /** Signs out every session except this one. */
  onSignOutOthers?: () => Promise<SettingsResult>;
  /** Signs out one session. Without it rows have no button. */
  onSignOut?: (id: string) => Promise<SettingsResult>;
  /** Under the Active sessions title, e.g. "Sessions last 30 days." */
  sessionsDescription?: ReactNode;
  now?: number;
  locale?: string;
}

/** "Active today", "Last active yesterday", "Last active 3 days ago", "Last active Oct 2". */
const activeText = (when: string) => (when === "Today" ? "Active today" : when === "Yesterday" ? "Last active yesterday" : `Last active ${when}`);

function Status({ result }: { result: SettingsResult | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={result.ok ? "mt-3 text-[12.5px] text-emerald-700 dark:text-emerald-400" : "mt-3 text-[12.5px] text-red-600 dark:text-red-400"}>
      {result.ok ? (result.message ?? "Done.") : result.error}
    </p>
  );
}

export function SecuritySettings({
  logins = [],
  onConnect,
  onDisconnect,
  loginsDescription = "Sign in faster with an account you already have. Email sign-in always works too.",
  sessions = [],
  onSignOutOthers,
  onSignOut,
  sessionsDescription = "Where you're signed in right now.",
  now = Date.now(),
  locale = "en-US",
}: SecuritySettingsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [loginResult, setLoginResult] = useState<SettingsResult | null>(null);
  const [sessionResult, setSessionResult] = useState<SettingsResult | null>(null);
  const others = sessions.filter((s) => !s.current);

  const run = async (key: string, fn: () => Promise<SettingsResult | void>, set: (r: SettingsResult | null) => void) => {
    setBusy(key);
    set(null);
    const r = await settleResult(fn().then((x) => x ?? { ok: true as const }));
    setBusy(null);
    // A connect that only redirects resolves with nothing: no message.
    if (!r.ok || r.message) set(r);
  };

  return (
    <>
      {logins.length > 0 && (
        <SettingsSection id="connected-logins" title="Connected logins" description={loginsDescription}>
          <ul className="-my-2 divide-y" aria-label="Connected logins">
            {logins.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                {l.icon && (
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg border bg-muted/40 [&_svg]:size-4">
                    {l.icon}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                    {l.label}
                    {l.connected && (
                      <Badge tone="success" size="sm" dot>
                        Connected
                      </Badge>
                    )}
                  </div>
                  {l.connected && l.account && <div className="truncate text-[12.5px] text-muted-foreground">{l.account}</div>}
                </div>
                {l.connected
                  ? onDisconnect && (
                      <Button size="sm" variant="ghost" loading={busy === `d:${l.id}`} disabled={busy !== null} onClick={() => void run(`d:${l.id}`, () => onDisconnect(l.id), setLoginResult)} aria-label={`Disconnect ${l.label}`}>
                        Disconnect
                      </Button>
                    )
                  : onConnect && (
                      <Button size="sm" variant="secondary" loading={busy === `c:${l.id}`} disabled={busy !== null} onClick={() => void run(`c:${l.id}`, () => onConnect(l.id), setLoginResult)} aria-label={`Connect ${l.label}`}>
                        Connect
                      </Button>
                    )}
              </li>
            ))}
          </ul>
          <Status result={loginResult} />
        </SettingsSection>
      )}

      {sessions.length > 0 && (
        <SettingsSection
          id="sessions"
          title="Active sessions"
          description={sessionsDescription}
          actions={
            onSignOutOthers && others.length > 0 ? (
              <Button size="sm" variant="secondary" loading={busy === "others"} disabled={busy !== null} onClick={() => void run("others", onSignOutOthers, setSessionResult)}>
                Sign out other sessions
              </Button>
            ) : undefined
          }
        >
          <ul className="-my-2 divide-y" aria-label="Active sessions">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                    {s.device}
                    {s.current && (
                      <Badge tone="info" size="sm">
                        This device
                      </Badge>
                    )}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground" suppressHydrationWarning>
                    {[s.location, s.current ? "Active now" : activeText(lastUsed(s.lastActive, now, locale))].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {onSignOut && !s.current && (
                  <Button size="sm" variant="ghost" loading={busy === `s:${s.id}`} disabled={busy !== null} onClick={() => void run(`s:${s.id}`, () => onSignOut(s.id), setSessionResult)} aria-label={`Sign out ${s.device}`}>
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Status result={sessionResult} />
        </SettingsSection>
      )}
    </>
  );
}
