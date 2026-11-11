"use client";
/** @registry name="conversation-list" type="block" title="Conversation list" description="A chat history list: a search box, pinned chats, groups by day, inline rename and a row menu for pin, rename and delete. Arrow keys move between rows; F2 renames, Delete asks to delete." */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../../button";
import { Input } from "../../input";
import { Menu } from "../../menu";
import { cleanTitle, filterConversations, groupConversations, moveIndex, nextAfterDelete, type ChatConversationLike, type ChatTime } from "./conversation-list-utils";

export type { ChatTime, ConversationGroupLabel } from "./conversation-list-utils";
export { groupConversations, filterConversations, nextAfterDelete, cleanTitle } from "./conversation-list-utils";

export interface Conversation extends ChatConversationLike {}

export interface ConversationListProps<T extends Conversation = Conversation> {
  conversations: T[];
  /** The open conversation, marked with aria-current. */
  activeId?: string | null;
  onSelect: (id: string) => void;
  /** Adds Rename to the row menu and to F2. Called with the trimmed new title. */
  onRename?: (id: string, title: string) => void;
  /** Adds Delete to the row menu and to the Delete key. Confirm in your own dialog, then remove it. */
  onDelete?: (conversation: T) => void;
  /** Adds Pin / Unpin to the row menu. Pinned ones sit in a group on top. */
  onPin?: (id: string, pinned: boolean) => void;
  /** The search box above the list. Default true. */
  search?: boolean;
  searchPlaceholder?: string;
  /** Pass a fixed time for stable day groups (tests, docs). Default: now. */
  now?: ChatTime;
  /** Shown when there are no conversations. */
  empty?: ReactNode;
  className?: string;
  "aria-label"?: string;
}

const svg = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const SearchGlyph = () => (
  <svg {...svg}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="m10.25 10.25 3 3" />
  </svg>
);
const MoreGlyph = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <circle cx="3.5" cy="8" r="1.2" />
    <circle cx="8" cy="8" r="1.2" />
    <circle cx="12.5" cy="8" r="1.2" />
  </svg>
);
const PencilGlyph = () => (
  <svg {...svg}>
    <path d="M10.5 3.25 12.75 5.5M3 13l.5-2.5L11 3a1.2 1.2 0 0 1 1.7 0l.3.3a1.2 1.2 0 0 1 0 1.7L5.5 12.5z" />
  </svg>
);
const TrashGlyph = () => (
  <svg {...svg}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.25h5.8l.6-8.25M6.75 7v3.5M9.25 7v3.5" />
  </svg>
);
const PinGlyph = () => (
  <svg {...svg}>
    <path d="m9.75 2.5 3.75 3.75-1.5.5-2 2 .25 2.5-1 1-2.5-2.5L3 13.5M6.5 5l-1.5.25-.75.75 5.5 5.5" />
  </svg>
);

/**
 * Chat history for a sidebar: pinned chats, then groups by day, with search, inline rename and a row menu.
 * One tab stop for the list; Up and Down, Home and End move between rows, Enter opens, F2 renames, Delete asks.
 */
export function ConversationList<T extends Conversation = Conversation>({
  conversations,
  activeId = null,
  onSelect,
  onRename,
  onDelete,
  onPin,
  search = true,
  searchPlaceholder = "Search chats",
  now,
  empty,
  className,
  "aria-label": ariaLabel = "Conversations",
}: ConversationListProps<T>) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => filterConversations(conversations, query), [conversations, query]);
  const groups = useMemo(() => groupConversations(shown, now), [shown, now]);
  const order = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  // The one row in the tab order: the focused one, else the open one, else the first.
  const tabId = order.find((c) => c.id === focusId)?.id ?? order.find((c) => c.id === activeId)?.id ?? order[0]?.id;
  const rowEl = (cid: string) => list.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(cid)}"]`);
  const focusRow = (cid: string | null | undefined) => {
    if (!cid) return;
    setFocusId(cid);
    requestAnimationFrame(() => rowEl(cid)?.focus());
  };

  const rowHadFocus = useRef<string | null>(null);
  // After a row disappears (deleted by the host), keep focus in the list.
  const prevOrder = useRef<string[]>([]);
  useEffect(() => {
    const gone = prevOrder.current.find((x) => !order.some((c) => c.id === x) && rowHadFocus.current === x);
    if (gone) {
      const was = prevOrder.current.map((x) => ({ id: x }));
      focusRow(nextAfterDelete(was, gone) ?? order[0]?.id);
      rowHadFocus.current = null;
    }
    prevOrder.current = order.map((c) => c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.map((c) => c.id).join("|")]);

  const commit = (c: T) => {
    const t = cleanTitle(draft, c.title);
    if (t) onRename?.(c.id, t);
    setRenaming(null);
    focusRow(c.id);
  };
  const startRename = (c: T) => {
    setDraft(c.title);
    setRenaming(c.id);
  };

  const onKey = (e: KeyboardEvent<HTMLElement>, c: T) => {
    if (e.target !== e.currentTarget) return;
    const at = order.findIndex((x) => x.id === c.id);
    const to = moveIndex(e.key, at, order.length);
    if (to !== null) {
      e.preventDefault();
      focusRow(order[to].id);
    } else if (e.key === "F2" && onRename) {
      e.preventDefault();
      startRename(c);
    } else if (e.key === "Delete" && onDelete) {
      e.preventDefault();
      rowHadFocus.current = c.id;
      onDelete(c);
    }
  };

  const empties = conversations.length === 0;
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {search && !empties && (
        <div className="px-2 pb-2">
          <Input
            size="sm"
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                setQuery("");
              }
              if (e.key === "ArrowDown" && order[0]) {
                e.preventDefault();
                focusRow(order[0].id);
              }
            }}
            prefix={<SearchGlyph />}
          />
        </div>
      )}
      <div ref={list} role="region" aria-label={ariaLabel} className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {empties && <div className="px-2.5 py-6 text-[12.5px] text-muted-foreground">{empty ?? "No chats yet. Start one and it shows up here."}</div>}
        {!empties && groups.length === 0 && (
          <p role="status" className="px-2.5 py-6 text-[12.5px] text-muted-foreground">
            No chats match “{query.trim()}”.
          </p>
        )}
        {groups.map((group) => (
          <section key={group.label} aria-labelledby={`${id}-${group.label}`} className="pt-3 first:pt-1">
            <h3 id={`${id}-${group.label}`} className="flex items-center gap-1.5 px-2.5 pb-1 text-[11.5px] font-medium text-muted-foreground [&>svg]:size-3">
              {group.label === "Pinned" && <PinGlyph />}
              {group.label}
            </h3>
            <ul className="flex flex-col gap-px">
              {group.items.map((c) => {
                const active = c.id === activeId;
                if (renaming === c.id)
                  return (
                    <li key={c.id} className="px-0.5 py-0.5">
                      <Input
                        size="sm"
                        autoFocus
                        aria-label="Chat title"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => commit(c)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit(c);
                          if (e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            setRenaming(null);
                            focusRow(c.id);
                          }
                        }}
                      />
                    </li>
                  );
                const menu = [
                  ...(onPin ? [{ id: "pin", label: c.pinned ? "Unpin" : "Pin", icon: <PinGlyph /> }] : []),
                  ...(onRename ? [{ id: "rename", label: "Rename", icon: <PencilGlyph /> }] : []),
                  ...(onDelete ? [{ id: "delete", label: "Delete", icon: <TrashGlyph />, danger: true }] : []),
                ];
                return (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      data-row={c.id}
                      tabIndex={c.id === tabId ? 0 : -1}
                      onFocus={() => setFocusId(c.id)}
                      onClick={() => onSelect(c.id)}
                      onKeyDown={(e) => onKey(e, c)}
                      aria-current={active ? "page" : undefined}
                      title={c.title}
                      className={cn(
                        "flex h-8 w-full items-center rounded-[9px] pl-2.5 text-left text-[13px] transition-colors",
                        menu.length ? "pr-9" : "pr-2.5",
                        active ? "bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] font-medium text-foreground" : "text-foreground/80 hover:bg-[color-mix(in_srgb,var(--foreground)_4.5%,transparent)] hover:text-foreground",
                        focusRing,
                      )}
                    >
                      <span className="truncate">{c.title}</span>
                    </button>
                    {menu.length > 0 && (
                      <div className="absolute inset-y-0 right-1 flex items-center opacity-0 transition-opacity ease-(--kn-ease-out) group-focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100 [@media(hover:none)]:opacity-100">
                        <Menu
                          aria-label={`Actions for ${c.title}`}
                          align="end"
                          items={menu}
                          onSelect={(item) => {
                            if (item.id === "pin") onPin?.(c.id, !c.pinned);
                            if (item.id === "rename") startRename(c);
                            if (item.id === "delete") {
                              rowHadFocus.current = c.id;
                              onDelete?.(c);
                            }
                          }}
                          trigger={<Button variant="ghost" size="xs" icon={<MoreGlyph />} aria-label={`More for ${c.title}`} />}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default ConversationList;
