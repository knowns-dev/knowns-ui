"use client";
/** @registry name="ghost-text" type="ui" title="Ghost text" description="Inline AI completion for an input or textarea: a faint suggestion after the caret, Tab to accept, Ctrl/Cmd+Right for one word, Esc to dismiss, a loading shimmer and a screen reader hint. Plain and monospace variants." */

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type Ref,
  type RefCallback,
} from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { fieldClass } from "../input";
import { Kbd } from "../kbd";
import { caretAtEnd, ghostHint, nextWord, remainingGhost } from "./ghost-utils";

export type GhostAcceptKind = "all" | "word";
export type GhostTextVariant = "default" | "mono";

export interface GhostTextProps {
  /** The field's text (controlled). */
  value: string;
  onChange: (value: string) => void;
  /**
   * The completion for the text as it is now, e.g. from your model. It continues `value` from the moment it
   * arrives: typing the same characters consumes it, typing something else hides it until the next one.
   */
  suggestion?: string | null;
  /** A suggestion is being fetched: a faint shimmer sits after the caret. */
  loading?: boolean;
  /** Called with the accepted text: the whole rest (Tab) or the next word (Ctrl/Cmd+Right). */
  onAccept?: (text: string, kind: GhostAcceptKind) => void;
  /** Called when Esc hides the current suggestion. */
  onDismiss?: () => void;
  /** A textarea instead of a one-line input. */
  multiline?: boolean;
  /** Textarea rows. Default 3. */
  rows?: number;
  /** "mono" for code-like text: monospace, tighter, tab size 2. */
  variant?: GhostTextVariant;
  /** Show a small "Tab" key at the end of the field while a suggestion is visible. Default true. */
  showHint?: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  spellCheck?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** On the wrapper. */
  className?: string;
  /** On the input or textarea. */
  fieldClassName?: string;
  ref?: Ref<HTMLInputElement | HTMLTextAreaElement>;
}

const CSS = `
@keyframes knght-sweep { from { background-position: 100% 0 } to { background-position: -100% 0 } }
@keyframes knght-in { from { opacity: 0 } to { opacity: 1 } }
`;

// Computed styles the overlay copies from the field, so the ghost lines up with the real text.
const COPY = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariantLigatures",
  "fontFeatureSettings",
  "letterSpacing",
  "wordSpacing",
  "lineHeight",
  "textTransform",
  "textIndent",
  "tabSize",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "boxSizing",
] as const;

function useMergedRef<T>(a: Ref<T> | undefined, b: Ref<T> | undefined): RefCallback<T> {
  return useCallback(
    (el: T | null) => {
      for (const r of [a, b]) {
        if (typeof r === "function") r(el);
        else if (r) (r as { current: T | null }).current = el;
      }
    },
    [a, b],
  );
}

/**
 * An input or textarea with an inline AI completion: the suggestion shows as faint text after the caret,
 * aligned to the real text by a mirror layer. Tab accepts it, Ctrl/Cmd+Right accepts a word, Esc hides it.
 */
export function GhostText({
  value,
  onChange,
  suggestion,
  loading = false,
  onAccept,
  onDismiss,
  multiline = false,
  rows = 3,
  variant = "default",
  showHint = true,
  placeholder,
  disabled,
  id,
  name,
  autoFocus,
  spellCheck,
  onKeyDown,
  onFocus,
  onBlur,
  className,
  fieldClassName,
  ref,
  ...aria
}: GhostTextProps) {
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const setRef = useMergedRef(field, ref);
  const hintId = useId();
  const [focused, setFocused] = useState(false);
  const [atEnd, setAtEnd] = useState(true);

  // The value a suggestion continues is the value at the moment it arrived.
  const [src, setSrc] = useState({ suggestion: suggestion ?? "", anchor: value, dismissed: false });
  if (src.suggestion !== (suggestion ?? "")) setSrc({ suggestion: suggestion ?? "", anchor: value, dismissed: false });

  const ghost = src.dismissed ? null : remainingGhost(src.anchor, src.suggestion, value);
  // Unfocused fields show the ghost too (e.g. a preview); focused ones only with the caret at the end.
  const caretOk = !focused || atEnd;
  const visible = Boolean(ghost) && caretOk && !disabled;
  const shimmer = loading && !ghost && caretOk && focused && !disabled;

  const syncCaret = () => {
    const el = field.current;
    if (el) setAtEnd(caretAtEnd(el.value, el.selectionStart, el.selectionEnd));
  };

  // Copy the field's text metrics onto the mirror and keep them in step with resizes.
  useLayoutEffect(() => {
    const el = field.current;
    const m = mirror.current;
    if (!el || !m) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      for (const k of COPY) (m.style as unknown as Record<string, string>)[k] = cs[k];
      m.style.borderStyle = "solid";
      m.style.borderColor = "transparent";
      // Leave the textarea's scrollbar uncovered.
      m.style.right = `${el.offsetWidth - el.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth)}px`;
      m.scrollTop = el.scrollTop;
      m.scrollLeft = el.scrollLeft;
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [multiline, variant]);

  // Follow the field's scroll (long single-line text, or a textarea scrolled down). A textarea also grows
  // while a multi-line ghost needs more room than it has, and shrinks back when the ghost goes.
  useLayoutEffect(() => {
    const el = field.current;
    const m = mirror.current;
    if (!el || !m) return;
    if (multiline) {
      el.style.minHeight = "";
      if (m.scrollHeight > el.clientHeight) el.style.minHeight = `${m.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    }
    m.scrollTop = el.scrollTop;
    m.scrollLeft = el.scrollLeft;
  });

  const accept = (text: string, kind: GhostAcceptKind) => {
    onChange(value + text);
    onAccept?.(text, kind);
  };

  const keyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || !visible || !ghost || e.nativeEvent.isComposing) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "Tab" && !e.shiftKey && !e.altKey && !mod) {
      e.preventDefault();
      accept(ghost, "all");
    } else if (e.key === "ArrowRight" && mod && !e.shiftKey && !e.altKey && atEnd) {
      e.preventDefault();
      accept(nextWord(ghost), "word");
    } else if (e.key === "Escape") {
      // Keep Esc from also closing a surrounding dialog or popover.
      e.preventDefault();
      e.stopPropagation();
      setSrc((s) => ({ ...s, dismissed: true }));
      onDismiss?.();
    }
  };

  const describedBy = [aria["aria-describedby"], hintId].filter(Boolean).join(" ");
  const mono = variant === "mono";
  const shared = {
    id,
    name,
    value,
    placeholder: value || visible ? undefined : placeholder,
    disabled,
    autoFocus,
    spellCheck: spellCheck ?? !mono,
    autoComplete: "off",
    "aria-label": aria["aria-label"],
    "aria-labelledby": aria["aria-labelledby"],
    "aria-describedby": describedBy,
    "aria-busy": loading || undefined,
    onKeyDown: keyDown,
    onSelect: syncCaret,
    onFocus: () => {
      setFocused(true);
      syncCaret();
      onFocus?.();
    },
    onBlur: () => {
      setFocused(false);
      onBlur?.();
    },
    onScroll: () => {
      const el = field.current;
      if (el && mirror.current) {
        mirror.current.scrollTop = el.scrollTop;
        mirror.current.scrollLeft = el.scrollLeft;
      }
    },
  };
  const fieldCls = cn(
    fieldClass,
    "relative block bg-clip-padding",
    mono && "font-mono text-[12.5px] [tab-size:2]",
    multiline ? "resize-none px-3 py-2 leading-relaxed" : "h-9 px-3",
    showHint && "pr-14",
    fieldClassName,
  );

  return (
    <div className={cn("relative w-full", className)} data-ghost={visible ? "" : undefined}>
      <style href="kn-ghost-text" precedence="default">
        {CSS}
      </style>
      {multiline ? (
        <textarea
          {...shared}
          ref={setRef as Ref<HTMLTextAreaElement>}
          rows={rows}
          onChange={(e) => {
            onChange(e.target.value);
            syncCaret();
          }}
          className={fieldCls}
        />
      ) : (
        <input
          {...shared}
          ref={setRef as Ref<HTMLInputElement>}
          type="text"
          onChange={(e) => {
            onChange(e.target.value);
            syncCaret();
          }}
          className={fieldCls}
        />
      )}

      {/* The mirror: the real text in transparent ink, then the ghost, wrapped exactly like the field. */}
      <div
        ref={mirror}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 overflow-hidden text-transparent",
          multiline ? "whitespace-pre-wrap break-words" : "flex items-center whitespace-pre",
        )}
        style={{ right: 0 } as CSSProperties}
      >
        <span className={multiline ? undefined : "shrink-0"}>
          {value}
          {visible && (
            <span data-ghost-text="" className="text-muted-foreground/65 motion-safe:animate-[knght-in_160ms_ease-out]">
              {ghost}
            </span>
          )}
          {shimmer && (
            <span
              data-ghost-loading=""
              className={cn(
                "ml-1 inline-block h-[0.85em] w-10 translate-y-[0.1em] rounded-full align-baseline",
                "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--foreground)_8%,transparent)_0%,color-mix(in_srgb,var(--foreground)_20%,transparent)_50%,color-mix(in_srgb,var(--foreground)_8%,transparent)_100%)] bg-[length:200%_100%]",
                "motion-safe:[animation:knght-sweep_1.3s_linear_infinite]",
              )}
            />
          )}
        </span>
      </div>

      {showHint && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-2.5 flex items-center gap-1 text-[11px] text-muted-foreground transition-opacity duration-200 ease-out",
            multiline ? "bottom-2" : "inset-y-0",
            visible && focused ? "opacity-100" : "opacity-0",
          )}
        >
          <Kbd size="sm">Tab</Kbd>
        </span>
      )}

      <span id={hintId} className="sr-only">
        {ghostHint(visible ? ghost : null, shimmer)}
      </span>
      <span className="sr-only" aria-live="polite">
        {visible && focused ? "Suggestion available. Press Tab to accept." : ""}
      </span>
    </div>
  );
}

export default GhostText;
