# Changelog

Free changes in full. Pro changes are listed by title; see https://ui.knowns.dev/changelog for them.

## 0.9.0 (2026-11-07) - Early access

The first public version. Free covers the base components, agent views, chat, backgrounds, text animation and page blocks; Pro adds review and eval components, dashboards, maps and the SDK adapters. Everything installs as source with the shadcn CLI.

### Breaking

- **Hero is Free; its split, product and statement layouts are Pro items** `hero`
  HeroCentered, including align="start", is Free.

  Migration: Import HeroSplit, HeroProduct and HeroStatement from blocks/marketing/hero-split, hero-product and hero-statement instead of hero, and install them as @knowns-ui-pro/hero-split and so on.

### Added

- **Agent views** `agent-graph`, `agent-lanes`, `trace-waterfall`, `context-window`, `tool-call-card`, `approval-prompt`, `agent-plan`, `agent-monitor`, `agent-fleet`, `agent-handoff`, `agent-cursors`
  Views for showing what an agent does: its graph and lanes, a trace waterfall, the context window, tool calls, approvals, plans, and monitors for one agent or a fleet.
- **Backgrounds and text animation** `dot-spotlight`, `signal-lines`, `aurora`, `node-field`, `perspective-grid`, `grid-pattern`, `dither-field`, `flickering-grid`, `cube-field`, `token-stream`, `shimmer-text`, `decode-text`, `word-rotate`, `number-ticker`, `typewriter`
  Canvas and CSS backgrounds that keep clear of your content, and text effects for streaming tokens, shimmer, decode, rotating words, counters and typing. All of them hold still with reduced motion.
- **Base components** `button`, `dropdown`, `menu`, `segmented-control`, `theme-toggle`, `toggle-group`, `user-menu`, `input`, `select`, `combobox`, `checkbox`, `radio-group`, `switch`, `slider`, `file-drop`, `date-picker`, `date-range-picker`, `otp-input`, `password-field`, `password-strength`, `dialog`, `command-menu`, `popover`, `tooltip`, `toast`, `tabs`, `stepper`, `breadcrumb`, `pagination`, `avatar`, `data-table`, `badge`, `tag`, `card`, `kbd`, `separator`, `progress`, `accordion`, `skeleton`, `spinner`, `status-dot`, `shine-border`, `custom-cursor`, `parallax-card`
  Actions, forms, overlays, navigation, data display, feedback and a few effects: the building blocks the agent views are made of, each with a docs page, live examples and props.
- **Changelog and RSS feed**
  A changelog page at ui.knowns.dev/changelog with every release, Free and Pro, and an RSS feed.
- **Chat components** `ai-answer`, `message-actions`, `chat-composer`, `ghost-text`, `thinking-state`
  An answer with sources, message actions, a composer with attachments and commands, inline ghost-text suggestions, and a thinking state.
- **Docs, install guides and theming** `introduction`, `installation`, `installing-pro`, `ai-and-mcp`, `theming`
  Install any component with the shadcn CLI, set up the Pro registry with a license key, theme everything from a few CSS variables, and point an AI assistant at the docs through MCP.
- **Illustrations** `run-pulse`, `tool-beam`, `prompt-to-team`, `model-reel`, `model-orbit`, `empty-states`
  Animated scenes for landing pages and empty states: a run pulse, tool beams, a prompt handed to a team, model reels and orbits.
- **Page blocks** `auth-card`, `settings-layout`, `site-header`, `site-footer`, `announcement-bar`, `sidebar`, `app-shell`, `error-pages`, `hero`, `logo-cloud`, `feature-grid`, `stats-band`, `cta-section`, `faq-section`, `newsletter`, `contact-section`, `blog-grid`, `blog-post`, `changelog-feed`, `search-results`, `catalog-grid`
  Sign-in and settings pages, an app shell and sidebar, site header and footer, marketing sections, blog and changelog layouts, search results and error pages.
- **Run store and the agent event model** `run`, `adapters`
  One store that every agent view reads from, fed by a small set of run events, so the views work with any agent framework.

### Pro

- Agent components for review, evals and cost (Pro): https://ui.knowns.dev/changelog#0.9.0-agent-components-pro
- Dashboards, boards, pricing and maps (Pro): https://ui.knowns.dev/changelog#0.9.0-blocks-pro
- Grounded answers, prompt templates and model choice (Pro): https://ui.knowns.dev/changelog#0.9.0-chat-pro
- SDK adapters (Pro): https://ui.knowns.dev/changelog#0.9.0-adapters-pro
- Voice orb, agent avatars and vector search (Pro): https://ui.knowns.dev/changelog#0.9.0-illustrations-pro
