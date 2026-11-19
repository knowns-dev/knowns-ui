"use client";
/** @registry name="context-memory" type="ui" title="Context memory" description="A long conversation folds into a few memory notes, and the next run recalls the right one along a drawn line. A 4:3 card, a wide three-part scene, and a compact dashboard card; loops or plays once." */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { TickNumber } from "@/registry/knowns/lib/knowns/motion";
import { Badge } from "@/registry/knowns/ui/knowns/badge";
import { MOTION_GATE, useLive } from "./use-in-view";

export interface MemoryNote {
  id: string;
  /** One short line: the fact the agent kept. It wraps; it is never cut. */
  text: string;
  /** A small label: "Billing", "Policy"… */
  tag?: string;
}

export interface MemoryMessage {
  from: "user" | "agent";
  text: string;
}

export interface ContextMemoryProps {
  /** What the long conversation is compacted into. Three to four read best. */
  notes?: MemoryNote[];
  /** The conversation that fills up first. Six lines wide, four in the narrow card. */
  thread?: MemoryMessage[];
  /** How many messages the long run had, for the counter. */
  messageCount?: number;
  /** The id of the note the next run recalls. Default: the second note. */
  recall?: string;
  /** The first message of the next run. */
  prompt?: string;
  /** The next run's reply, which uses the recalled note. */
  answer?: string;
  /** "loop" repeats; "once" stops on the recalled frame. */
  mode?: "loop" | "once";
  /** A compact single card for a dashboard: the memory notes and one recall line, opacity only. */
  quiet?: boolean;
  paused?: boolean;
  className?: string;
}

const DEFAULT_THREAD: MemoryMessage[] = [
  { from: "user", text: "Does the annual plan renew on the 3rd?" },
  { from: "agent", text: "Yes, it is billed once a year." },
  { from: "user", text: "Refunds over 50 credits need a person." },
  { from: "agent", text: "Noted, I will ask before I refund." },
  { from: "user", text: "And please keep your replies short." },
  { from: "agent", text: "Understood, short from now on." },
];

const DEFAULT_NOTES: MemoryNote[] = [
  { id: "renewal", text: "Annual plans renew on the 3rd", tag: "Billing" },
  { id: "refunds", text: "Refunds over 50 credits need a person", tag: "Policy" },
  { id: "style", text: "Keep replies short", tag: "Style" },
];

export type MemoryPhase = "thread" | "compact" | "recall";

/** How long each phase lasts. Compact is the fold: the lines travel to the shelf in 520ms plus a short stagger. The loop dissolves from the recalled frame straight back to the first one, never through an empty scene. */
export const PHASE_MS: Record<MemoryPhase, number> = { thread: 2600, compact: 720, recall: 3800 };
/** The lines' flight to the memory shelf. Canvas travel: the lines cross a large part of the card. */
export const FLIGHT_MS = 520;

/** The phase after `p`. In "once" mode the recalled frame is the end. */
export function nextPhase(p: MemoryPhase, mode: "loop" | "once" = "loop"): MemoryPhase {
  if (p === "thread") return "compact";
  if (p === "compact") return "recall";
  return mode === "once" ? "recall" : "thread";
}

/** What shows in a phase. */
export function phaseView(p: MemoryPhase): { threadOn: boolean; notesIn: boolean; recallOn: boolean } {
  return { threadOn: p === "thread", notesIn: p !== "thread", recallOn: p === "recall" };
}

/** The note the next run recalls: the one named by `recall`, else the second (or the only) note. */
export function recalledNote(notes: MemoryNote[], recall?: string): MemoryNote | undefined {
  return notes.find((n) => n.id === recall) ?? notes[Math.min(1, notes.length - 1)];
}

/** Which memory slot a thread line flies into: lines are spread over the slots in order. */
export function slotFor(line: number, lines: number, slots: number): number {
  if (slots <= 0 || lines <= 0) return 0;
  return Math.min(slots - 1, Math.floor((line * slots) / lines));
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The line from the recalled note to the Recalled line. Side by side (wide) it is a gentle S from the note's right
 * edge to the line's left edge; stacked (narrow) it bows out past the right edge, from the note up to the line.
 */
export function beamPath(note: Box, line: Box): string {
  const f = (n: number) => +n.toFixed(1);
  const ny = note.y + note.h / 2;
  const ly = line.y + line.h / 2;
  const sx = note.x + note.w;
  if (line.x >= sx - 4) {
    const mx = (sx + line.x) / 2;
    return `M ${f(sx)} ${f(ny)} C ${f(mx)} ${f(ny)}, ${f(mx)} ${f(ly)}, ${f(line.x)} ${f(ly)}`;
  }
  const ex = line.x + line.w;
  const out = Math.max(sx, ex) + 14;
  return `M ${f(sx)} ${f(ny)} C ${f(out)} ${f(ny)}, ${f(out)} ${f(ly)}, ${f(ex)} ${f(ly)}`;
}

const SURFACE = "rounded-xl border bg-card";
const ACCENT = "var(--kn-accent, var(--color-indigo-500))";
const DUR = "var(--kn-dur)";
const FAST = "var(--kn-dur-fast)";
/** The counter jumps back up at the loop reset in a blink, not the half-second it takes to fall. */
const MOTION_FAST = 180;
const EASE = "var(--kn-ease-out)";

const CSS = `
.kncm-stage { position: relative; display: grid; width: 100%; gap: 8px; grid-template-areas: "top" "notes"; grid-template-columns: minmax(0, 1fr); min-height: 75cqw; }
.kncm-thread, .kncm-run { grid-area: top; }
.kncm-thread .kncm-b:nth-child(n + 5) { display: none; }
.kncm-notes { grid-area: notes; }
@container kncm (min-width: 560px) {
  .kncm-stage { min-height: 0; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-areas: "thread notes run"; }
  .kncm-thread { grid-area: thread; }
  .kncm-thread .kncm-b:nth-child(n + 5) { display: flex; }
  .kncm-notes { grid-area: notes; }
  .kncm-run { grid-area: run; }
}
.kncm-thread[data-s="recall"] { opacity: 0; }
.kncm-run[data-s="idle"] { opacity: 0; }
.kncm-b[data-fold] { opacity: 0; }
@container kncm (min-width: 560px) {
  .kncm-thread[data-s="recall"] { opacity: 0.7; }
  .kncm-run[data-s="idle"] { opacity: 1; }
  .kncm-b[data-fold] { opacity: 0.5; }
}
${MOTION_GATE}
`;

function Bubble({ m, style, fold }: { m: MemoryMessage; style?: CSSProperties; fold?: boolean }) {
  const user = m.from === "user";
  return (
    <div className={cn("kncm-b flex", user ? "justify-end" : "justify-start")} data-fold={fold ? "" : undefined} style={style}>
      <span className={cn("max-w-[88%] truncate rounded-lg px-2 py-[3px] text-[11px] leading-[16px]", user ? "bg-muted text-foreground" : "border bg-card text-muted-foreground")}>{m.text}</span>
    </div>
  );
}

function PaneHead({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 pb-1.5">
      <span className="text-[11.5px] font-medium text-foreground">{title}</span>
      {meta != null && <span className="truncate text-[11px] text-muted-foreground">{meta}</span>}
    </div>
  );
}

interface Flight {
  key: number;
  m: MemoryMessage;
  box: Box;
  dx: number;
  dy: number;
}

const rel = (el: Element, base: DOMRect): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
};

/**
 * A long conversation fills, its lines fly into a few memory notes, and a new run opens and pulls the right note
 * back along a drawn line. Loops (or plays once); pauses offscreen and in hidden tabs; reduced motion and the
 * server render show the finished, recalled frame. `quiet` is the compact dashboard card.
 */
export function ContextMemory({ notes = DEFAULT_NOTES, thread = DEFAULT_THREAD, messageCount = 214, recall, prompt = "Refund 80 credits to the Hale account", answer = "That is over the 50 credit limit, so I am asking a person to approve it.", mode = "loop", quiet, paused, className }: ContextMemoryProps) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const { live, reduced } = useLive(root, paused);
  const [phase, setPhase] = useState<MemoryPhase>("thread");
  const [cycle, setCycle] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [fly, setFly] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [beam, setBeam] = useState<{ d: string; w: number; h: number } | null>(null);
  const shelf = notes.slice(0, 4);
  const chosen = recalledNote(shelf, recall);
  const messages = thread.slice(0, 6);

  useEffect(() => {
    if (!live) return;
    if (phase === "recall" && mode === "once") return;
    const t = setTimeout(() => {
      const next = nextPhase(phase, mode);
      if (next === "thread") setCycle((c) => c + 1);
      setPhase(next);
    }, PHASE_MS[phase]);
    return () => clearTimeout(t);
  }, [live, phase, mode]);

  // Reduced motion (and a finished "once") show the composed frame: notes kept, one recalled, the answer written.
  const still = reduced;
  const shown: MemoryPhase = still ? "recall" : phase;
  const view = phaseView(shown);

  // Measure the lines and the shelf slots when the fold starts, and launch copies of the lines toward their slots.
  useLayoutEffect(() => {
    const st = stage.current;
    if (quiet || !st || still) return;
    if (phase !== "compact") {
      setFlights([]);
      setFly(false);
      return;
    }
    const base = st.getBoundingClientRect();
    const bubbles = [...st.querySelectorAll<HTMLElement>(".kncm-thread .kncm-b")].filter((b) => b.offsetWidth > 0);
    const slots = [...st.querySelectorAll<HTMLElement>("[data-cm-slot]")];
    if (!slots.length) return;
    const next = bubbles.flatMap((b, i): Flight[] => {
      const m = messages[i];
      const slot = slots[slotFor(i, bubbles.length, slots.length)];
      if (!m || !slot) return [];
      const from = rel(b.firstElementChild ?? b, base);
      const to = rel(slot, base);
      return [{ key: i, m, box: from, dx: to.x + to.w / 2 - (from.x + from.w / 2), dy: to.y + to.h / 2 - (from.y + from.h / 2) }];
    });
    setFlights(next);
    setFly(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFly(true)));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cycle, quiet, still]);

  // Measure the recalled note and the Recalled line for the drawn line; keep it right when the card resizes.
  useLayoutEffect(() => {
    const st = stage.current;
    if (quiet || !st || !view.recallOn) {
      setBeam(null);
      return;
    }
    const measure = () => {
      const base = st.getBoundingClientRect();
      const n = st.querySelector("[data-cm-hot]");
      const l = st.querySelector("[data-cm-line]");
      if (!n || !l) return;
      setBeam({ d: beamPath(rel(n, base), rel(l, base)), w: base.width, h: base.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(st);
    return () => ro.disconnect();
  }, [quiet, view.recallOn, chosen?.id, cycle]);

  // The line is drawn after it mounts, so the stroke has somewhere to travel from.
  const hasBeam = beam !== null;
  useEffect(() => {
    if (!hasBeam || !view.recallOn) return setDrawn(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(id);
  }, [hasBeam, view.recallOn, cycle]);

  const move = quiet ? "none" : "translateY(6px) scale(.97)";
  const tr = (extra = 0) => (still ? "none" : `opacity ${DUR} ${EASE} ${extra}ms, transform ${DUR} ${EASE} ${extra}ms`);
  const label = `A long conversation of ${messageCount} messages is compacted into ${shelf.length} memory notes; the next run recalls "${chosen?.text ?? ""}" and answers with it.`;

  if (quiet) {
    // The compact dashboard card: the notes as they are kept, and one recall line that lights the note it used.
    const lit = view.recallOn;
    return (
      <div ref={root} data-kn-ill="context-memory" data-live={live} data-phase={shown} data-quiet="" role="img" aria-label={label} className={cn("mx-auto w-full max-w-[420px] select-none", className)}>
        <style href="kn-context-memory" precedence="default">
          {CSS}
        </style>
        <div aria-hidden="true" className={cn("p-2.5", SURFACE)} >
          <PaneHead title="Memory" meta={`${shelf.length} notes`} />
          <ul className="flex flex-col gap-1">
            {shelf.map((n) => {
              const hot = lit && n.id === chosen?.id;
              return (
                <li key={n.id} className="flex items-start gap-2 rounded-lg border px-2 py-1" style={{ opacity: lit && !hot ? 0.55 : 1, background: hot ? `color-mix(in srgb, ${ACCENT} 6%, var(--card))` : "var(--card)", borderColor: hot ? `color-mix(in srgb, ${ACCENT} 55%, transparent)` : undefined, transition: tr() }}>
                  {n.tag && (
                    <Badge size="sm" tone={hot ? "accent" : "neutral"} className="mt-px flex-none">
                      {n.tag}
                    </Badge>
                  )}
                  <span className="min-w-0 text-[11.5px] leading-[16px] text-foreground">{n.text}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-start gap-1.5 border-t pt-2">
            <span className="flex-none pt-[3px] text-[11px] text-muted-foreground">Next run</span>
            <div className="min-w-0 flex-1 rounded-[4px] border-l-2 py-[3px] pr-1 pl-2" style={{ borderColor: lit ? ACCENT : "var(--border)", opacity: lit ? 1 : 0.5, transition: tr() }}>
              <span className="text-[11px] leading-[16px] text-foreground">{lit && chosen ? chosen.text : "Waiting for a question"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={root}
      data-kn-ill="context-memory"
      data-live={live}
      data-phase={shown}
      role="img"
      aria-label={label}
      className={cn("mx-auto w-full max-w-[880px] select-none [container-name:kncm] [container-type:inline-size]", className)}
    >
      <style href="kn-context-memory" precedence="default">
        {CSS}
      </style>
      <div aria-hidden="true">
        <div ref={stage} className="kncm-stage">
          {/* The long conversation. In the narrow card it gives way to the next run; wide, it stays and dims. */}
          <div className={cn("kncm-thread overflow-hidden p-2.5", SURFACE)} data-s={view.recallOn ? "recall" : "live"} style={{ transition: tr() }}>
            <PaneHead
              title="Run 1"
              meta={
                <TickNumber
                  value={view.threadOn ? messageCount : shelf.length}
                  ms={view.threadOn ? MOTION_FAST : FLIGHT_MS}
                  format={(n) => `${Math.round(n)} ${Math.round(n) > shelf.length ? "messages" : "notes"}`}
                />
              }
            />
            <div className="flex flex-col gap-1">
              {messages.map((m, i) => (
                <Bubble key={i} m={m} fold={!view.threadOn} style={{ transition: still ? "none" : `opacity ${FAST} ${EASE}` }} />
              ))}
            </div>
          </div>

          {/* The memory shelf: slots first, then the notes the lines flew into. Notes wrap, they are never cut. */}
          <div className={cn("kncm-notes p-2.5", SURFACE)}>
            <PaneHead title="Memory" meta={`${shelf.length} notes`} />
            <ul className="flex flex-col gap-1">
              {shelf.map((n, i) => {
                const hot = view.recallOn && n.id === chosen?.id;
                const dim = view.recallOn && !hot;
                return (
                  <li key={n.id} className="relative" data-cm-slot="" data-cm-hot={hot ? "" : undefined}>
                    <span className="absolute inset-0 rounded-lg border border-dashed" style={{ opacity: view.notesIn ? 0 : 1, transition: tr() }} />
                    <span
                      className="relative flex min-h-[26px] items-center gap-2 rounded-lg border px-2 py-[3px]"
                      style={{
                        opacity: view.notesIn ? (dim ? 0.55 : 1) : 0,
                        transform: view.notesIn ? "none" : move,
                        transition: tr(view.notesIn && !view.recallOn ? FLIGHT_MS - 160 + i * 40 : hot ? 160 : 0),
                        background: hot ? `color-mix(in srgb, ${ACCENT} 10%, var(--card))` : "var(--card)",
                        borderColor: hot ? `color-mix(in srgb, ${ACCENT} 55%, transparent)` : undefined,
                        boxShadow: hot ? `0 0 0 3px color-mix(in srgb, ${ACCENT} 14%, transparent)` : undefined,
                      }}
                    >
                      {n.tag && (
                        <Badge size="sm" tone={hot ? "accent" : "neutral"} className="flex-none">
                          {n.tag}
                        </Badge>
                      )}
                      <span className="min-w-0 text-[11.5px] leading-[15px] text-foreground">{n.text}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* The next run: it opens and asks, the note is drawn in, and the Recalled line and the answer follow. */}
          <div className={cn("kncm-run overflow-hidden p-2.5", SURFACE)} data-s={view.recallOn ? "run" : "idle"} style={{ transition: tr() }}>
            <PaneHead title="New run" meta="Next day" />
            <div className="relative">
              {/* Before the run arrives (wide) the panel keeps its place: quiet dashed slots, like the memory shelf. */}
              <div className="absolute inset-0 flex flex-col gap-1.5" style={{ opacity: view.recallOn ? 0 : 1, transition: tr() }}>
                {[26, 46, 46].map((h, i) => (
                  <span key={i} className="rounded-lg border border-dashed" style={{ height: h }} />
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
              <Bubble m={{ from: "user", text: prompt }} style={{ opacity: view.recallOn ? 1 : 0, transform: view.recallOn ? "none" : move, transition: tr(view.recallOn ? 40 : 0) }} />
              {chosen && (
                <div data-cm-line="">
                  <div
                    className="flex items-start gap-1.5 rounded-[4px] border-l-2 py-[3px] pr-1.5 pl-2"
                    style={{ borderColor: ACCENT, background: `color-mix(in srgb, ${ACCENT} 9%, transparent)`, opacity: view.recallOn ? 1 : 0, transform: view.recallOn ? "none" : move, transition: tr(view.recallOn ? 640 : 0) }}
                  >
                    <Badge size="sm" tone="accent" className="mt-px flex-none">
                      Recalled
                    </Badge>
                    <span className="min-w-0 text-[11px] leading-[16px] text-foreground">{chosen.text}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-start" style={{ opacity: view.recallOn ? 1 : 0, transform: view.recallOn ? "none" : move, transition: tr(view.recallOn ? 800 : 0) }}>
                <span className="max-w-[94%] rounded-lg border bg-card px-2 py-1 text-[11px] leading-[15px] text-muted-foreground">{answer}</span>
              </div>
              </div>
            </div>
          </div>

          {/* The fold: a copy of each line travels from the thread into its slot on the shelf, then fades into the note. */}
          {flights.map((f, i) => (
            <div
              key={f.key}
              className={cn("pointer-events-none absolute z-10 flex", f.m.from === "user" ? "justify-end" : "justify-start")}
              style={{
                left: f.box.x,
                top: f.box.y,
                width: f.box.w,
                height: f.box.h,
                opacity: fly ? 0 : 1,
                transform: fly ? `translate(${f.dx}px, ${f.dy}px) scale(.85)` : "none",
                transition: `transform ${FLIGHT_MS}ms ${EASE} ${i * 40}ms, opacity ${FAST} ${EASE} ${FLIGHT_MS - 120 + i * 40}ms`,
              }}
            >
              <span className={cn("block max-w-full truncate rounded-lg px-2 py-[3px] text-[11px] leading-[16px]", f.m.from === "user" ? "bg-muted text-foreground" : "border bg-card text-muted-foreground")}>{f.m.text}</span>
            </div>
          ))}

          {/* The recall: an accent line drawn from the note to the Recalled line. */}
          {beam && (
            <svg aria-hidden="true" viewBox={`0 0 ${beam.w} ${beam.h}`} className="pointer-events-none absolute inset-0 z-20 size-full overflow-visible" fill="none">
              <path
                d={beam.d}
                pathLength={100}
                stroke={ACCENT}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray="100 100"
                style={{ strokeDashoffset: still || drawn ? 0 : 100, transition: still ? "none" : `stroke-dashoffset 420ms ${EASE} 300ms` }}
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContextMemory;
