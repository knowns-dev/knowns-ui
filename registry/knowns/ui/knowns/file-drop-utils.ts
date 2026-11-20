/** @registry part-of="file-drop" */
/** Pure logic of the file drop: byte sizes, the accept list, validation against type, size and count, and the file kind for an icon. */

/** "820 B", "14 KB", "2.4 MB". Empty for a missing or negative size. */
export function formatBytes(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n < 10 ? n.toFixed(1).replace(/\.0$/, "") : Math.round(n)} ${units[u]}`;
}

type FileLike = { name: string; size: number; type: string };

/** Split an `accept` string (".pdf, image/*, application/json") into lowercase tokens. */
export function parseAccept(accept?: string): string[] {
  return (accept ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether a file matches `accept`, the way <input type="file"> reads it: extensions, exact types and "type/*". */
export function matchesAccept(file: Pick<FileLike, "name" | "type">, accept?: string): boolean {
  const tokens = parseAccept(accept);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return tokens.some((t) => {
    if (t.startsWith(".")) return name.endsWith(t);
    if (t.endsWith("/*")) return type.startsWith(t.slice(0, -1));
    return type === t;
  });
}

export type RejectReason = "type" | "size" | "count";
export interface FileRejection<F = File> {
  file: F;
  reason: RejectReason;
}

/**
 * Sort files into accepted and rejected. Checks type, then size, then count: once `maxFiles`
 * accepted files are reached, the rest are rejected with "count".
 */
export function validateFiles<F extends FileLike>(
  files: F[],
  { accept, maxSize, maxFiles }: { accept?: string; maxSize?: number; maxFiles?: number } = {},
): { accepted: F[]; rejected: FileRejection<F>[] } {
  const accepted: F[] = [];
  const rejected: FileRejection<F>[] = [];
  for (const file of files) {
    if (!matchesAccept(file, accept)) rejected.push({ file, reason: "type" });
    else if (maxSize !== undefined && file.size > maxSize) rejected.push({ file, reason: "size" });
    else if (maxFiles !== undefined && accepted.length >= maxFiles) rejected.push({ file, reason: "count" });
    else accepted.push(file);
  }
  return { accepted, rejected };
}

const FAMILY: Record<string, string> = { "image/*": "Images", "video/*": "Videos", "audio/*": "Audio", "text/*": "Text files" };

/** Human hint from the constraints: "PDF, PNG up to 10 MB", "Images up to 5 MB, 3 files max", "Any file". */
export function acceptHint(accept?: string, maxSize?: number, maxFiles?: number): string {
  const kinds = [
    ...new Set(
      parseAccept(accept).map((t) => {
        if (FAMILY[t]) return FAMILY[t];
        if (t.startsWith(".")) return t.slice(1).toUpperCase();
        const sub = t.split("/")[1] ?? t;
        return sub === "*" ? t.toUpperCase() : sub.replace(/^(x-|vnd\.)/, "").toUpperCase();
      }),
    ),
  ];
  let s = kinds.length ? kinds.join(", ") : "Any file";
  if (maxSize !== undefined) s += ` up to ${formatBytes(maxSize)}`;
  if (maxFiles !== undefined) s += `, ${maxFiles} ${maxFiles === 1 ? "file" : "files"} max`;
  return s;
}

/** Short sentence for a rejection, for the inline message and the live region. */
export function rejectionText(r: FileRejection<Pick<FileLike, "name">>, opts: { maxSize?: number; maxFiles?: number } = {}): string {
  if (r.reason === "type") return `${r.file.name} isn't an accepted type`;
  if (r.reason === "size") return `${r.file.name} is over ${formatBytes(opts.maxSize)}`;
  return `${r.file.name} is over the ${opts.maxFiles ?? ""} file limit`.replace("  ", " ");
}

export type FileKind = "image" | "video" | "audio" | "pdf" | "archive" | "code" | "sheet" | "doc" | "file";

const EXT: [FileKind, RegExp][] = [
  ["image", /^(png|jpe?g|gif|webp|avif|svg|heic|bmp|ico|tiff?)$/],
  ["video", /^(mp4|mov|webm|mkv|avi|m4v)$/],
  ["audio", /^(mp3|wav|m4a|flac|ogg|aac|opus)$/],
  ["pdf", /^pdf$/],
  ["archive", /^(zip|tar|gz|tgz|rar|7z|bz2|xz)$/],
  ["code", /^(js|jsx|ts|tsx|json|py|rb|go|rs|java|c|cpp|h|cs|php|swift|kt|sh|ya?ml|toml|html|css|sql)$/],
  ["sheet", /^(csv|tsv|xlsx?|numbers|ods)$/],
  ["doc", /^(docx?|txt|md|rtf|pages|odt|pptx?|key)$/],
];

/** Kind of file from its extension, for the icon. */
export function fileKind(name: string): FileKind {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  if (!m) return "file";
  const ext = (m[1] ?? "").toLowerCase();
  return EXT.find(([, re]) => re.test(ext))?.[0] ?? "file";
}

export type FileStatus = "uploading" | "done" | "failed";

/** "1.2 MB of 4 MB" while uploading; the size alone otherwise. */
export function uploadMeta(size: number | undefined, progress: number | undefined, status: FileStatus): string {
  if (status !== "uploading" || size === undefined) return formatBytes(size);
  if (progress === undefined) return `${formatBytes(size)}`;
  const done = (Math.min(100, Math.max(0, progress)) / 100) * size;
  return `${formatBytes(done)} of ${formatBytes(size)}`;
}
