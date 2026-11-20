"use client";
/** @registry name="file-drop" type="ui" title="File drop" description="Drop zone with type/size/count validation and FileItem rows with progress, retry and remove." */

import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "./button";
import { Tooltip } from "./tooltip";
import { Progress } from "./progress";

import { validateFiles, acceptHint, rejectionText, fileKind, uploadMeta, type FileRejection, type FileKind, type FileStatus } from "./file-drop-utils";

export { formatBytes, parseAccept, matchesAccept, validateFiles, acceptHint, rejectionText, fileKind, uploadMeta } from "./file-drop-utils";
export type { RejectReason, FileRejection, FileKind, FileStatus } from "./file-drop-utils";

/* ── Glyphs ── */

const S = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const Page = ({ children }: { children?: ReactNode }) => (
  <svg {...S}>
    <path d="M9 1.75H4.5a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.25L9 1.75z" />
    <path d="M9 1.75v3.5h3.5" />
    {children}
  </svg>
);
const KIND_ICON: Record<FileKind, ReactNode> = {
  file: <Page />,
  pdf: <Page><path d="M5.75 9.25h4.5M5.75 11.25h3" /></Page>,
  doc: <Page><path d="M5.75 7.75h4.5M5.75 9.75h4.5M5.75 11.75h2.5" /></Page>,
  sheet: <Page><path d="M5.5 8h5v4h-5zM5.5 10h5M8 8v4" /></Page>,
  code: <Page><path d="m6.75 8.25-1.5 1.5 1.5 1.5M9.25 8.25l1.5 1.5-1.5 1.5" /></Page>,
  archive: <Page><path d="M7.5 2v1.5M8.5 4v1.5M7.5 6v1.5M7.25 9.5h1.5v2h-1.5z" /></Page>,
  image: (
    <svg {...S}>
      <rect x="2" y="2.75" width="12" height="10.5" rx="1.75" />
      <circle cx="5.75" cy="6.25" r="1.1" />
      <path d="m2.5 11.5 3.25-3 2.5 2.25 2-1.75 3.25 2.75" />
    </svg>
  ),
  video: (
    <svg {...S}>
      <rect x="1.75" y="3.5" width="9" height="9" rx="1.75" />
      <path d="m10.75 7 3.5-2v6l-3.5-2" />
    </svg>
  ),
  audio: (
    <svg {...S}>
      <path d="M6 12V3.5l7-1.5V10.5" />
      <circle cx="4.25" cy="12" r="1.75" />
      <circle cx="11.25" cy="10.5" r="1.75" />
    </svg>
  ),
};
const UploadGlyph = () => (
  <svg {...S} strokeWidth={1.5}>
    <path d="M8 10.5V2.75M4.75 5.75 8 2.5l3.25 3.25" />
    <path d="M2.75 10v2.25a1.25 1.25 0 0 0 1.25 1.25h8a1.25 1.25 0 0 0 1.25-1.25V10" />
  </svg>
);

/* ── FileDrop ── */

export interface FileDropProps {
  /** Same syntax as <input accept>: ".pdf,image/*,application/json". */
  accept?: string;
  /** Bytes. */
  maxSize?: number;
  maxFiles?: number;
  /** Allow picking several files. Default true; false also caps a drop at one file. */
  multiple?: boolean;
  disabled?: boolean;
  /** Files that passed validation (never called with an empty list). */
  onFiles: (files: File[]) => void;
  onReject?: (rejections: FileRejection[]) => void;
  /** Main line. Default "Drop files here or browse". */
  label?: ReactNode;
  /** Second line. Default from accept / maxSize / maxFiles, e.g. "PDF, PNG up to 10 MB". */
  hint?: ReactNode;
  className?: string;
}

/**
 * Dashed drop zone that is also a button: click, Enter or Space opens the file picker.
 * Files are checked against accept / maxSize / maxFiles before they reach `onFiles`.
 */
export function FileDrop({
  accept,
  maxSize,
  maxFiles,
  multiple = true,
  disabled = false,
  onFiles,
  onReject,
  label,
  hint,
  className,
}: FileDropProps) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean; n: number } | null>(null);
  const hintId = useId();
  const limit = multiple ? maxFiles : 1;

  const take = (list: FileList | null) => {
    if (!list || disabled) return;
    const { accepted, rejected } = validateFiles([...list], { accept, maxSize, maxFiles: limit });
    if (accepted.length) onFiles(accepted);
    if (rejected.length) onReject?.(rejected);
    const added = accepted.length ? `Added ${accepted.length} ${accepted.length === 1 ? "file" : "files"}.` : "";
    // Name up to two skipped files; count the rest.
    const why = rejected.slice(0, 2).map((r) => rejectionText(r, { maxSize, maxFiles: limit }));
    const skipped = rejected.length ? `${why.join("; ")}${rejected.length > 2 ? `; and ${rejected.length - 2} more` : ""}.` : "";
    const text = [added, skipped].filter(Boolean).join(" ");
    if (text) setNote((p) => ({ text, error: rejected.length > 0, n: (p?.n ?? 0) + 1 }));
  };

  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes("Files");

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        onClick={() => input.current?.click()}
        // A counter, not a flag: dragenter/leave fire for every child, which would make the highlight flicker.
        onDragEnter={(e) => {
          if (disabled || !hasFiles(e)) return;
          e.preventDefault();
          depth.current++;
          setOver(true);
        }}
        onDragOver={(e) => {
          if (disabled || !hasFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          take(e.dataTransfer.files);
        }}
        className={cn(
          "group flex w-full cursor-pointer flex-col items-center gap-2.5 rounded-xl border border-dashed px-6 py-7 text-center",
          "transition-[background-color,border-color,box-shadow] duration-(--kn-dur) ease-(--kn-ease-out)",
          over
            ? "border-[color-mix(in_srgb,var(--ring)_80%,transparent)] bg-[color-mix(in_srgb,var(--ring)_7%,transparent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--ring)_12%,transparent)]"
            : "border-[color-mix(in_srgb,var(--foreground)_20%,transparent)] bg-[color-mix(in_srgb,var(--muted)_30%,transparent)] hover:border-[color-mix(in_srgb,var(--foreground)_32%,transparent)] hover:bg-[color-mix(in_srgb,var(--muted)_55%,transparent)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          focusRing,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-9 place-items-center rounded-[10px] bg-card text-muted-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_12%,transparent),0_1px_2px_rgb(0_0_0/0.05)] [&_svg]:size-4",
            "transition-[translate,color] duration-(--kn-dur-slow) ease-(--kn-ease-out) motion-reduce:transition-none",
            over ? "-translate-y-0.5 text-foreground" : "group-hover:text-foreground",
          )}
        >
          <UploadGlyph />
        </span>
        <span className="text-[13.5px] text-foreground">
          {label ?? (
            <>
              {over ? "Drop to add" : "Drop files here or"} {!over && <span className="font-medium underline decoration-[color-mix(in_srgb,var(--foreground)_30%,transparent)] underline-offset-[3px]">browse</span>}
            </>
          )}
        </span>
        <span id={hintId} className="text-[12px] text-muted-foreground">
          {hint ?? acceptHint(accept, maxSize, limit)}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = ""; // so picking the same file again still fires
        }}
      />
      <p aria-live="polite" className={cn("text-[12px]", !note && "-mt-2", note?.error ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
        {note && (
          <span key={note.n} className="animate-[kn-rise_var(--kn-dur)_var(--kn-ease-out)_both] motion-reduce:animate-none">
            {note.text}
          </span>
        )}
      </p>
    </div>
  );
}

/* ── FileItem ── */


export interface FileItemProps {
  name: string;
  /** Bytes. */
  size?: number;
  /** 0…100 while uploading. Missing means unknown (indeterminate bar). */
  progress?: number;
  status?: FileStatus;
  /** Shown when failed. Default "Upload failed". */
  error?: string;
  onRetry?: () => void;
  onRemove?: () => void;
  /** Replaces the kind icon guessed from the extension. */
  icon?: ReactNode;
  className?: string;
}

const RetryGlyph = () => (
  <svg {...S} strokeWidth={1.5}>
    <path d="M2.75 8a5.25 5.25 0 0 1 9.3-3.35M13.25 8a5.25 5.25 0 0 1-9.3 3.35" />
    <path d="M12.25 2.25v2.5h-2.5M3.75 13.75v-2.5h2.5" />
  </svg>
);
const RemoveGlyph = () => (
  <svg {...S} strokeWidth={1.5}>
    <path d="m4.5 4.5 7 7m0-7-7 7" />
  </svg>
);
const CheckGlyph = () => (
  <svg {...S} strokeWidth={1.8}>
    <path d="m4.25 8.25 2.5 2.5 5-5.5" />
  </svg>
);

/** One uploaded (or uploading) file: kind icon, name, progress, retry and remove. */
export function FileItem({ name, size, progress, status = "done", error, onRetry, onRemove, icon, className }: FileItemProps) {
  const failed = status === "failed";
  const meta = uploadMeta(size, progress, status);
  const announce = status === "done" ? `${name} uploaded` : failed ? `${name} failed to upload. ${error ?? ""}`.trim() : `Uploading ${name}`;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-start gap-3 rounded-xl bg-card p-3",
        "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_11%,transparent),0_1px_2px_rgb(0_0_0/0.04)]",
        "dark:bg-[color-mix(in_srgb,var(--muted)_35%,var(--card))]",
        failed && "shadow-[0_0_0_1px_rgb(239_68_68/0.28),0_1px_2px_rgb(0_0_0/0.04)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-9 flex-none place-items-center rounded-[10px] [&_svg]:size-4.5",
          failed ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground",
        )}
      >
        {icon ?? KIND_ICON[fileKind(name)]}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-px">
        <div className="truncate text-[13.5px] leading-5 font-medium text-foreground">{name}</div>
        <div className="flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-muted-foreground tabular-nums">
          {failed ? (
            <span className="truncate text-red-600 dark:text-red-400">{error ?? "Upload failed"}</span>
          ) : (
            <>
              {meta && <span className="flex-none">{meta}</span>}
              {status === "done" && (
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 [&_svg]:size-3.5">
                  {meta && <span aria-hidden className="text-muted-foreground">·</span>}
                  <CheckGlyph />
                  Uploaded
                </span>
              )}
            </>
          )}
        </div>
        {status === "uploading" && (
          <Progress
            aria-label={`Uploading ${name}`}
            value={progress}
            indeterminate={progress === undefined}
            size="sm"
            valueLabel="right"
            className="mt-1"
          />
        )}
      </div>

      <div className="-mt-0.5 -mr-1 flex flex-none items-center">
        {failed && onRetry && (
          <Tooltip content="Retry">
            <Button variant="ghost" size="sm" aria-label={`Retry ${name}`} icon={<RetryGlyph />} onClick={onRetry} />
          </Tooltip>
        )}
        {onRemove && (
          <Tooltip content={status === "uploading" ? "Cancel" : "Remove"}>
            <Button variant="ghost" size="sm" aria-label={`${status === "uploading" ? "Cancel" : "Remove"} ${name}`} icon={<RemoveGlyph />} onClick={onRemove} />
          </Tooltip>
        )}
      </div>

      {/* Status only (not every percent), so screen readers hear the moments that matter. */}
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

export default FileDrop;
