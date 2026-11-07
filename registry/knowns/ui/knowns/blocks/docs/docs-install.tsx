"use client";
/** @registry name="docs-install" type="block" title="Docs install" description="Installation with CLI and Manual tabs: a shadcn add command per package manager, and numbered manual steps (dependencies, registry items, each file with its target) on a rail with callouts." */
/**
 * Docs installation: CLI | Manual tabs. CLI is a shadcn add command with a package manager switch;
 * Manual walks through numbered steps on a rail: dependencies, registry items to add first, then each
 * file to copy with its target path. Also exports the pieces (DocsSteps, DocsStep, DocsCallout,
 * CommandBlock) for any step-by-step guide.
 */
import { useEffect, useState, type ReactNode } from "react";
import { cn, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../tabs";
import { installDeps, PACKAGE_MANAGERS, shadcnAdd, type ManualPlan, type PackageManager } from "./docs-utils";

type RenderCode = (code: string, lang: string) => ReactNode;

function useCopied() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1400);
    return () => clearTimeout(t);
  }, [done]);
  const copy = async (text: string) => {
    try {
      await writeClipboard(text);
      setDone(true);
    } catch {}
  };
  return [done, copy] as const;
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, copy] = useCopied();
  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      className="h-6 shrink-0 rounded-md px-2 text-[11.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}

/* ── Steps ── */

/** Numbered steps on a vertical rail. */
export function DocsSteps({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn("grid [counter-reset:kn-step]", className)}>{children}</ol>;
}

export function DocsStep({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <li className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-4 pb-6 [counter-increment:kn-step] last:pb-0">
      {/* The rail: a number disc, then a line down to the next step. */}
      <span aria-hidden="true" className="relative row-span-2 flex justify-center">
        <span className="z-[1] grid size-7 place-items-center rounded-full border bg-card font-mono text-[12px] font-medium tabular-nums before:content-[counter(kn-step)]" />
        <span className="absolute top-8 bottom-[-20px] w-px bg-border [li:last-child_&]:hidden" />
      </span>
      <div className="min-h-7 pt-1 text-[14px] font-medium">{title}</div>
      {children && <div className="mt-2.5 grid min-w-0 gap-3 text-[13.5px] leading-relaxed text-muted-foreground">{children}</div>}
    </li>
  );
}

export type CalloutTone = "info" | "warning";

/** A short note inside a step: "The CLI may ask to overwrite globals.css". */
export function DocsCallout({ tone = "info", title, children }: { tone?: CalloutTone; title?: ReactNode; children: ReactNode }) {
  return (
    <div
      role="note"
      className={cn(
        "flex gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed",
        tone === "warning" ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-900 dark:text-amber-200" : "bg-muted/40 text-muted-foreground",
      )}
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="mt-0.5 size-4 flex-none">
        {tone === "warning" ? (
          <path d="M8 2.5 14 13H2L8 2.5ZM8 6.5v3M8 11.25v.01" />
        ) : (
          <>
            <circle cx="8" cy="8" r="5.75" />
            <path d="M8 7.25V11M8 5v.01" />
          </>
        )}
      </svg>
      <div className="min-w-0">
        {title && <div className="font-medium text-foreground">{title}</div>}
        {children}
      </div>
    </div>
  );
}

/* ── Commands ── */

/** One command per package manager with a switch and a copy button. Pass `value` to share the choice. */
export function CommandBlock({
  commands,
  value,
  onValueChange,
  renderCode,
  wrap = false,
}: {
  commands: Partial<Record<PackageManager, string>>;
  value?: PackageManager;
  onValueChange?: (pm: PackageManager) => void;
  renderCode?: RenderCode;
  /** Wrap a long command onto more lines instead of scrolling. The copied text stays one line. */
  wrap?: boolean;
}) {
  const pms = PACKAGE_MANAGERS.filter((p) => commands[p]);
  const [own, setOwn] = useState<PackageManager>(pms[0] ?? "npm");
  const pm = value && commands[value] ? value : own;
  const cmd = commands[pm] ?? "";
  // Wrapped commands break only at spaces: a word joiner after each hyphen (display only; Copy uses `cmd`).
  const shown = wrap ? cmd.replace(/-/g, "-\u2060") : cmd;
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border bg-card" data-lang="bash">
      <div data-md="skip" className="flex items-center justify-between gap-2 border-b px-2 py-1.5">
        {pms.length > 1 ? (
          <div role="radiogroup" aria-label="Package manager" className="flex gap-0.5">
            {pms.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={pm === p}
                onClick={() => (setOwn(p), onValueChange?.(p))}
                className="rounded-md px-2 py-0.5 font-mono text-[11.5px] text-muted-foreground hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring aria-checked:bg-muted aria-checked:text-foreground"
              >
                {p}
              </button>
            ))}
          </div>
        ) : (
          <span className="px-1 font-mono text-[11.5px] text-muted-foreground">Terminal</span>
        )}
        <CopyBtn text={cmd} />
      </div>
      <div tabIndex={0} role="group" aria-label="Command" className={cn("flex items-baseline gap-2 overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", wrap && "[&_code]:whitespace-pre-wrap! [&_pre]:whitespace-pre-wrap! [&_code]:[overflow-wrap:normal] [&_pre]:[overflow-wrap:normal] [&_code]:[word-break:normal] [&_pre]:[word-break:normal]")}>
        <span aria-hidden="true" className="text-muted-foreground select-none">
          $
        </span>
        {renderCode ? <div className="min-w-0">{renderCode(shown, "bash")}</div> : <code className="whitespace-pre text-foreground">{shown}</code>}
      </div>
    </div>
  );
}

/** A file to copy: its target path, a copy button and the code (folded past ~16 lines). */
export function FileBlock({ target, code, lang, renderCode }: { target: string; code: string; lang: string; renderCode?: RenderCode }) {
  const long = code.split("\n").length > 16;
  const [open, setOpen] = useState(!long);
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border bg-card" data-lang={lang}>
      <div data-md="skip" className="flex h-9 items-center justify-between gap-2 border-b bg-muted/30 pr-2 pl-3.5">
        <span className="truncate font-mono text-[11.5px] text-foreground">{target}</span>
        <CopyBtn text={code} />
      </div>
      <div className={cn("relative text-[12.5px]", !open && "max-h-[260px] overflow-hidden")}>
        {renderCode ? (
          renderCode(code, lang)
        ) : (
          <pre tabIndex={0} className="overflow-x-auto p-4 font-mono leading-relaxed text-foreground">
            <code>{code}</code>
          </pre>
        )}
        {!open && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />}
      </div>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="w-full border-t py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          {open ? "Collapse" : `Show all ${code.split("\n").length} lines`}
        </button>
      )}
    </div>
  );
}

/** A prompt to copy into a coding agent: wrapped text, folded past ~14 lines, one Copy button. */
export function PromptBlock({ label = "Prompt", text }: { label?: string; text: string }) {
  const lines = text.split("\n").length;
  const long = lines > 14;
  const [open, setOpen] = useState(!long);
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border bg-card" data-lang="md">
      <div data-md="skip" className="flex h-9 items-center justify-between gap-2 border-b bg-muted/30 pr-2 pl-3.5">
        <span className="truncate text-[12px] text-muted-foreground">{label}</span>
        <CopyBtn text={text} label="Copy prompt" />
      </div>
      <div className={cn("relative", !open && "max-h-[280px] overflow-hidden")}>
        <pre tabIndex={0} className="p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
          {text}
        </pre>
        {!open && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />}
      </div>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="w-full border-t py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          {open ? "Collapse" : `Show all ${lines} lines`}
        </button>
      )}
    </div>
  );
}

/* ── Install ── */

export interface DocsInstallProps {
  /** shadcn add targets (registry URLs or namespaced names). */
  targets: string[];
  /** The manual plan, or a loader called when the Manual tab first opens. Without it there is no Manual tab. */
  manual?: ManualPlan | (() => Promise<ManualPlan>);
  /** Shared package manager choice. */
  packageManager?: PackageManager;
  onPackageManagerChange?: (pm: PackageManager) => void;
  /** Notes after the CLI command, e.g. callouts. */
  cliNotes?: ReactNode;
  /** Notes at the end of the manual steps (e.g. "Update the import paths"). */
  manualNotes?: ReactNode;
  /** Replaces both tabs (e.g. a locked state for paid items). */
  locked?: ReactNode;
  /** Under the tabs, e.g. "Needs the Pro registry". */
  footer?: ReactNode;
  renderCode?: RenderCode;
  /** Wrap the CLI command instead of scrolling it (long multi-item installs). */
  wrapCommand?: boolean;
  /** More tabs after CLI | Manual (e.g. "With AI"). Kept mounted, so the page's text includes them. */
  extraTabs?: { value: string; label: string; content: ReactNode }[];
  className?: string;
}

function Manual({ plan, pm, onPm, renderCode, notes }: { plan: ManualPlan; pm?: PackageManager; onPm?: (p: PackageManager) => void; renderCode?: RenderCode; notes?: ReactNode }) {
  const depCmds = Object.fromEntries(PACKAGE_MANAGERS.map((p) => [p, installDeps(p, plan.dependencies)])) as Record<PackageManager, string>;
  const regCmds = Object.fromEntries(PACKAGE_MANAGERS.map((p) => [p, shadcnAdd(p, plan.registryDependencies)])) as Record<PackageManager, string>;
  return (
    <DocsSteps>
      {plan.dependencies.length > 0 && (
        <DocsStep title="Install the dependencies">
          <CommandBlock commands={depCmds} value={pm} onValueChange={onPm} renderCode={renderCode} />
        </DocsStep>
      )}
      {plan.registryDependencies.length > 0 && (
        <DocsStep title="Add the components it builds on">
          <CommandBlock commands={regCmds} value={pm} onValueChange={onPm} renderCode={renderCode} />
        </DocsStep>
      )}
      {plan.files.map((f) => (
        <DocsStep key={f.target} title={<>Copy <code className="rounded bg-muted px-1 py-px font-mono text-[12.5px]">{f.target.split("/").pop()}</code></>}>
          <FileBlock target={f.target} code={f.code} lang={f.lang} renderCode={renderCode} />
        </DocsStep>
      ))}
      <DocsStep title="Check the import paths">{notes ?? <p>The files import each other with the @/ alias. Change it if your project uses another one.</p>}</DocsStep>
    </DocsSteps>
  );
}

export function DocsInstall({ targets, manual, packageManager, onPackageManagerChange, cliNotes, manualNotes, locked, footer, renderCode, extraTabs, wrapCommand, className }: DocsInstallProps) {
  const [tab, setTab] = useState("cli");
  const [plan, setPlan] = useState<ManualPlan | null>(typeof manual === "object" ? manual : null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (tab !== "manual" || plan || typeof manual !== "function") return;
    let live = true;
    setError(false);
    manual().then(
      (p) => live && setPlan(p),
      () => live && setError(true),
    );
    return () => {
      live = false;
    };
  }, [tab, plan, manual]);
  useEffect(() => {
    if (typeof manual === "object") setPlan(manual);
  }, [manual]);

  if (locked) return <div className={className}>{locked}</div>;
  const cmds = Object.fromEntries(PACKAGE_MANAGERS.map((p) => [p, shadcnAdd(p, targets)])) as Record<PackageManager, string>;
  const cli = (
    <div className="grid gap-3">
      <CommandBlock commands={cmds} value={packageManager} onValueChange={onPackageManagerChange} renderCode={renderCode} wrap={wrapCommand} />
      {cliNotes}
    </div>
  );
  return (
    <div className={cn("grid min-w-0 gap-3", className)}>
      {manual || extraTabs?.length ? (
        <Tabs value={tab} onValueChange={setTab} size="sm">
          <TabsList aria-label="Install with">
            <TabsTrigger value="cli">CLI</TabsTrigger>
            {manual && <TabsTrigger value="manual">Manual</TabsTrigger>}
            {extraTabs?.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="cli">{cli}</TabsContent>
          {extraTabs?.map((t) => (
            <TabsContent key={t.value} value={t.value} keepMounted>
              {t.content}
            </TabsContent>
          ))}
          {manual && <TabsContent value="manual">
            {plan ? (
              <Manual plan={plan} pm={packageManager} onPm={onPackageManagerChange} renderCode={renderCode} notes={manualNotes} />
            ) : error ? (
              <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
                Could not load the files. Use the CLI, or try again later.
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground" aria-busy="true">
                Loading the files…
              </p>
            )}
          </TabsContent>}
        </Tabs>
      ) : (
        cli
      )}
      {footer}
    </div>
  );
}
