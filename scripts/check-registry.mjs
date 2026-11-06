#!/usr/bin/env node
// Copied from the private source by scripts/publish-free.mjs. The combined smoke page (step 4) uses items
// outside this repo, so it only runs with --smoke; every item is still installed and type-checked on its own.
/**
 * Proves the registry installs for real: every item, one at a time, into a fresh Next.js app.
 *
 *   bun run registry:check                     # all items
 *   bun run registry:check -- --only button,agent-graph
 *   bun run registry:check -- --app /tmp/my-app --keep   # reuse a base app, keep the temp dir
 *   bun run registry:check -- --build-each     # also `next build` after every item (slow)
 *   bun run registry:check -- --jobs 6         # parallel items (default 4)
 *   bun run registry:check -- --registry /path/proposal.json --only x   # check items not yet in registry.json
 *
 * 1. Copies registry.json with its https://ui.knowns.dev/r/ URLs pointed at a local server, builds it
 *    with `shadcn build` into a temp dir and serves it (production URLs in registry.json are untouched).
 * 2. Creates (or reuses) a Next.js 15 + React 19 + Tailwind v4 app in os.tmpdir() and runs `shadcn init`.
 * 3. For each item: a clean git worktree of that app (node_modules shared), `shadcn add <url>`, then checks
 *    for leftover "@/registry/…" imports, kn-* keyframes the files use but globals.css lacks, npm packages
 *    the files import but nobody installed, and `tsc --noEmit`.
 * 4. Installs everything together and adds a smoke page that is a SERVER component (no "use client"): it
 *    renders client components directly with static props (Button, Badge, Card, Tabs, AgentGraph with plain
 *    actors/spans, AgentMonitor with static steps, PageHeader), plus a small client island that drives
 *    AgentGraph + AgentLanes + Button from createAgentRun. Then `tsc --noEmit` and `next build`.
 *    Also checks statically that every installed .tsx calling React hooks starts with "use client".
 * Prints a pass/fail table; exits 1 if anything failed.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "https://ui.knowns.dev/r/";
const SHADCN = "shadcn@4";

/* ── Options ── */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const only = opt("only", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const jobs = Math.max(1, Number(opt("jobs", "4")) || 4);
const port = Number(opt("port", "0")) || 0;
const keep = flag("keep");
const buildEach = flag("build-each");
const appArg = opt("app", "");
/** Alternate registry.json (e.g. a proposal with items not merged yet). File paths inside stay relative to the repo root. */
const registryPath = path.resolve(opt("registry", path.join(ROOT, "registry.json")));

/* ── Helpers ── */

const log = (...a) => console.log(`[registry:check]`, ...a);
/** Runs a command; resolves { code, out } (stdout + stderr). Never throws. */
function run(cmd, args, cwd, { timeout = 600_000, env = {} } = {}) {
  return new Promise((resolve) => {
    // stdin closed: a prompt we didn't expect fails fast instead of hanging until the timeout.
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1", ...env }, shell: process.platform === "win32" });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, out });
    });
  });
}
const runSync = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, CI: "1" } });
const git = (cwd, ...args) => runSync("git", ["-c", "user.email=check@knowns", "-c", "user.name=check", ...args], cwd);
const short = (s, n = 160) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* ── 1. Local registry ── */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "knowns-registry-check-"));
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const items = registry.items.map((i) => i.name).filter((n) => !only.length || only.includes(n));
if (!items.length) {
  console.error("No items to check.");
  process.exit(2);
}

/**
 * Static pre-check, no install needed: every relative import in an item's files must resolve to a file the
 * item (or one of its registry dependencies) ships. Catches a new helper file nobody added to registry.json.
 */
const byName = new Map(registry.items.map((i) => [i.name, i]));
const depName = (d) => d.replace(/^.*\/r\//, "").replace(/\.json$/, "");
function unlisted(name) {
  const shipped = new Set();
  const seen = new Set();
  const walk = (n) => {
    const it = byName.get(n);
    if (!it || seen.has(n)) return;
    seen.add(n);
    for (const f of it.files ?? []) shipped.add(path.normalize(f.path));
    for (const d of it.registryDependencies ?? []) walk(depName(d));
  };
  walk(name);
  const missing = [];
  for (const f of byName.get(name).files ?? []) {
    if (!/\.(tsx?|jsx?)$/.test(f.path) || !fs.existsSync(path.join(ROOT, f.path))) continue;
    const src = fs.readFileSync(path.join(ROOT, f.path), "utf8");
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?\bfrom\s*["'](\.[^"']+)["']/gm)) {
      const target = path.normalize(path.join(path.dirname(f.path), m[1]));
      if (![".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"].some((ext) => shipped.has(target + ext))) missing.push(`${path.basename(f.path)} → ${m[1]}`);
    }
  }
  return missing;
}
const staticGaps = new Map(items.map((n) => [n, unlisted(n)]).filter(([, m]) => m.length));
for (const [n, m] of staticGaps) log(`registry.json: ${n} imports files it doesn't ship: ${m.join(", ")}`);

const server = http.createServer((req, res) => {
  const file = path.join(tmp, "r", path.basename(decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "content-type": "application/json" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(port, "127.0.0.1", r));
const base = `http://localhost:${server.address().port}/r/`;
const urlOf = (name) => `${base}${name}.json`;

log(`temp dir ${tmp}`);
const localJson = path.join(tmp, "registry.local.json");
fs.writeFileSync(localJson, JSON.stringify(registry).replaceAll(PROD, base));
{
  const b = await run("bunx", [SHADCN, "build", localJson, "-o", path.join(tmp, "r")], ROOT);
  if (b.code !== 0) {
    console.error(b.out);
    console.error("shadcn build failed");
    process.exit(1);
  }
  log(`built ${fs.readdirSync(path.join(tmp, "r")).length - 1} items, serving at ${base}`);
}

/* ── 2. Base app ── */

let app = appArg ? path.resolve(appArg) : path.join(tmp, "app");
if (!appArg || !fs.existsSync(path.join(app, "components.json"))) {
  log("creating a Next.js 15 app (this takes a minute)…");
  const created = await run(
    "npx",
    ["-y", "create-next-app@15", path.basename(app), "--ts", "--tailwind", "--app", "--no-src-dir", "--no-eslint", "--no-turbopack", "--import-alias", "@/*", "--use-npm", "--yes", "--skip-install"],
    path.dirname(app),
  );
  if (created.code !== 0) {
    console.error(created.out);
    process.exit(1);
  }
  // npm install can fail transiently: try a few times.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const inst = await run("npm", ["install", "--no-audit", "--no-fund"], app);
    if (inst.code === 0) break;
    if (attempt === 3) {
      console.error(inst.out);
      process.exit(1);
    }
    log(`npm install failed, retrying (${attempt})…`);
  }
  const init = await run("npx", ["-y", SHADCN, "init", "-y", "-d"], app);
  if (init.code !== 0) {
    console.error(init.out);
    process.exit(1);
  }
}
// The base state every item starts from: the app after `shadcn init`, committed. (create-next-app may have
// made its own repo with an earlier commit, so always commit what's there now.)
if (!fs.existsSync(path.join(app, ".git"))) git(app, "init", "-q");
const ignore = fs.existsSync(path.join(app, ".gitignore")) ? fs.readFileSync(path.join(app, ".gitignore"), "utf8") : "";
if (!/^\/?node_modules\/?$/m.test(ignore)) fs.appendFileSync(path.join(app, ".gitignore"), "\nnode_modules\n.next\nnext-env.d.ts\n");
git(app, "add", "-A");
if (git(app, "status", "--porcelain").stdout.trim()) git(app, "commit", "-qm", "base: shadcn init");
if (!fs.existsSync(path.join(app, "components.json"))) {
  console.error(`No components.json in ${app}: shadcn init did not run.`);
  process.exit(1);
}
const basePkg = JSON.parse(fs.readFileSync(path.join(app, "package.json"), "utf8"));
const installed = new Set([...Object.keys(basePkg.dependencies ?? {}), ...Object.keys(basePkg.devDependencies ?? {})]);

/* ── 3. Per item ── */

/** Files the install created or changed in a worktree. */
function changedFiles(dir) {
  const st = git(dir, "status", "--porcelain", "--untracked-files=all").stdout.trim();
  return st ? st.split("\n").map((l) => ({ status: l.slice(0, 2).trim(), file: l.slice(3) })) : [];
}

function inspect(dir, files) {
  const sources = files.filter((f) => /\.(tsx?|jsx?|mjs)$/.test(f.file)).map((f) => ({ file: f.file, text: fs.readFileSync(path.join(dir, f.file), "utf8") }));
  const leftover = sources.filter((s) => s.text.includes("@/registry/")).map((s) => s.file);
  const css = fs.existsSync(path.join(dir, "app/globals.css")) ? fs.readFileSync(path.join(dir, "app/globals.css"), "utf8") : "";
  const keyframes = new Set();
  for (const s of sources) for (const m of s.text.matchAll(/animate-\[(kn-[a-z-]+)|animation:\s*["'`]?(kn-[a-z-]+)/g)) keyframes.add(m[1] ?? m[2]);
  const missingCss = [...keyframes].filter((k) => !css.includes(`@keyframes ${k}`));
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const have = new Set([...installed, ...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
  const bare = new Set();
  // Real import / export statements and dynamic imports only (not "from" inside JSX text or strings).
  const IMPORT = /^\s*(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gm;
  const PKG = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(\/.*)?$/i;
  for (const s of sources)
    for (const m of s.text.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (spec.startsWith(".") || spec.startsWith("@/") || !PKG.test(spec)) continue;
      bare.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
    }
  const missingNpm = [...bare].filter((p) => !have.has(p) && !p.startsWith("node:"));
  // Next.js App Router: a .tsx that calls React hooks must be a client module, or a server page importing it fails.
  const noDirective = sources
    .filter((s) => s.file.endsWith(".tsx") && /\buse[A-Z]\w*\s*\(/.test(s.text) && !/^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*["']use client["']/.test(s.text))
    .map((s) => s.file);
  return { leftover, missingCss, missingNpm, noDirective };
}

/** TS2307 lines from tsc: imports that don't resolve. */
const unresolved = (out) => [...new Set([...out.matchAll(/Cannot find module '([^']+)'/g)].map((m) => m[1]))];
const firstErrors = (out) =>
  out
    .split("\n")
    .filter((l) => /error TS\d+/.test(l))
    .slice(0, 3)
    .map((l) => short(l.trim(), 200));

async function checkItem(name, slot) {
  const dir = path.join(tmp, `wt-${slot}`);
  if (!fs.existsSync(dir)) {
    git(app, "worktree", "add", "-q", "--detach", dir, "HEAD");
    fs.symlinkSync(path.join(app, "node_modules"), path.join(dir, "node_modules"), "dir");
  }
  git(dir, "reset", "-q", "--hard", "HEAD");
  git(dir, "clean", "-qfd", "-e", "node_modules");
  const t0 = Date.now();
  const add = await run("npx", ["-y", SHADCN, "add", urlOf(name), "-y", "-o"], dir, { timeout: 300_000 });
  const files = changedFiles(dir).filter((f) => f.file !== "node_modules");
  const r = { name, add: add.code === 0, files: files.filter((f) => f.status === "??").length, notes: [] };
  if (!r.add) r.notes.push(`add failed: ${short(add.out.split("\n").filter(Boolean).slice(-2).join(" "))}`);
  if (staticGaps.has(name)) r.notes.push(`not in registry.json files: ${staticGaps.get(name).join(", ")}`);
  const { leftover, missingCss, missingNpm, noDirective } = inspect(dir, files);
  if (noDirective.length) r.notes.push(`hooks without "use client": ${noDirective.map((f) => path.basename(f)).join(", ")}`);
  if (leftover.length) r.notes.push(`@/registry left in ${leftover.join(", ")}`);
  if (missingCss.length) r.notes.push(`missing keyframes ${missingCss.join(", ")}`);
  if (missingNpm.length) r.notes.push(`npm not installed: ${missingNpm.join(", ")}`);
  const tsc = await run("npx", ["tsc", "--noEmit", "-p", "."], dir, { timeout: 300_000 });
  r.tsc = tsc.code === 0;
  if (!r.tsc) {
    const miss = unresolved(tsc.out);
    if (miss.length) r.notes.push(`unresolved: ${miss.join(", ")}`);
    r.notes.push(...firstErrors(tsc.out));
  }
  if (buildEach && r.tsc) {
    const b = await run("npx", ["next", "build"], dir, { timeout: 600_000 });
    r.build = b.code === 0;
    if (!r.build) r.notes.push(`next build: ${short(b.out.split("\n").filter((l) => /error|Error/.test(l)).slice(0, 2).join(" "))}`);
  }
  r.ok = r.add && r.tsc && !staticGaps.has(name) && !leftover.length && !missingCss.length && !missingNpm.length && !noDirective.length && (r.build ?? true);
  r.secs = Math.round((Date.now() - t0) / 1000);
  log(`${r.ok ? "PASS" : "FAIL"} ${name} (${r.files} files, ${r.secs}s)`);
  return r;
}

const results = [];
{
  const queue = [...items];
  const slots = Math.min(buildEach ? 1 : jobs, queue.length);
  await Promise.all(
    Array.from({ length: slots }, async (_, slot) => {
      while (queue.length) results.push(await checkItem(queue.shift(), slot));
    }),
  );
}
results.sort((a, b) => items.indexOf(a.name) - items.indexOf(b.name));

/* ── 4. Everything together + smoke page + next build ── */

let combined = null;
if (flag("smoke")) {
  log("installing every item together, adding a smoke page, next build…");
  git(app, "reset", "-q", "--hard", "HEAD");
  git(app, "clean", "-qfd", "-e", "node_modules");
  const add = await run("npx", ["-y", SHADCN, "add", ...registry.items.map((i) => urlOf(i.name)), "-y", "-o"], app, { timeout: 600_000 });
  fs.mkdirSync(path.join(app, "app/smoke"), { recursive: true });
  fs.writeFileSync(path.join(app, "app/smoke/page.tsx"), SMOKE_SERVER_PAGE());
  fs.writeFileSync(path.join(app, "app/smoke/live.tsx"), SMOKE_LIVE());
  const tsc = await run("npx", ["tsc", "--noEmit", "-p", "."], app);
  const build = await run("npx", ["next", "build"], app, { timeout: 900_000 });
  combined = {
    add: add.code === 0,
    tsc: tsc.code === 0,
    build: build.code === 0,
    notes: [...(add.code ? [short(add.out.slice(-300))] : []), ...firstErrors(tsc.out), ...(build.code ? [short(build.out.split("\n").filter((l) => /rror/.test(l)).slice(0, 3).join(" "), 400)] : [])],
  };
}

/* ── Report ── */

const pad = (s, n) => String(s).padEnd(n);
console.log("\n" + [pad("item", 20), pad("add", 5), pad("files", 6), pad("tsc", 5), ...(buildEach ? [pad("build", 6)] : []), pad("result", 7), "notes"].join(" "));
for (const r of results)
  console.log(
    [pad(r.name, 20), pad(r.add ? "ok" : "FAIL", 5), pad(r.files, 6), pad(r.tsc ? "ok" : "FAIL", 5), ...(buildEach ? [pad(r.build === undefined ? "-" : r.build ? "ok" : "FAIL", 6)] : []), pad(r.ok ? "PASS" : "FAIL", 7), r.notes.join(" · ")].join(" "),
  );
if (combined) {
  console.log(`\nall items together: add ${combined.add ? "ok" : "FAIL"} · tsc ${combined.tsc ? "ok" : "FAIL"} · next build ${combined.build ? "ok" : "FAIL"}${combined.notes.length ? "\n  " + combined.notes.join("\n  ") : ""}`);
  console.log(`smoke page: ${path.join(app, "app/smoke/page.tsx")} (run \`npx next dev\` in ${app} and open /smoke)`);
}
const failed = results.filter((r) => !r.ok).length + (combined && !(combined.add && combined.tsc && combined.build) ? 1 : 0);
console.log(`\n${results.length - results.filter((r) => !r.ok).length}/${results.length} items pass${failed ? `, ${failed} failure(s)` : ""}.`);

server.close();
for (const d of fs.readdirSync(tmp).filter((d) => d.startsWith("wt-"))) git(app, "worktree", "remove", "--force", path.join(tmp, d));
if (!keep && !appArg) fs.rmSync(tmp, { recursive: true, force: true });
else log(`kept ${tmp}`);
process.exit(failed ? 1 : 0);

/* ── Smoke page ── */

/** A server component (no "use client"): imports client components and renders them with static props only. */
function SMOKE_SERVER_PAGE() {
  return `import { Button } from "@/components/ui/knowns/button";
import { Badge } from "@/components/ui/knowns/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/knowns/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/knowns/tabs";
import { AgentGraph } from "@/components/ui/knowns/agent-graph/agent-graph";
import { AgentMonitor } from "@/components/ui/knowns/agent-monitor/agent-monitor";
import { PageHeader } from "@/components/ui/knowns/blocks/page-header";
import type { Actor, Span } from "@/lib/knowns/types";
import Live from "./live";

const t0 = 1_700_000_000_000;
const actors: Actor[] = [
  { id: "you", type: "human", label: "You" },
  { id: "lead", type: "agent", label: "Orchestrator", model: "Opus 5.5", root: true },
  { id: "research", type: "agent", label: "Researcher", model: "Gemini 2.5 Pro" },
  { id: "slack", type: "tool", label: "Slack" },
];
const spans: Span[] = [
  { id: "s1", from: "you", to: "lead", startedAt: t0, endedAt: t0 + 900, outcome: "success" },
  { id: "s2", from: "lead", to: "research", startedAt: t0 + 100, endedAt: t0 + 700, outcome: "success" },
  { id: "s3", from: "research", to: "slack", startedAt: t0 + 200, endedAt: t0 + 500, outcome: "success" },
];

export default function SmokePage() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <PageHeader title="Knowns UI smoke test" status={{ label: "Live", tone: "success", dot: true }} tabs={[{ value: "overview", label: "Overview" }, { value: "runs", label: "Runs" }]} defaultTab="overview" condense={false} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Button>Server-rendered button</Button>
        <Badge tone="success">Badge</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Card</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="a">
            <TabsList aria-label="Smoke tabs">
              <TabsTrigger value="a">First</TabsTrigger>
              <TabsTrigger value="b">Second</TabsTrigger>
            </TabsList>
            <TabsContent value="a">First panel</TabsContent>
            <TabsContent value="b">Second panel</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <AgentGraph actors={actors} spans={spans} layout="center" clock={t0 + 1000} />
      <AgentMonitor
        state="running"
        agent={{ name: "Release agent", model: "Sonnet 5.5" }}
        steps={[
          { id: "1", label: "Read the changelog", tool: "GitHub", state: "done", took: 1200 },
          { id: "2", label: "Draft release notes", kind: "file", state: "running", since: t0 },
        ]}
        since={t0}
        now={t0 + 5000}
      />
      <Live />
    </main>
  );
}
`;
}

/** The client island: a run fed by events, driving AgentGraph + AgentLanes + Button. */
function SMOKE_LIVE() {
  return `"use client";
import { useEffect } from "react";
import { createAgentRun } from "@/lib/knowns/run";
import { AgentGraph } from "@/components/ui/knowns/agent-graph/agent-graph";
import { AgentLanes } from "@/components/ui/knowns/agent-lanes/agent-lanes";
import { Button } from "@/components/ui/knowns/button";

const run = createAgentRun();
let n = 0;

export default function Live() {
  useEffect(() => {
    run.emit([
      { type: "actor", actor: { id: "you", type: "human", label: "You" } },
      { type: "actor", actor: { id: "lead", type: "agent", label: "Orchestrator", model: "Opus 5.5", root: true } },
      { type: "actor", actor: { id: "research", type: "agent", label: "Researcher", model: "Gemini 2.5 Pro" } },
      { type: "actor", actor: { id: "slack", type: "tool", label: "Slack" } },
      { type: "link", from: "you", to: "lead" },
      { type: "link", from: "lead", to: "research" },
      { type: "task.start", id: "t1", actor: "research", title: "Collect pricing" },
    ]);
  }, []);
  const call = () => {
    const id = "s" + ++n;
    run.emit({ type: "span.start", id, from: "research", to: "slack", summary: "Search #pricing" });
    setTimeout(() => run.emit({ type: "span.end", id, outcome: "success" }), 600);
  };
  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h2 data-smoke="ready">Live run</h2>
      <Button onClick={call}>Call Slack</Button>
      <AgentGraph run={run} layout="center" />
      <AgentLanes run={run} />
    </main>
  );
}
`;
}
