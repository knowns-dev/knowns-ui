"use client";
/** @registry name="settings-notifications" type="block" title="Notification settings" description="Events by channel (email, push, in-app) with row and column toggles, required events, an email digest and quiet hours." */
/**
 * Notification settings: a matrix of events (rows, grouped) by channels (email, push, in-app), with a
 * row "all" box and a per-channel toggle in the header, an email digest frequency, and quiet hours.
 * Edits are a draft until Save; required events (security) stay on.
 */
import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Checkbox } from "../../checkbox";
import { Input } from "../../input";
import { SegmentedControl } from "../../segmented-control";
import { Switch } from "../../switch";
import { SaveBar, SettingsRow, SettingsSection } from "./settings-layout";
import { changedKeys, quietHoursError, rowState, setCell, setColumn, setRow, settleResult, type NotificationMatrix, type SettingsResult } from "./settings-utils";

export interface NotificationEvent {
  id: string;
  label: string;
  description?: string;
  /** Rows with the same group get a heading. */
  group?: string;
  /** Channels this event can use. Default: all. */
  channels?: string[];
  /** Always on (e.g. security alerts): shown, but can't be turned off. */
  required?: boolean;
}

export interface NotificationChannel {
  id: string;
  label: string;
}

export type DigestFrequency = "off" | "daily" | "weekly";

export interface NotificationValue {
  matrix: NotificationMatrix;
  digest?: DigestFrequency;
  quietHours?: { enabled: boolean; from: string; to: string };
}

export interface NotificationSettingsProps {
  events: NotificationEvent[];
  channels?: NotificationChannel[];
  value: NotificationValue;
  onSave: (next: NotificationValue) => Promise<SettingsResult>;
  /** Hide the digest row. */
  digest?: boolean;
  /** Hide the quiet hours row. */
  quietHours?: boolean;
  title?: ReactNode;
  /** Under the title. Default "Choose what reaches you, and where." */
  description?: ReactNode;
}

const DEFAULT_CHANNELS: NotificationChannel[] = [
  { id: "email", label: "Email" },
  { id: "push", label: "Push" },
  { id: "in-app", label: "In-app" },
];

export function NotificationSettings({ events, channels = DEFAULT_CHANNELS, value, onSave, digest = true, quietHours = true, title = "Notifications", description = "Choose what reaches you, and where." }: NotificationSettingsProps) {
  const ids = { from: useId(), to: useId() };
  const saved: Required<NotificationValue> = { matrix: value.matrix, digest: value.digest ?? "weekly", quietHours: value.quietHours ?? { enabled: false, from: "22:00", to: "07:00" } };
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SettingsResult | null>(null);
  useEffect(() => setDraft(JSON.parse(savedKey)), [savedKey]);

  const allIds = channels.map((c) => c.id);
  const chOf = (e: NotificationEvent) => (e.channels ?? allIds).filter((c) => allIds.includes(c));
  const editable = events.filter((e) => !e.required);
  const dirty = changedKeys(saved, draft).length > 0;
  const qhError = draft.quietHours.enabled ? quietHoursError(draft.quietHours.from, draft.quietHours.to) : null;
  const m = draft.matrix;
  const setM = (matrix: NotificationMatrix) => (setDraft({ ...draft, matrix }), setResult(null));

  const save = async () => {
    if (qhError) return;
    setSaving(true);
    const r = await settleResult(onSave(draft));
    setSaving(false);
    setResult(r);
  };

  // Per channel: on for every editable event that offers it?
  const columnOn = (c: string) => {
    const rows = editable.filter((e) => chOf(e).includes(c));
    return rows.length > 0 && rows.every((e) => m[e.id]?.[c]);
  };

  const groups: { name?: string; rows: NotificationEvent[] }[] = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && last.name === e.group) last.rows.push(e);
    else groups.push({ name: e.group, rows: [e] });
  }

  return (
    <SettingsSection
      title={title}
      description={description}
      footer={<SaveBar dirty={dirty} saving={saving} result={qhError ? { ok: false, error: qhError } : result} onSave={() => void save()} onDiscard={() => (setDraft(saved), setResult(null))} />}
    >
      {channels.length === 1 ? (
        // One channel: a plain list, one switch per event (a matrix of one column says nothing).
        <div className="grid">
          {groups.map((g, gi) => (
            <div key={g.name ?? `g${gi}`} role="group" aria-labelledby={g.name ? `${ids.from}-g${gi}` : undefined} className={gi > 0 ? "mt-4" : undefined}>
              {g.name && (
                <h3 id={`${ids.from}-g${gi}`} className="pb-1 text-[12px] font-medium text-muted-foreground">
                  {g.name}
                </h3>
              )}
              <div className="divide-y">
                {g.rows.map((e) => {
                  const c = channels[0];
                  const offered = chOf(e).includes(c.id);
                  return (
                    <SettingsRow key={e.id} label={e.label} description={e.required ? `${e.description ? `${e.description} ` : ""}Always on.` : e.description} className="py-2.5 first:pt-2.5 last:pb-2.5">
                      {offered ? (
                        <Switch aria-label={e.label} checked={e.required ? true : Boolean(m[e.id]?.[c.id])} disabled={e.required} onCheckedChange={(on) => setM(setCell(m, e.id, c.id, on))} />
                      ) : (
                        <span className="text-[12.5px] text-muted-foreground">Not available</span>
                      )}
                    </SettingsRow>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        <table className="w-full min-w-[340px] border-collapse text-[13.5px]">
          <caption className="sr-only">Notification channels for each event</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-3 text-left text-[12px] font-medium text-muted-foreground">
                Event
              </th>
              {channels.map((c) => {
                const on = columnOn(c.id);
                return (
                  <th key={c.id} scope="col" className="w-16 px-1 py-2 text-center text-[12px] font-medium text-muted-foreground sm:w-20">
                    <button
                      type="button"
                      onClick={() => setM(setColumn(m, editable.filter((e) => chOf(e).includes(c.id)).map((e) => e.id), c.id, !on))}
                      className="rounded px-1 underline-offset-[3px] hover:text-foreground hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring"
                      aria-label={`${on ? "Turn off" : "Turn on"} ${c.label.toLowerCase()} for every event`}
                    >
                      {c.label}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => (
              <Fragment key={g.name ?? `g${gi}`}>
                {g.name && (
                  <tr>
                    <th scope="colgroup" colSpan={channels.length + 1} className="pt-4 pb-1 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {g.name}
                    </th>
                  </tr>
                )}
                {g.rows.map((e) => {
                  const offered = chOf(e);
                  const state = e.required ? "all" : rowState(m, e.id, offered);
                  return (
                    <tr key={e.id} className="border-b last:border-0">
                      <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                        <div className="flex items-start gap-2.5">
                          <Checkbox
                            size="sm"
                            className="mt-0.5"
                            aria-label={`All channels for ${e.label}`}
                            checked={state === "all"}
                            indeterminate={state === "some"}
                            disabled={e.required}
                            onChange={() => setM(setRow(m, e.id, offered, state !== "all"))}
                          />
                          <div className="min-w-0">
                            <div className="font-medium">{e.label}</div>
                            {(e.description || e.required) && <div className="text-[12px] leading-snug text-muted-foreground">{e.required ? `${e.description ? `${e.description} ` : ""}Always on.` : e.description}</div>}
                          </div>
                        </div>
                      </th>
                      {channels.map((c) => (
                        <td key={c.id} className="px-1 py-2.5 text-center align-middle">
                          {offered.includes(c.id) ? (
                            <span className="inline-flex justify-center">
                              <Switch
                                aria-label={`${e.label}: ${c.label}`}
                                checked={e.required ? true : Boolean(m[e.id]?.[c.id])}
                                disabled={e.required}
                                onCheckedChange={(on) => setM(setCell(m, e.id, c.id, on))}
                              />
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60" aria-label={`${c.label} not available`}>
                              -
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {(digest || quietHours) && (
        <div className="mt-5 grid gap-1 border-t pt-4">
          {digest && (
            <SettingsRow label="Email digest" description="A summary of what you missed, instead of one email per event.">
              <SegmentedControl
                aria-label="Email digest"
                size="sm"
                value={draft.digest}
                onValueChange={(v) => (setDraft({ ...draft, digest: v as DigestFrequency }), setResult(null))}
                options={[
                  { value: "off", label: "Off" },
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                ]}
              />
            </SettingsRow>
          )}
          {quietHours && (
            <SettingsRow label="Quiet hours" description="Hold push notifications during these hours, in your time zone.">
              <div className="flex flex-wrap items-center gap-2">
                <Switch aria-label="Quiet hours" checked={draft.quietHours.enabled} onCheckedChange={(on) => (setDraft({ ...draft, quietHours: { ...draft.quietHours, enabled: on } }), setResult(null))} />
                <div className={cn("flex items-center gap-1.5 text-[13px] text-muted-foreground", !draft.quietHours.enabled && "opacity-60")}>
                  <label htmlFor={ids.from} className="sr-only">
                    From
                  </label>
                  <span className="w-[6.5rem]">
                    <Input id={ids.from} type="time" size="sm" value={draft.quietHours.from} disabled={!draft.quietHours.enabled} invalid={Boolean(qhError)} onChange={(e) => setDraft({ ...draft, quietHours: { ...draft.quietHours, from: e.target.value } })} />
                  </span>
                  <span aria-hidden="true">to</span>
                  <label htmlFor={ids.to} className="sr-only">
                    To
                  </label>
                  <span className="w-[6.5rem]">
                    <Input id={ids.to} type="time" size="sm" value={draft.quietHours.to} disabled={!draft.quietHours.enabled} invalid={Boolean(qhError)} onChange={(e) => setDraft({ ...draft, quietHours: { ...draft.quietHours, to: e.target.value } })} />
                  </span>
                </div>
              </div>
            </SettingsRow>
          )}
        </div>
      )}
    </SettingsSection>
  );
}
