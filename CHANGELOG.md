# Changelog

Free changes in full. Pro changes are listed by title; see https://ui.knowns.dev/changelog for them.

## 0.9.2 (2026-11-11) - CLI and motion

A knowns-ui CLI that installs Free and Pro items with one short command, saves and checks your Pro key, and teaches coding agents how to use the kit, plus Fan Stack, an assistant avatar slot in Chat app, and calmer motion for Agent Graph and Tool Call Card. The site itself now runs on Astro.

### Added

- **Fan Stack** `fan-stack`
  A stack of cards that fans out like a hand of playing cards on hover or keyboard focus and folds back when you leave. A tap toggles it on touch, each card is a slot for an image or any node, and spread and gap are props. Transform only, with a short stagger, and it shows the final state at once under reduced motion.
- **knowns-ui CLI 0.2: login and agent skills** `docs-install`
  `npx knowns-ui@latest login` saves your Pro key in one step: it asks for the key without echo, checks it with the server, writes it to .env.local and makes sure .gitignore covers that file; `logout` removes it. `npx knowns-ui@latest skill` teaches your coding agent Knowns UI: a skill in .claude/skills/knowns-ui with the live catalog, theming, patterns and motion notes, plus a section in AGENTS.md. `--client all` adds Cursor, Copilot, Windsurf and Codex, `--global` installs it for every project, and `init` offers it.
- **knowns-ui CLI 0.2.1: whoami** `docs-install`
  `npx knowns-ui@latest whoami` shows what your Pro key is: the plan, its status, when it expires, the seats and the account email, with the key and email masked. It reads the key from your environment or .env.local, and `--json` prints the raw answer for scripts.
- **knowns-ui CLI, npx knowns-ui@latest add** `docs-install`
  A short install command: `npx knowns-ui@latest add breadcrumb`. The new `knowns-ui` package wraps the shadcn CLI. `init` adds both registries to components.json and can save your Pro key to .env.local, `add` sends each name to the Free or the Pro registry and passes shadcn flags through, `list` and `search` show the items with their tier, `mcp` prints the MCP server config, and `--dry-run` prints the shadcn command without running it. Docs Install gets an optional `alt` tab for a command of your own, and every install block on this site shows the knowns-ui command next to npm, pnpm, yarn and bun.

### Changed

- **Agent Graph motion** `agent-graph`
  Agent Graph moves by the kit's motion rules. `intro` now defaults to `false`, so the graph is simply there on first render; pass `intro="grow"` for the reveal from You outward, or `"fade"`. A node that joins grows from 0.9 instead of 0.2, a node that leaves fades to 0.9 instead of shrinking to nothing, and both take the motion tokens. The halo flare when a message arrives is shorter and fades instead of blurring, hovering a node no longer scales it, the live dot in the header no longer pings, and with reduced motion joins appear at once.
- **Install blocks lead with the knowns-ui CLI** `docs-install`
  Every install block on this site now shows `npx knowns-ui@latest add <name>` first, through your package manager (`pnpm dlx`, `yarn dlx`, `bunx --bun`), and the plain shadcn command sits one tab away. The home page types the same command. Docs Install gets a `commands` prop for a CLI of your own per package manager, and `runWith(pm, command)` builds one.
- **Tool call card motion** `tool-call-card`
  A call that finishes now draws its check, and a failed call shakes once and draws the X. The arguments and result fold open and closed instead of jumping, and so do the calls inside a Tool Call Group. Nothing plays on first render or while the clock ticks, and reduced motion makes every change instant.

### Pro

- Chat app assistant avatar slot (Pro): https://ui.knowns.dev/changelog#0.9.2-chat-app-avatar

## 0.9.1 (2026-11-09) - Agents, ops and pricing

Two days of building on the early access release. New Pro blocks for running AI products: Agent Builder, Agent Health, Agent Run Pivot, AI Service Status, Document Extract, Webhooks, the Workflow and Node Graph editors and a Pricing Calculator; new Free pieces like Uptime Bar, Notification Center, onboarding and setup flows and three templates, and an Activity Feed with unread state; plus calmer motion, better accessibility and a What's new page.

### Breaking

- **Testimonials and Team Grid are Free** `testimonials`, `team-grid`
  The Testimonials masonry grid and the Team Grid cards and compact tiles are now Free. Their sections share a shell (TestimonialsSection, TeamSection) that the Pro layouts build on.

  Migration: The `variant` prop is gone from the layouts that moved out. Replace `<Testimonials variant="carousel" />` with `<TestimonialsCarousel />` from testimonials-carousel, `<Testimonials variant="single" />` with `<TestimonialsQuote />` from testimonials-quote, and `<TeamGrid variant="list" />` with `<TeamList />` from team-list. Their other props are unchanged.

### Added

- **Activity Feed** `activity-feed`
  A timeline of what people and agents did, in Blocks > Application. Days group the list, filters narrow it by who and by type, and rows open to show a diff summary or a tool call. New events that arrive while you are scrolled wait behind an "N new" pill. Free.
- **Alert: an inline callout with four tones** `alert`
  `Alert` is an inline callout for a message about the page or form it sits in. Info, success, warning and danger each have one signal, the icon, so the card stays neutral. It takes an optional title, one action and a dismiss button, and uses role=alert for warning and danger and role=status for the others.
- **Backgrounds keep your copy readable with focus** `dot-spotlight`, `signal-lines`, `aurora`, `node-field`, `perspective-grid`, `grid-pattern`, `dither-field`, `flickering-grid`, `cube-field`, `gradient-floor`
  Every background takes `focus`: `"center"` fades the pattern out in an ellipse behind a centred block such as a hero, `"band"` clears a stripe through the middle, and `"none"` (the default) leaves it as it was. It stacks with `mask`, so body copy stays at AA contrast over lines, grids, nodes and cubes. The demos now fill their preview frame and use `focus="center"`.
- **Changelog Releases view, entry badges and a neutral callout** `changelog-feed`, `content-core`
  `ChangelogReleases` makes the release the unit: a header with the version, date, title and summary, a sticky rail on wide screens, and changes grouped by type with a quiet list of names. Entries gain `badge`, `note` and `flags`, and content callouts a `neutral` tone.
- **Chart** `chart`
  Line, bar (grouped or stacked), area and sparkline in plain SVG with no chart library, in Base > Data display. Axes, grid, a tooltip you can reach with the arrow keys, legend buttons that toggle series, an empty state and a hidden data table for screen readers. Free.
- **Code Block** `code-block`
  A block of code with syntax colours, a copy button, a filename and language label, line numbers, highlighted lines, a wrap toggle and a fold for long output. The colours come from a small built-in tokenizer with no dependency, so it renders the same on the server, in the browser and on Cloudflare Workers, and a `highlight` prop takes your own highlighter such as Shiki.
- **Conversation List** `conversation-list`
  A chat history list for a sidebar, in Chat: search, pinned chats, groups for today, yesterday and earlier, inline rename and a row menu with pin, rename and delete. One tab stop with arrow-key navigation, F2 to rename and Delete to remove. Free.
- **Cookie Consent** `cookie-consent`
  A consent banner with Accept all, Reject all and Customize, and a preferences dialog with a switch per category, in Blocks > Application. Rejecting is exactly as easy as accepting, the choice is saved and reported to your code, and the banner never blocks the page or traps focus. Free.
- **Gradient Floor** `gradient-floor`
  A lit floor that rises from the bottom edge of a hero or a scene. Two soft gradient layers drift and breathe in your accent colours, and `pulse(x)` sends a wave across it, from a ref or from any piece with `pulseGradientFloors`. It takes `color`, `height`, `speed`, `intensity` and `channel`, pauses offscreen, and holds a still floor for reduced motion. Free.
- **Gradient Text** `gradient-text`
  Text filled with a slowly flowing gradient, alone or in a gradient-border chip. It uses theme colours by default, takes `colors`, `speed`, `motion` (enter, hover, loop, none) and `pill`, and holds still for reduced motion. Free.
- **Hover card: a preview that waits for the pointer to rest** `hover-card`
  `HoverCard` opens a preview card after the pointer rests on a link (500 ms by default) or at once when focus lands on it, stays open while you move into the card, and closes on Escape or an outside tap. On a touch screen the first tap opens the card and holds the link back, and a second tap follows it.
- **Inline previews in the Catalog Grid** `catalog-grid`
  A CatalogItem can set `inline` to render its `preview` in the card itself, unscaled, instead of as a scaled overlay. `preview` now receives `{ live }`: it is false for the poster (and always on touch screens, Save-Data and reduced motion) and true once the card goes live, so text samples show their finished state as the poster and play only when live. Free.
- **Motion** `motion`
  One shared set of motion for state changes: duration and easing tokens (`MOTION`, `EASE`) and helpers for a status icon that draws, shakes or pulses (`usePlay`), a fold (`Fold`), rows that slide in and collapse out (`useMotionList`, `RowShell`), a counting number (`TickNumber`) and a value that flashes (`Flash`, `SwapText`). It moves transform and opacity, and reduced motion makes every change instant.
- **Notification Center** `notification-center`
  A bell with an unread count and a panel of notifications, in Blocks > Application. Tabs split All, Mentions and Agents; days group the list; agent runs show their state with inline Approve and Open actions. It is controlled (`items`, `onRead`, `onAction`, `onLoadMore`), reads new items out through a live region, and opens as a full-height sheet on phones. Free.
- **Onboarding Checklist** `onboarding-checklist`
  A compact first-run card for a dashboard corner, in Blocks > Application. It shows a count and progress bar, steps that are done, current, available or locked with the reason, a call to action and an optional how-to on each, snooze and dismiss, and a short completion message that holds still when reduced motion is on. Controlled: you own which steps are done. Free.
- **Resizable panels with keyboard handles and saved sizes** `resizable`
  `ResizablePanelGroup`, `ResizablePanel` and `ResizableHandle` split an area into panels you size by dragging a divider. Each divider is a focusable separator: arrows move it 1% (10% with Shift), Home and End go to a panel's limits, Enter collapses or reopens a collapsible panel and a double click resets the layout. Panels take min and max sizes, groups nest to split both ways, and `storageKey` remembers the sizes between visits.
- **SaaS Landing, App Dashboard and Docs Site templates** `template-saas-landing`, `template-app-dashboard`, `template-docs-site`
  Three whole pages built only from the blocks, each one registry item and one install: a SaaS landing page (announcement bar, header, hero, logos, features, stats, pricing, testimonials, FAQ, call to action, footer), an app dashboard on the App Shell, and a docs site with a search home and docs pages. Demo brand and copy for a fictional product, plain arrays at the top of each file.
- **Setup Wizard** `setup-wizard`
  A multi-step setup built on the Stepper, in Blocks > Application. Each step validates before Next, optional steps can be skipped, a review step comes before the end, and a success state closes the flow. Focus moves to the step heading on every change, Enter in a field advances, and the current step can be kept in the URL. Works in a page or in a dialog. Free.
- **Sheet: a panel from any edge, and a bottom drawer you drag down** `sheet`, `sidebar`
  `Sheet` slides in from the left, right, top or bottom on the native dialog element, with a focus trap, Escape, a click on the backdrop, a locked page scroll, focus returned to the trigger and an exit animation (opacity only under reduced motion). The bottom edge is a drawer with a handle: pull it or its header down past 30% of its height, or flick it, to close. The Sidebar's mobile menu is now a left Sheet instead of its own copy of this code.
- **Sidebar folding: offcanvas mode, no-flash boot, hover flyouts** `sidebar`, `sidebar-docs`, `docs-page-header`, `popover`
  `collapsible="offcanvas"` hides the desktop sidebar fully instead of the icon rail: the width animates to 0, the content slides out at a fixed width, and the hidden panel is inert. `SidebarReveal` brings it back from beside the content. `sidebarBootScript(keys)` in a `<head>` script applies a remembered collapse before the first paint, so a server-rendered page doesn't flash open. SidebarTrigger takes `labels` ({ collapse, expand }) for a state-aware name and tooltip and `look` ("field" for a search row, "float" for a button fixed over the page; collapsed it shows panel-left-open), and keeps its tooltip while expanded. Rail flyouts now open on hover (without moving focus) as well as on click. A provider nested in another sidebar's layout takes Cmd/Ctrl+B only while focus is inside it. Docs Sidebar adds `searchLeading` and a 36px search field, Docs Page Header adds `breadcrumbLeading`, and Popover adds `focusOnOpen`.
- **Site Header actions slot and optional search button** `site-header`
  Site Header takes `search.button: false` to drop the search button from the bar (the drawer keeps its Search row, and the shortcut stays yours to bind), and `actions`: icon buttons (a GitHub link, notifications) that sit right after the theme toggle in the same spacing, so they line up with search, the toggle and the avatar. Free.
- **Social links detect their platform** `team-grid`, `site-footer`
  Paste a Discord, X, GitHub, LinkedIn, YouTube, Bluesky, Threads, Instagram, Facebook, TikTok, Telegram, Reddit or Medium link and the icon and the accessible name ("Ada Park on Discord") follow from the URL; mailto: is Email and anything else a Website. `kind` is now optional on Team Grid, Team List and Team Showcase `links` and on Site Footer `socials`, and an explicit kind, label or icon still wins. One shared `socialOf` helper. Free.
- **startComplete for text animations** `token-stream`, `decode-text`, `typewriter`
  Token Stream, Decode Text and Typewriter take `startComplete`: they show their finished text first (the whole reply, the decoded value, the first phrase) and then play from there on `loop`. Use it for posters, cards and previews, where a frozen first frame would read blank. Free.
- **Tab Overload** `tab-overload`
  A small stack of overlapping browser windows for a 4:3 feature or bento card. The window under the pointer comes forward; left alone, the highlight drifts from one to the next. It takes `windows`, `active`, `cycle`, `interval` and `color`, scales with its card, and holds still for reduced motion. Free.
- **Textarea: grows with its text and counts characters or words** `textarea`
  `Textarea` is a multi-line field in the look of Input. With `autosize` it grows from `minRows` up to `maxRows`, then scrolls. `count` shows characters or words under the field, `limit` is a soft limit that turns the counter red and marks the field invalid, and `maxLength` is a hard one the browser enforces. `remaining` shows what is left. The counter is part of the field's description and is read out only when you near, reach or pass the limit, not on every key.
- **Uptime Bar: day by day status for one service** `uptime-bar`
  New Free component `UptimeBar`: one row of day bars (operational, degraded, outage, no data) with the uptime percent, a tooltip on hover or focus, one tab stop with Left, Right, Home and End to inspect days and Enter to select one, and a screen reader summary worked out from the data. The bars thin out on a narrow container and never scroll the page. Free.
- **User Menu compact avatar** `user-menu`
  User Menu takes `compact`: a 24px avatar in a 32px hit area, so it sits at the size of the icon buttons beside it in a header instead of looking larger than them. Free.
- **Variants and colours** `button`, `badge`, `tag`, `alert`, `status-dot`, `progress`, `switch`, `checkbox`, `segmented-control`, `variants`, `theming`
  Recolour a region with `--kn-accent` and `--kn-accent-foreground`, which Button, Progress, Switch, Checkbox, Segmented Control and the accent tone follow (unset, they use `--primary`). Alert and Status Dot take a `tone`, Segmented Control takes `neutral` or `accent`, and each core component exports its look as a cva map such as `buttonVariants`. A new Variants and colours guide shows how to add a variant of your own.
- **What's new page**
  A new page at `/new` lists every recently added component, block and template, newest first, grouped by week or release, each with a live preview. Filter by kind (Components, Blocks, Templates) and tier (Free, Pro), or switch to Updated to see what changed; the filters live in the URL so a view can be shared. The sidebar's What's new button and the landing page's New link open it, and `/new/feed.xml` is an Atom feed of the same list.

### Changed

- **Accent follows --kn-accent** `shine-border`, `parallax-card`, `content-core`, `aurora`, `gradient-floor`, `agent-lanes`, `tab-overload`, `catalog-grid`, `variants`, `theming`
  Shine Border, Parallax Card, Content Core (Prose), Aurora, Gradient Floor, Agent Lanes, Tab Overload and Catalog Grid used a fixed indigo as their default accent. They now read `--kn-accent` and fall back to the same indigo, so nothing changes until you set it, and setting it on any ancestor recolours them.
- **Activity Feed tracks unread** `activity-feed`
  The feed keeps read state. Unread rows carry a dot, the header counts them and Mark all read clears the dots with a short sweep, then reads "All caught up". Type tabs with counts replace the type chips. Avatars carry a type badge, rows are one sentence with a muted project and snippet line, and opening a row shows the full snippet in place. New items wait behind an "N new updates" pill with `holdNew`. New props: `typeMeta`, `onMarkRead`, `onMarkAllRead`, `holdNew`; new item fields: `unread`, `project`, `snippet`. Existing props keep working. Free.
- **Agents and chat blocks: one signal per state, each fact once** `agent-monitor`, `agent-fleet`, `agent-handoff`, `tool-call-card`, `thinking-state`, `trace-waterfall`, `context-window`
  A failed Agent Monitor shows the badge and one red line, not a box, a red step and a red bar. Agent Fleet counts the agents that run in its header (not their sub-agents) and a running row shows the badge without a spinner; Agent Handoff does the same. A Tool Call Group keeps "1 failed" in the quiet ink. Thinking State counts a source once when a step searched it and a later step read it (the header said 7 where the answer listed 5). Context Window says what is left once and drops the repeated thresholds. Trace Waterfall puts a duration label before the bar when it would run into the edge fade.

  Trace Waterfall clips its axis and frame, so the brush and the tick labels no longer widen the page. Thinking State shows its own label in the header while it is open and a step runs, so a step title is not shown twice.
- **API keys: environments, idle keys, inline create and hold to revoke** `settings-api-keys`
  `ApiKeysSettings` (Free) gains an optional live or test `env` per key with a badge and a filter, idle keys marked "Idle, used 41 days ago" after `idleAfterDays` (default 30) with a hint to revoke, a create form that unfolds in the list and still shows the secret once, an expandable row with created by, last used from and a usage sparkline, and hold to revoke (mouse, touch or Space/Enter; reduced motion gets a confirm step). Existing props keep working; `onCreate` also receives `environment` when you pass `environments`.
- **Better examples for Team Grid and Testimonials** `team-grid`, `testimonials`
  New `spacing="tight"` option trims the section padding inside a page or a frame. Team Grid cards are now equal height and no longer grow when hovered, so the grid does not jump. The examples use balanced fictional quotes from agent-product teams, without star ratings, and a team with matching bios and links.
- **Calmer hero and catalog motion** `hero`, `catalog-grid`
  Hero word rotation is off by default (`rotateAuto` turns it on). Catalog cards press to .97, and the grid fades in with a shorter, capped stagger.
- **Calmer motion: matching exits, less movement on everyday controls** `tooltip`, `popover`, `hover-card`, `menu`, `combobox`, `dropdown`, `dialog`, `toast`, `user-menu`, `command-menu`, `button`, `segmented-control`, `radio-group`, `checkbox`, `password-strength`, `shine-border`, `tool-call-card`
  Tooltip, Popover, Hover Card, Menu, Combobox, User Menu, Dialog and Toast now fade out the way they fade in, in the same direction, instead of vanishing. Tooltips fade only (no travel) and reopen at once when you move along a toolbar. Menus and the Command Menu no longer glide the highlight, stagger the rows or tween the list height. Buttons no longer lift on hover and shrink to .97 while pressed. Segmented Control moves its thumb once, in 120ms. Nothing scales from below .9, the overshoot curve is gone, and the stray easing curves now follow `--kn-ease-out`, `--kn-ease-in`, `--kn-dur` and `--kn-dur-fast` (with the old values as fallbacks). Shine Border now runs on hover by default (set `mode="continuous"` to loop), and Tool Call Card renders once a second while a call runs instead of ten times.
- **Chart gains a bare mode and a fluid sparkline** `chart`, `stats-band`
  Chart takes `bare` for a compact strip with no axes, and Sparkline takes `fluid` to fill its container and `baseline` for a faint floor. Stats Band's trend now draws with Sparkline.
- **className now beats built-in classes** `knowns-core`
  `cn` is now `clsx` plus `tailwind-merge`, so a `className` you pass wins over a component's own `bg-*`, `text-*`, `rounded-*` or `p-*`. The registry adds `clsx`, `tailwind-merge` and `class-variance-authority` as dependencies.
- **Code and payloads render with Code Block** `tool-call-card`, `approval-prompt`, `trace-waterfall`, `content-core`, `docs-preview`, `docs-install`
  Tool Call Card arguments and results, Approval Prompt details, Trace Waterfall payloads, the code block in Content and the built-in code panels of Docs Preview and Docs Install now use Code Block: syntax colours, a keyboard-scrollable region and wrapping that follows the container.
- **Code Block can animate its fold** `code-block`
  Code Block takes `animateFold` to open and close "Show N more lines" with a height transition instead of swapping the lines. Off by default; it needs the Motion helpers, which install with it.
- **Code Block nests and streams** `code-block`
  Code Block takes `label` to replace the language name in its header, `flush` to drop its frame inside another card, `maxHeight` to scroll inside a cap, and `follow` to keep the newest line in view while code streams in until the reader scrolls up.
- **Counts on the Changelog Feed filter** `changelog-feed`
  The type chips show how many entries each has, and the block exports `changeTagClass` for views that share its tag colours.
- **Data Table toolbar on narrow screens** `data-table`
  Below 640px the toolbar sits on two rows: the row count and the Columns menu, then search with the density switch. Free.
- **Fleet header: hideable title, no doubled signals** `agent-fleet`
  Pass `title={null}` when the page already has a heading: the header then shows only the totals. The totals leave out "0 sub-agents", and a row no longer repeats "1 needs you" next to its own "Needs you" badge (the text now counts only sub-agents waiting below).
- **Heading level and landmark props** `hero`, `error-pages`, `data-table`, `app-shell`, `sidebar`
  Hero and error pages take `as` (h1 by default, h2 or h3 when they are not the page title). DataTable takes `titleAs`. AppShell takes `embedded` and `labelPrefix`, and Sidebar takes `landmark`, so a shell shown inside another page adds no second main or aside and its labels stay unique. The settings avatar file input has a label.
- **No layout transitions in slider, cursor and agent views** `slider`, `custom-cursor`, `context-window`, `agent-monitor`, `trace-waterfall`, `ai-answer`
  The slider fill and thumb snap to the value, the cursor dot and label pill swap size at once while colour and press scale still ease, and the context window, agent monitor header, trace waterfall height and AI answer height snap instead of animating layout.
- **Quieter application blocks** `notification-center`, `auth-card`, `settings-profile`, `setup-wizard`, `search-results`, `activity-feed`, `template-app-dashboard`, `template-saas-landing`
  Each state now has one signal. Notification Center shows the state as a coloured word with no extra dot, Auth Card keeps Continue enabled and validates on submit, and Settings Profile shows the bio counter once. Setup Wizard puts each step's description in the panel only, so the stepper labels stay even. Search Results skips the type chip when the breadcrumb already says it, and the All filter carries no count. Activity Feed lines its times up whether or not a row has details. The App Dashboard template shows consistent counts and a recent-activity list that does not repeat the agents above it, and the SaaS Landing template fades its dither field out behind the text and stats.
- **Shimmer sweep and pill, Word Rotate morph** `shimmer-text`, `word-rotate`
  Shimmer Text takes `variant="sweep"`, one soft light band across the whole label, and `pill` for an announcement chip such as "Introducing Agent Avatar". Word Rotate takes `transition="morph"`, a blur crossfade in the same slot, instead of the rising swap.
- **Site header right cluster spacing** `site-header`
  The right side of the header has one rhythm: 8px between the icon buttons, 12px around the account slot and before the call to action. A hidden child (a CTA a paid user doesn't see) leaves no hole.
- **Skeleton: one shared sweep, presets and a loaded crossfade** `skeleton`
  Every skeleton on a page now shares one light sweep, like a single light passing over the layout, instead of each block pulsing on its own. New presets (`SkeletonText`, `SkeletonProfile`, `SkeletonList`, `SkeletonMediaGrid`) and `SkeletonGate`, which fades the skeleton out as the real content fades in without moving anything. `<Skeleton className>` works as before. Reduced motion shows still blocks and an instant swap. Free.
- **Stats Band footnote sits closer to the band** `stats-band`
  The source footnote under the band is closer to the numbers it explains.
- **Stats Band proof visuals and divided tone** `stats-band`
  Stats Band takes a `visual` per stat (a trend line, daily bars or a distribution with a marker, all in one ink colour), a `context` line that fades in on hover or focus where a mouse is present and is always shown on touch screens, and a new `divided` tone, a hairline grid.
- **Tabs indicator and illustrations without width or height motion** `tabs`, `prompt-to-team`, `model-orbit`, `tab-overload`
  The tabs indicator now glides by transform and opacity with the shared ease-out and 180ms; its size snaps to the new tab instead of animating width and height. Illustration fades and pops are within 280ms; line draws and loops stay long because the motion is the content.

### Fixed

- **Cookie Consent: the policy link shows the kit focus ring** `cookie-consent`
  The "Cookie policy" link in `CookieConsent` now uses the kit focus ring (`focusRing`) instead of the browser's default 1px outline when reached with the keyboard. Free.
- **Disabled buttons keep their look** `button`
  A disabled Button keeps its variant (primary stays dark, secondary stays a card chip) at half opacity with a not-allowed cursor, instead of reading as a filled grey slab. Hover and press effects no longer apply while it is disabled. Free.
- **Headings inside a live example stay out of the page contents** `docs-preview`
  A preview's body is marked `data-toc="false"`, so a demo's own headings no longer show up in "On this page".
- **Logo Cloud no longer cuts names short** `logo-cloud`
  A name beside a mark wraps instead of ending in an ellipsis, so "Calendar" reads in full in a six-column row. The Zendesk icon follows the text colour, so it stays visible in dark mode.
- **One Props heading per docs page** `badge`, `input`, `checkbox`, `menu`, `theme-toggle`
  A docs page with two props tables no longer repeats the Props heading, so "On this page" lists it once and anchors stay unique.
- **Tab Overload keeps every tab label visible** `tab-overload`
  The window cascade steps down far enough that the next window no longer covers the tab label of the one behind it, for two to five windows.
- **Testimonial name and role wrap instead of truncating** `testimonials`
  The name and the role line under a quote wrap to a second line rather than ending in an ellipsis, so a long company name is never cut off.
- **Typewriter deleted only half of a phrase** `typewriter`
  Deleting a phrase or a long `back` count stopped halfway, so the next phrase typed onto the leftovers ("SummarizeCompare trackers"). It now deletes exactly what the script says. Free.
- **User menu: the phone sheet slides in, out and back on a short swipe** `user-menu`
  On phones the `UserMenu` bottom sheet now slides up on open and down on close, and a swipe that stays under the threshold snaps back. Before, an inline `translate` overrode the class, so the sheet appeared and vanished with no motion and snapped back after a long swipe.

### Pro

- Agent Avatar cloud shape (Pro): https://ui.knowns.dev/changelog#0.9.1-agent-avatar-cloud
- Agent Builder: configure, test and publish one agent (Pro): https://ui.knowns.dev/changelog#0.9.1-agent-builder
- Agent Health: is this agent OK, and what next (Pro): https://ui.knowns.dev/changelog#0.9.1-agent-health
- Agent Run Pivot: a pivot explorer for agent runs (Pro): https://ui.knowns.dev/changelog#0.9.1-agent-run-pivot
- Agent Terminal (Pro): https://ui.knowns.dev/changelog#0.9.1-agent-terminal
- AI Service Status: uptime, response time and incidents for AI services (Pro): https://ui.knowns.dev/changelog#0.9.1-ai-service-status
- Artifact canvas: the panel beside a chat for what the agent made (Pro): https://ui.knowns.dev/changelog#0.9.1-artifact-canvas
- Canvas viewport: pan, zoom and fit maths for node canvases (Pro): https://ui.knowns.dev/changelog#0.9.1-canvas-viewport
- Carousel, Quote and Team List as Pro variants (Pro): https://ui.knowns.dev/changelog#0.9.1-testimonials-team-pro-variants
- Changelog Timeline block (Pro): https://ui.knowns.dev/changelog#0.9.1-changelog-timeline
- Computer Use viewer: watch an agent drive a screen (Pro): https://ui.knowns.dev/changelog#0.9.1-computer-use-viewer
- Document Extract: typed fields from a document, each linked to its source (Pro): https://ui.knowns.dev/changelog#0.9.1-document-extract
- Knowledge Sources (Pro): https://ui.knowns.dev/changelog#0.9.1-knowledge-sources
- Node graph editor: a node graph for AI pipelines (Pro): https://ui.knowns.dev/changelog#0.9.1-node-graph-editor
- Pricing Calculator: sliders, a plan that fits and a live total (Pro): https://ui.knowns.dev/changelog#0.9.1-pricing-calculator
- Prompt Keyboard (Pro): https://ui.knowns.dev/changelog#0.9.1-prompt-keyboard
- Task Flow (Pro): https://ui.knowns.dev/changelog#0.9.1-task-flow
- Team Showcase (Pro): https://ui.knowns.dev/changelog#0.9.1-team-showcase
- Testimonials Stage (Pro): https://ui.knowns.dev/changelog#0.9.1-testimonials-stage
- Webhooks: endpoints, deliveries and a payload inspector (Pro): https://ui.knowns.dev/changelog#0.9.1-webhooks
- Workflow builder: an editable canvas for agent workflows (Pro): https://ui.knowns.dev/changelog#0.9.1-workflow-builder
- Writing Assistant (Pro): https://ui.knowns.dev/changelog#0.9.1-writing-assistant
- Accent follows --kn-accent (Pro): https://ui.knowns.dev/changelog#0.9.1-colour-variants-pro
- Better example for Feature Split (Pro): https://ui.knowns.dev/changelog#0.9.1-feature-split-polish
- Calmer motion across Pro blocks (Pro): https://ui.knowns.dev/changelog#0.9.1-motion-rollout-pro
- Chat App uses Conversation List (Pro): https://ui.knowns.dev/changelog#0.9.1-screen-chat-conversation-list
- Hero variants take a heading level (Pro): https://ui.knowns.dev/changelog#0.9.1-a11y-heading-landmarks-pro
- Logo Marquee pause control and header (Pro): https://ui.knowns.dev/changelog#0.9.1-logo-marquee-pause
- Meter, win-rate and treemap motion without layout properties (Pro): https://ui.knowns.dev/changelog#0.9.1-motion-layout-props-pro
- No more width and height transitions in Pro blocks (Pro): https://ui.knowns.dev/changelog#0.9.1-motion-leftovers-pro
- Permission Request shows the command in a Code Block (Pro): https://ui.knowns.dev/changelog#0.9.1-permission-request-code-block
- Pricing Compare installs with Pricing Plans (Pro): https://ui.knowns.dev/changelog#0.9.1-pricing-compare-depends-on-plans
- Pro agent blocks: one signal per state, no clipped rows, each fact once (Pro): https://ui.knowns.dev/changelog#0.9.1-slop-sweep-agents-chat-pro
- Quieter header, board and map blocks (Pro): https://ui.knowns.dev/changelog#0.9.1-slop-pass-pro
- State changes you can see (Pro): https://ui.knowns.dev/changelog#0.9.1-motion-pilot-pro
- Team Showcase links detect their platform (Pro): https://ui.knowns.dev/changelog#0.9.1-social-links-detect-pro
- Templates is its own section (Pro): https://ui.knowns.dev/changelog#0.9.1-templates-section
- Usage Meter draws its daily bars with Chart (Pro): https://ui.knowns.dev/changelog#0.9.1-usage-meter-chart
- Artifact Split no longer opens a modal on load (Pro): https://ui.knowns.dev/changelog#0.9.1-artifact-split-mode
- Layout follows the block's own width (Pro): https://ui.knowns.dev/changelog#0.9.1-container-queries-pro
- Logo marquee no longer uses data-track (Pro): https://ui.knowns.dev/changelog#0.9.1-logo-marquee-track-attr
- Task Flow cards are never shown empty (Pro): https://ui.knowns.dev/changelog#0.9.1-task-flow-cards

## 0.9.0 (2026-11-07) - Early access

The first public version. Free covers the base components, the core agent and chat views, backgrounds, text animation and the page blocks. Pro adds the review, eval and cost views, more chat, dashboards and boards, maps, the voice orb and agent avatars, and the SDK adapters. Everything installs as source with the shadcn CLI.

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
