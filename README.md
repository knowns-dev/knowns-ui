<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-white.png">
  <img alt="Knowns UI" src=".github/assets/logo-black.png" width="64" height="64">
</picture>

# Knowns UI

React components for products built on AI agents.<br>
Live views of what your agents are doing, chat building blocks, and the everyday components around them.

<a href="LICENSE"><img alt="license: MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
<a href="https://ui.shadcn.com/docs/registry"><img alt="shadcn: registry" src="https://img.shields.io/badge/shadcn-registry-black"></a>
<a href="https://ui.knowns.dev/docs/introduction"><img alt="components: 52" src="https://img.shields.io/badge/components-52-6366f1"></a>

[Docs](https://ui.knowns.dev/docs/introduction) · [Components](https://ui.knowns.dev/docs/group/components) · [Pro](https://ui.knowns.dev/pricing)

</div>

## Why Knowns UI

- **One run store, every view.** Feed agent events into one run; the graph, lanes, traces, approvals and chat all read it and stay in sync.
- **You own the source.** It is a [shadcn registry](https://ui.shadcn.com/docs/registry), not a package: the CLI copies each component into your project. Tailwind CSS v4 and the shadcn/ui theme tokens.
- **AI-ready.** An MCP server and plain-text docs let Claude Code, Cursor and VS Code find, read and install components for you.

## Quick example

```tsx
import { createAgentRun } from "@/lib/knowns/run";
import { AgentGraph } from "@/components/ui/knowns/agent-graph/agent-graph";

const run = createAgentRun();
run.emit({ type: "actor", actor: { id: "lead", type: "agent", label: "Orchestrator", root: true } });
run.emit({ type: "actor", actor: { id: "web", type: "tool", label: "Web search" } });
run.emit({ type: "span.start", id: "s1", from: "lead", to: "web", summary: "pricing linear.app" });

export default function Run() {
  return <AgentGraph run={run} />;
}
```

Events can come from your own code, a replay, or an adapter for your agent SDK. Every view takes `run={run}`.

## Install

Requires React 19, Tailwind CSS v4 and a shadcn `components.json` (run `npx shadcn@latest init` if you have none).

```bash
npx shadcn@latest add https://ui.knowns.dev/r/agent-graph.json
```

Once Knowns UI is listed in the shadcn registry index you can also use the namespace:

```bash
npx shadcn@latest add @knowns-ui/agent-graph
```

Registry dependencies (the core types, the run store, icons) come along automatically.

## Components (52)

| Component | Install |
| --- | --- |
| [Accordion](https://ui.knowns.dev/docs/accordion) | `https://ui.knowns.dev/r/accordion.json` |
| [Agent Cursors](https://ui.knowns.dev/docs/agent-cursors) | `https://ui.knowns.dev/r/agent-cursors.json` |
| [Agent Fleet](https://ui.knowns.dev/docs/agent-fleet) | `https://ui.knowns.dev/r/agent-fleet.json` |
| [Agent Graph](https://ui.knowns.dev/docs/agent-graph) | `https://ui.knowns.dev/r/agent-graph.json` |
| [Agent Handoff](https://ui.knowns.dev/docs/agent-handoff) | `https://ui.knowns.dev/r/agent-handoff.json` |
| [Agent Lanes](https://ui.knowns.dev/docs/agent-lanes) | `https://ui.knowns.dev/r/agent-lanes.json` |
| [Agent Monitor](https://ui.knowns.dev/docs/agent-monitor) | `https://ui.knowns.dev/r/agent-monitor.json` |
| [AI Answer](https://ui.knowns.dev/docs/ai-answer) | `https://ui.knowns.dev/r/ai-answer.json` |
| [Approval Prompt](https://ui.knowns.dev/docs/approval-prompt) | `https://ui.knowns.dev/r/approval-prompt.json` |
| [Avatar](https://ui.knowns.dev/docs/avatar) | `https://ui.knowns.dev/r/avatar.json` |
| [Badge](https://ui.knowns.dev/docs/badge) | `https://ui.knowns.dev/r/badge.json` |
| [Breadcrumb](https://ui.knowns.dev/docs/breadcrumb) | `https://ui.knowns.dev/r/breadcrumb.json` |
| [Button](https://ui.knowns.dev/docs/button) | `https://ui.knowns.dev/r/button.json` |
| [Card](https://ui.knowns.dev/docs/card) | `https://ui.knowns.dev/r/card.json` |
| [Chat Composer](https://ui.knowns.dev/docs/chat-composer) | `https://ui.knowns.dev/r/chat-composer.json` |
| [Checkbox](https://ui.knowns.dev/docs/checkbox) | `https://ui.knowns.dev/r/checkbox.json` |
| [Combobox](https://ui.knowns.dev/docs/combobox) | `https://ui.knowns.dev/r/combobox.json` |
| [Command Menu](https://ui.knowns.dev/docs/command-menu) | `https://ui.knowns.dev/r/command-menu.json` |
| [Context Window](https://ui.knowns.dev/docs/context-window) | `https://ui.knowns.dev/r/context-window.json` |
| [Data Table](https://ui.knowns.dev/docs/data-table) | `https://ui.knowns.dev/r/data-table.json` |
| [Date Range Picker](https://ui.knowns.dev/docs/date-range-picker) | `https://ui.knowns.dev/r/date-range-picker.json` |
| [Dialog](https://ui.knowns.dev/docs/dialog) | `https://ui.knowns.dev/r/dialog.json` |
| [Dot Spotlight](https://ui.knowns.dev/docs/dot-spotlight) | `https://ui.knowns.dev/r/dot-spotlight.json` |
| [Dropdown](https://ui.knowns.dev/docs/dropdown) | `https://ui.knowns.dev/r/dropdown.json` |
| [Empty States](https://ui.knowns.dev/docs/empty-states) | `https://ui.knowns.dev/r/empty-states.json` |
| [File Drop](https://ui.knowns.dev/docs/file-drop) | `https://ui.knowns.dev/r/file-drop.json` |
| [Input](https://ui.knowns.dev/docs/input) | `https://ui.knowns.dev/r/input.json` |
| [Kbd](https://ui.knowns.dev/docs/kbd) | `https://ui.knowns.dev/r/kbd.json` |
| [Menu](https://ui.knowns.dev/docs/menu) | `https://ui.knowns.dev/r/menu.json` |
| [OTP Input](https://ui.knowns.dev/docs/otp-input) | `https://ui.knowns.dev/r/otp-input.json` |
| [Pagination](https://ui.knowns.dev/docs/pagination) | `https://ui.knowns.dev/r/pagination.json` |
| [Popover](https://ui.knowns.dev/docs/popover) | `https://ui.knowns.dev/r/popover.json` |
| [Progress](https://ui.knowns.dev/docs/progress) | `https://ui.knowns.dev/r/progress.json` |
| [Radio Group](https://ui.knowns.dev/docs/radio-group) | `https://ui.knowns.dev/r/radio-group.json` |
| [Segmented Control](https://ui.knowns.dev/docs/segmented-control) | `https://ui.knowns.dev/r/segmented-control.json` |
| [Select](https://ui.knowns.dev/docs/select) | `https://ui.knowns.dev/r/select.json` |
| [Separator](https://ui.knowns.dev/docs/separator) | `https://ui.knowns.dev/r/separator.json` |
| [Shimmer Text](https://ui.knowns.dev/docs/shimmer-text) | `https://ui.knowns.dev/r/shimmer-text.json` |
| [Skeleton](https://ui.knowns.dev/docs/skeleton) | `https://ui.knowns.dev/r/skeleton.json` |
| [Slider](https://ui.knowns.dev/docs/slider) | `https://ui.knowns.dev/r/slider.json` |
| [Spinner](https://ui.knowns.dev/docs/spinner) | `https://ui.knowns.dev/r/spinner.json` |
| [Status Dot](https://ui.knowns.dev/docs/status-dot) | `https://ui.knowns.dev/r/status-dot.json` |
| [Stepper](https://ui.knowns.dev/docs/stepper) | `https://ui.knowns.dev/r/stepper.json` |
| [Switch](https://ui.knowns.dev/docs/switch) | `https://ui.knowns.dev/r/switch.json` |
| [Tabs](https://ui.knowns.dev/docs/tabs) | `https://ui.knowns.dev/r/tabs.json` |
| [Tag](https://ui.knowns.dev/docs/tag) | `https://ui.knowns.dev/r/tag.json` |
| [Thinking State](https://ui.knowns.dev/docs/thinking-state) | `https://ui.knowns.dev/r/thinking-state.json` |
| [Toast](https://ui.knowns.dev/docs/toast) | `https://ui.knowns.dev/r/toast.json` |
| [Toggle Group](https://ui.knowns.dev/docs/toggle-group) | `https://ui.knowns.dev/r/toggle-group.json` |
| [Tool Call Card](https://ui.knowns.dev/docs/tool-call-card) | `https://ui.knowns.dev/r/tool-call-card.json` |
| [Tooltip](https://ui.knowns.dev/docs/tooltip) | `https://ui.knowns.dev/r/tooltip.json` |
| [Trace Waterfall](https://ui.knowns.dev/docs/trace-waterfall) | `https://ui.knowns.dev/r/trace-waterfall.json` |

Shared code installed with them: `knowns-core`, `knowns-icons`, `knowns-floating`, `illustrations-core`, `text-animation-core`, `backgrounds-core`.

## Pro

[Knowns UI Pro](https://ui.knowns.dev/pricing) adds, on the same run store:

- **Blocks:** an Agent Ops dashboard, a Chat App screen, a Kanban board, the Agent Globe, page headers, task detail and pricing sections.
- **SDK adapters:** turn the Claude Agent SDK, the Vercel AI SDK or the OpenAI Agents SDK stream into run events, server to browser.
- **More motion:** animated illustrations, backgrounds and text animations.
- **Semantic docs search** in the MCP server, and Pro updates for life.

## Using with AI

Connect your coding agent to the Knowns UI MCP server (`https://ui.knowns.dev/mcp`), point it at one component's JSON (`https://ui.knowns.dev/r/<name>.json`), or give it the docs as text (`https://ui.knowns.dev/llms.txt`). Setup for Claude Code, Cursor, VS Code and Codex: https://ui.knowns.dev/docs/ai-and-mcp

## Develop

```bash
npm run build   # shadcn build: registry.json to public/r
npm run check   # installs every item into a fresh Next.js app and type-checks it
```

## License

MIT. See [LICENSE](LICENSE). Third-party logos in `registry/knowns/lib/knowns/icons` keep their own terms; see the LICENSES.md there.
