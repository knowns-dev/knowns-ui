# Changelog

Free changes in full. Pro changes are listed by title; see https://ui.knowns.dev/changelog for them.

## 0.9.4 (2026-11-20) - AI whiteboard and an AI CMS

A whiteboard a person and an AI build together, with questions asked on the board, an AI CMS template and blocks, a JSON inspector, chart morphs and new marketing pieces.

### Added

- **Announcement Pill** `announcement-pill`
  A New pill for above a hero headline that grows in place into a small changelog card: a date, a title, two lines, an image or up to three points, and a link. Hover or keyboard focus previews it, click or Enter keeps it open with a close button, and Esc or a click outside closes it and returns focus to the pill. The card overlays the page, so the hero never moves. `fromChangelogEntry` turns a changelog-feed entry into the card. Free.
- **Badge overlay variant** `badge`
  `variant="overlay"` is a badge for sitting on a photo or thumbnail: an opaque surface, the tone's ink and a hairline ring, with no shadow. It works in all six tones.
- **Context Memory** `context-memory`
  A long conversation folds into a few memory notes and the next run recalls the right one. The lines fly into the shelf as the counter ticks down, and a line is drawn from the recalled note to the new run. It is a 4:3 card for bento grids, a wide three-part scene from 560px, and a compact single-card dashboard mode (`quiet`). It takes `notes`, `thread`, `recall`, `prompt`, `answer`, `mode` (loop or once) and `quiet`, pauses offscreen and in hidden tabs, and shows the finished frame under reduced motion. Free.
- **JSON Inspector** `json-inspector`
  Read a JSON payload as a tree: fold any level, search keys and values across the whole document with a match count and next and previous, and copy the focused node's path (`data.items[0].id`) or its value. Arrow keys, Home and End move the focus, `c` and `p` copy, `/` jumps to search. Only the rows in view are rendered, so thousands of lines stay fast. Raw text that does not parse shows the message, the line and column, and the lines around it with a mark. Free.

### Changed

- **Data table footer on narrow tables** `data-table`
  Under 28rem the paging footer is one line: the range ("1–8 of 8") and two icon buttons. The Rows select and "Page 1 of 1" show from 28rem. It follows the table's own width, not the window's.
- **Demos fill the window in full screen** `docs-preview`
  In full screen the preview now sets `--kn-demo-h`, the window height left after the toolbar, the padding, the demo controls row and the zoom. A canvas-like demo can size to it with `h-[var(--kn-demo-h,560px)]` and keeps its own height everywhere else.
- **Hero eyebrow takes an element** `hero`
  The `eyebrow` of every hero layout also takes your own element, such as an Announcement Pill, in place of the built-in line.

### Fixed

- **Docs preview fills the window in full screen** `docs-preview`
  In full screen the framed preview now fills the window under the toolbar, at every width and zoom, instead of keeping its inline height. A preview that is itself an iframe can use the new `--kn-full-h` variable (`h-[var(--kn-full-h,720px)]`).
- **Phone width restored on load** `docs-preview`, `app-shell`
  A preview that opens in a width remembered from the last visit starts at a full height instead of 240px, then follows its page. An App Shell with `layout="fill"` now contains its absolutely placed children, so hidden live-region text no longer adds a second scrollbar to a framed page.

### Pro

- A co-writer writing live (Pro): https://ui.knowns.dev/changelog#0.9.4-prose-diff-author
- A Hand tool to pan the whiteboard (Pro): https://ui.knowns.dev/changelog#0.9.4-whiteboard-hand-tool
- AI CMS template (Pro): https://ui.knowns.dev/changelog#0.9.4-cms-template-ai-cms
- AI collaborator on the board (Pro): https://ui.knowns.dev/changelog#0.9.4-ai-collaborator
- AI in the post editor (Pro): https://ui.knowns.dev/changelog#0.9.4-post-editor-ai
- AI whiteboard (Pro): https://ui.knowns.dev/changelog#0.9.4-ai-whiteboard
- Ask on the board: question actions that build linked guide panels (Pro): https://ui.knowns.dev/changelog#0.9.4-board-ask
- Board context and math objects (Pro): https://ui.knowns.dev/changelog#0.9.4-board-context-math
- Chart Morph (Pro): https://ui.knowns.dev/changelog#0.9.4-chart-morph
- Content table (Pro): https://ui.knowns.dev/changelog#0.9.4-cms-content-table
- Editorial desk block (Pro): https://ui.knowns.dev/changelog#0.9.4-cms-editorial-desk
- JSON Inspector diff and schema hints (Pro): https://ui.knowns.dev/changelog#0.9.4-json-inspector-pro
- Media library (Pro): https://ui.knowns.dev/changelog#0.9.4-media-library
- Post editor (Pro): https://ui.knowns.dev/changelog#0.9.4-cms-post-editor
- Revision history (Pro): https://ui.knowns.dev/changelog#0.9.4-revision-history
- SEO panel (Pro): https://ui.knowns.dev/changelog#0.9.4-cms-seo-panel
- Testimonials Faces (Pro): https://ui.knowns.dev/changelog#0.9.4-testimonials-faces
- Underline stretches of text (Pro): https://ui.knowns.dev/changelog#0.9.4-prompt-editor-marks
- Canvases refit when their box changes height (Pro): https://ui.knowns.dev/changelog#0.9.4-canvas-refit-on-resize
- Cover thumbnail and SEO ring in the content table (Pro): https://ui.knowns.dev/changelog#0.9.4-content-table-cover-seo
- Media library search by description, AI tags and focal point (Pro): https://ui.knowns.dev/changelog#0.9.4-media-library-ai-search-tags-focal
- Prompt editor handle (Pro): https://ui.knowns.dev/changelog#0.9.4-cms-prompt-editor-handle

## 0.9.3 (2026-11-19) - Agent inbox and live app screens

A human-in-the-loop inbox, activity capsules, media and call surfaces, three new templates and a quiz set, plus strict index fixes across the kit.

### Added

- **Agent Graph tintAgents** `agent-graph`
  The new `tintAgents` prop colour-codes every agent node: its border and surface take the agent's colour, the same one the links, streaks and Approval Prompt use, so a team whose agents share one provider logo can still be told apart at a glance. Off by default.
- **Animated Number** `animated-number`
  A number whose changed digits roll up or down to the new value, for live metrics such as runs, spend or a rate. Format it with Intl options (currency, percent, decimals, signDisplay) or a function. Only the digits that change move, upward when the value rose and downward when it fell; nothing plays on first render, on an identical value or with reduced motion, and screen readers get the final text.
- **Answer Pad** `answer-pad`
  The student's phone view of a live quiz question: big tap targets for the choices, locked after one answer, with waiting, right and wrong states. The answer shows at once and is sent in the background; if sending fails it stays saved and goes again when the phone is back online.
- **Approval prompt Edit button** `approval-prompt`
  `ApprovalPrompt` takes `onEdit`, which adds an Edit button between Deny and Approve for changing the proposal before deciding. Without it the prompt is unchanged.
- **Approval prompt renderDetail** `approval-prompt`
  The new `renderDetail` prop replaces the code block under the request title with your own node, such as a small diff of the change, a cost line and a risk badge, so the person sees exactly what they are approving.
- **Area Trend Card** `area-trend-card`
  A card for a total made of parts over time: a headline total with its change, a period dropdown, a soft-gradient area chart (stacked, overlaid or 100% share) and a legend with each part's total. Pointing at a band, a line or a legend entry swaps the headline to that part's total, with the digits rolling. Nothing plays on first render or with reduced motion.
- **Calendar, the month grid on its own** `calendar`, `date-picker`, `date-range-picker`
  New `calendar` item: a month grid with single, range and multiple selection, one or two months, controlled or default month, a `renderDay` slot for dots and badges, outside days and fixed or flexible week rows. Date Picker and Date Range Picker are now built on it with no change in behaviour, and Date Range Picker still exports `Calendar` and its date helpers from the old path. Paging a month fades the grid in for 120ms.
- **Call overlay, a call and recording pill** `call-overlay`
  New Free item `call-overlay`, built on `live-activity`: `CallOverlay` shows connecting, live, on hold, muted, recording and ended as a pill with the clock, mute and end, opening into a card with who is speaking, hold, record and an inline "End this call?" step. `RecordingOverlay` has a red dot, pause or resume, stop and a Discard that asks first. It is controlled and never opens a microphone, and it speaks to a screen reader once per change of state, not on every tick.
- **Carousel on native scroll-snap** `carousel`
  New `carousel` item: slides that snap into place with native scroll, one to four per view, with arrow buttons, the arrow keys, Home and End and dots that all move the same scroll position. Screen readers get a carousel with n of N slides; reduced motion jumps instead of gliding.
- **Catalog grid: tier pills, search, sections and hover previews** `catalog-grid`
  Catalog Grid can show All, New, Free and Pro pills with counts and a search box over the titles, group a long catalogue into titled sections, and mount live previews only while a card is hovered or focused (liveOn="hover"), so nothing runs at load. A live preview now waits until it has content before it covers the poster.
- **Chart annotations can show their label** `chart`
  A chart annotation takes `showLabel` to write its label in small mono type beside the marker, on the side with more room, instead of only in the hover tooltip.
- **Chart draws donuts and pies** `chart`
  `Chart` takes `type="donut"` and `type="pie"`, in plain SVG with no dependency. One slice per row of `data`, sized by the first series, with a small gap between slices. A donut takes `thickness` and a `center` slot, `"total"` for the rolling sum of the visible slices or any node. The legend toggles slices and the rest reflow, arrow keys read each slice with its share, `onSelect` and `selected` work as for bars, and a screen-reader table lists every slice. A value change tweens the angles over 280ms; the first render and reduced motion play nothing.
- **Chart draws progress rings** `chart`
  `Chart` takes `type="rings"`: concentric progress rings, one per row, the first outermost. Each row carries a value and a goal (`goalKey`), and the arc runs clockwise from 12 o'clock over a faint track of the same hue. Past the goal the arc laps the start, up to three laps, with a soft shadow on its end so the overlap reads. The legend shows value, goal and percent and toggles rings, arrow keys read a ring, `center="total"` writes the overall progress, and a value change sweeps the arc over 280ms. The first render and reduced motion play nothing.
- **Chart end dot, fixed slots, a faded area and dashboard props** `chart`
  Lines and areas take `endDot`, a dot on the last point of each line that glides with the line when the data changes. `slots` fixes the number of x slots, so a new point extends the line to the right while the old points stay put (a shorter list cross-fades). `fadeArea` fills an area with a gradient from about 14% of the line colour to nothing. For dashboards: a series can sit on a second, right-hand axis (`axis: "right"`, with `formatRight` and `domainRight`), be drawn dashed, and carry an `icon`; `annotations` mark an x position with a dashed line and a tooltip (a deploy, an incident); `endLabels` write each series' latest value, rolling, at its line end; `focusSeries` dims the other series while an end label or legend entry is hovered. All are off by default.
- **Chart points can be selected** `chart`
  Chart takes `onSelect`, `selected` and `defaultSelected`. A click, or Enter or Space on the point the arrow keys are on, calls `onSelect(index, datum)`. The selected point stays lit (bars) or ringed (lines and areas), and the chart's label and live region name it for screen readers. Works with `valueLabels` and `barColors`.
- **Chart, percent areas and gradient fills** `chart`
  `stacked="percent"` stacks each category's share of its total: the axis runs 0 to 100% and the tooltip shows the share and the value (bars too). `fadeArea` now also fills stacked and overlaid areas with a gradient (a number sets the top opacity) and draws their lines at 1.5px. `curve="smooth" | "linear"` joins `smooth`, and stacked bands now follow the same curve on both edges so they meet without gaps. `cursorLine` picks a dashed or solid hover line. `hoverSeries`, `focusedSeries` and `onFocusSeries` let the plot pick the series under the pointer, band or nearest line, to dim the rest or drive a headline. `stacked={true}` works as before.
- **Chat composer agent header, agent picker, effort and skill chips** `chat-composer`
  `ChatComposer` can now show who you are talking to: `agents` adds an "Agent: Name" menu to the toolbar and `header` adds the avatar with "Name: role" above the text (the current agent, or an identity of its own). `effort` shows a muted "(High)" beside the model. `skills` adds "Run a skill or ask anything" with `/command` chips that put the command in the text, and `ComposerSkills` places that row anywhere, for example under the card, wrapping the chips in even rows. `header` can take an `avatarNode` of your own. Without these props the composer looks and works as before.
- **Class Roster** `class-roster`
  A teacher's class list with search, today's attendance as a chip that cycles Present, Late, Absent and Excused, the average so far and when each student was last active.
- **Composer working glow, thinking marks, landing attachments** `chat-composer`, `thinking-indicator`, `thinking-state`
  Chat Composer lights up while the agent runs: a band of --kn-accent travels around the card border and fades in and out with the state. Attachments land one by one, show upload progress and collapse smoothly on remove. The new Thinking Indicator adds one-line indicator with four small glyphs (dot grid wave, node chain pulse, filling ring, breathing bars), a shimmering status label and a live timer, and Thinking State can use one in its header.
- **Context menu, right-click and long press** `context-menu`
  New `context-menu` item: the menu under the pointer. Right-click opens it at the pointer, Shift+F10 or the menu key at the region, and a long press (500ms, 8px of drift allowed) on touch and pen. It is Menu with `openOn="contextmenu"`, so sections, checked rows, submenus and typeahead all work.
- **Data table filter chips and bulk action bar** `data-table`
  Columns can declare a filter `variant` (text, select, range, date) and `filterBar` shows one chip per column: a select lists its values with live counts, a range is a slider with two number fields, a date is a calendar range. The state is one plain object you can control, and `rowFilter` lets your own filter UI add a rule. `bulkActions` adds a bar for the selected rows (count, your buttons, clear, Esc) that rises in over 180ms and leaves in 120ms.
- **Data Table rowClassName** `data-table`
  `rowClassName` adds classes to a single row, for example a fade-in on a row that just arrived.
- **Dither Field can dither a picture** `dither-field`, `backgrounds-core`
  Pass `src` and Dither Field redraws that image as chunky ordered-dither cells: the picture is drawn small, each RGB channel is thresholded against the Bayer matrix so the colour is kept, and it is scaled back up with smoothing off. `cell` sets the cell size (3 px by default), `levels` the colour levels per channel (6 by default; 4 or fewer shows hue speckle on photos), `blur` softens busy photos first, and `fit` and `position` place the image. It draws once and again only on resize or when the source changes.

  `tone` picks how it is thresholded: "luma" (default) patterns only the lightness and keeps each cell's hue, so bright areas show no pink or green speckle; "channel" quantises R, G and B separately for a palette look.
- **Donut rounded ends and partial slices** `chart`
  The Chart donut takes `rounded`, which gives every slice round ends while keeping the gap between slices, and `maxKey`, which makes each slice's arc follow its max and fills the value's share of it over a faint track in the same colour. Without them the donut and pie are unchanged.
- **Drawer, a bottom sheet with a trigger** `drawer`
  New `drawer` item: Sheet from the bottom edge with its own trigger and state, a fixed half or full height, and a `close` function passed to its content. Pull the handle down to dismiss; it slides for 280ms, or fades with reduced motion.
- **Empty, the state of a list with nothing in it** `empty`
  New `empty` item: an icon tile, a title, one sentence and an action row, dashed or plain, in three sizes. It never animates.
- **Eval score card** `eval-score`
  New Free block `eval-score`: a score card for AI evals. One 0 to 100 score made of weighted sub-scores, drawn as a half arc (or a full ring) of rounded segments that fill over a faint track in their own colour, with a rating from the thresholds you pass, a stepper between eval runs and a row per sub-score with its note, earned over max and a thin bar. Pointing at or focusing a row or a segment dims the others. Changing the run eases the arcs, bars and score together.
- **Feature Trio** `feature-trio`
  Three quiet feature cards, each a bold sentence with a muted continuation and a live product moment underneath. The first spans both columns. They rise 6px and fade in once as the section scrolls into view, 40ms apart, and are visible without JavaScript and under reduced motion. A function visual learns when its card has scrolled in, to start a count once.
- **Filter Chips, a standalone filter bar** `filter-chips`
  New Free component `filter-chips`: a fully controlled filter bar for lists that are not a DataTable. It edits a plain `{ fieldId: string[] }` value and filters nothing itself, so the value can live in the URL or on the server. Each field is a chip: a ghost "+ Field" while empty, "Field is Value" with a clear button once set, with stacked avatars for people. A menu per field has check rows, search past eight options, arrows, Home, End and typeahead; Backspace on a chip clears it, and Clear all appears from two active chips. `collapsed` (or a narrow container, by default) folds the empty fields into one "+ Filter" menu.
- **Floating dock, a panel pinned to a corner** `floating-dock`
  New Free `floating-dock` item: a floating panel pinned to one of four corners of the screen or of a parent, with a margin and the device safe area kept clear. It holds anything and stays in its corner on resize because it is anchored with CSS. Change `corner` and it is there; nothing animates.
- **Footer set** `footer-wordmark`, `footer-columns`, `footer-minimal`, `footer-status`
  Four marketing footers in one family. Footer Wordmark ends the page in the brand word set as wide as the container and cropped at the bottom edge. Footer Columns pairs the Newsletter sign-up with link columns that stay two across on a phone. Footer Minimal is one line that centres into a stack. Footer Status adds a status pill that links to your status page and an optional 30-day uptime strip. Social links are words, not platform marks. Newsletter gains a `plain` variant: the heading and the form with no section chrome.
- **Goal Rings card** `goal-rings`, `chart`
  A compact card of progress rings with a stat for each ring: swatch, label, value, goal and percent. Pointing at or focusing a ring or its stat brings that ring forward and dims the others, and the stats go under the rings on a narrow card. `Chart` rings get thinner and tighter by default (each ring at most 14px wide, gap 3), a `focused` and `onFocusChange` pair to drive the focus from outside, a `tooltip` switch, and `VIVID_COLORS` (pink-red, lime, cyan) for `barColors`.
- **Heatmap** `heatmap`
  A grid of values on two axes, such as weekday by hour or region by month, built with CSS grid and no chart library. Each cell mixes your accent into the track by its value, so it reads in light and dark, with row and column labels, a Less to More legend, empty cells for no data, and keyboard moves between cells with the row, column and value read out. Pointing at or focusing a cell rings it and brightens its two labels.
- **Hover card reachable from the keyboard** `hover-card`
  New `interactive` prop for a hover card that holds buttons or links. While the card is open and the trigger has focus, Tab moves into the card; Tab past its last control or Shift+Tab from its first returns to the page order and closes it, and there is no focus trap. Escape from inside returns focus to the trigger, and keyboard focus inside the card keeps it open. The trigger announces the card with `aria-haspopup="dialog"` and `aria-controls`, and the card is a labelled, non-modal dialog (`label` sets its name; the default is the trigger's text). Cards without the prop behave exactly as before.
- **Live activity row actions** `live-activity`
  `LiveActivity` takes `rowActions`: small controls at the right end of the row, beside the row button instead of inside it, so a capsule can carry a mute or an end button and still open into its card.
- **Live activity, a capsule for work that runs elsewhere** `live-activity`
  New `live-activity` item: a pill with a leading icon or avatar, a title, one trailing value and a status dot that opens into a card with a body and actions as one size change (the body folds open in 180ms, the row never moves). It comes with three basics: `ActivityStatus` (state with an elapsed clock), `ActivityProgress` (stages with a marker that slides in 280ms) and `ActivityCountdown` (time left with a bar of ticks that drains), plus `ActivityTicks` on its own.
- **Now Playing** `now-playing`, `live-activity`
  A music player on the Live Activity capsule. Collapsed it is a pill with cover art, title, artist, level bars and play or pause; press it and it opens into a card with a scrubber ("1:23 of 3:45" to screen readers), elapsed and remaining time, previous, next and volume. Headless: your app passes the position and the handlers, or wires one audio element with the optional useAudioPlayer hook. Space toggles play from anywhere in the card except on a button. It also works as a remote display: give `positionUpdatedAt` for state pushed from outside and the time keeps running between pushes without jumping back on a stale one. Tiles in compact, medium and large (`size="auto"` picks by container width), an empty and a pending state, optional seek (a read-only progress bar without it), volume 0 to 100 with mute, and every string in a `labels` prop.
- **Priority bars** `priority-bars`
  Priority bars is a small Free part: three rising bars for low, medium and high, an orange exclamation square for urgent, and three faint bars for none. It speaks its level as an image label, or stays silent when a word sits beside it.
- **Progress in segments** `progress`, `tooltip`
  `Progress` takes `segments`, a bar in parts over one `max`, such as done and in progress. Each part has a `tone` or `color` and a `label` that shows in a tooltip, `readout` writes "62%  24 of 39 issues" for the first part, and aria-valuetext lists every part. A single `value` works as before. The fills slide with the slow token and in-out easing, and nothing plays on the first render. `Tooltip` takes a `style` for its wrapper, so a trigger can be placed over a bar.
- **Question Card** `question-card`
  One quiz question to answer: single choice, multiple choice, true or false or a typed answer. The keys 1 to 9 pick a choice, Enter checks the answer, and a verdict with your explanation folds open below. Multiple choice earns partial credit, right and wrong carry a glyph as well as colour, and a polite live region says Correct or Not quite with the right answer.
- **Rain Field background** `rain-field`
  A new Free background: thin streaks of light falling at different speeds and lengths behind a fine dot screen, so they read as lit pixels, in your accent colour. Canvas on the shared background helpers: the dot screen is baked once and only the lit cells are drawn each frame, with no backdrop filter. Pauses offscreen and in hidden tabs; reduced motion draws one still frame.
- **Sidebar switcher shows its list open, with gradient avatars** `sidebar`, `app-shell`
  SidebarSwitcher takes `expanded` to show the workspaces open in the flow as a card instead of in a popover, and each workspace can carry a `swatch` (a gradient or image) for a square avatar. Use it for environments, projects or teams.
- **Site header, counts, badges, footer and a flat drawer** `site-header`
  A mega item takes `count` (a small muted pill) and `badge` (an accent pill such as New). A mega entry takes `footer` (a quiet row at the panel's bottom with a line of text and a link) and `drawer: "flat"`, which lists its groups with icons and counts in the mobile drawer instead of folding them. The panel now fades in without moving.
- **Social Button** `social-button`
  A sign-in button for 24 providers and your own, with an outline, a brand and an icon-only variant, the Button sizes, loading, and a verb prop. The brand look keeps to the official Google, Apple and Microsoft styles. AuthCard and SocialButtons now use it, and SocialButtons takes `variant` and `size`. The marks are Simple Icons paths (CC0).
- **Sortable, reorder a list by pointer or keyboard** `sortable`
  New `sortable` item: a vertical or horizontal list you reorder by dragging the whole row or a handle, or from the keyboard with space, arrows and escape. Every pick-up, move, drop and cancel is announced with the item name and its position. The picked-up row lifts at once and the rest slide aside, settling in 180ms. Built on dnd-kit.
- **Tabs as links** `tabs`
  `Tabs` takes `links`, and a `TabsTrigger` takes an `href`: the trigger renders as a link, so Ctrl or Cmd click opens a new tab. The list becomes a nav landmark and the current link has `aria-current="page"`; there is no tablist or tab role. `TabsList` takes `flush` so the first underline label sits on the list's edge, with the line under it starting there too.
- **Time slots for booking** `time-slots`
  New `time-slots` item: the times of one day as a list to pick from, shown in a chosen time zone with its label, booked and past times disabled, keyboard navigation and an inline Confirm. `buildSlots` makes a day of slots on the host's clock and follows clock changes. Pairs with Calendar to choose the day first.
- **Timeline Scrubber** `timeline-scrubber`
  A time axis with ticks and labels in your own unit and one marker you drag or move with the arrow keys, Page Up, Page Down, Home and End. A card sits above the marker on a stem and stays inside the track at both ends. Controlled or not, snapped to a step, with the value read out through aria-valuetext. The marker, stem and card move with a transform only, and hold still without a transition under reduced motion.

### Changed

- **A pending approval wraps instead of cutting** `agent-monitor`
  AgentMonitor wraps a pending approval's title to two lines and gives the command its own row, up to two lines, so "Refund $49.00 to order #4812" no longer ends in an ellipsis. Other states keep the one-line strip.
- **Accordion motion and polish** `accordion`
  Accordion timing follows the motion tokens. The chevron and the fold now use the same 180ms duration and ease-out curve.
- **Activity feed motion and polish** `activity-feed`
  Activity feed names read one step larger and a status dot fades on the shared 180ms token and ease-out.
- **Agent Cursors: shared motion tokens** `agent-cursors`
  Animations now use the shared duration and easing tokens (nothing over 280ms except named canvas travel) and finish at once under reduced motion.
- **Agent Fleet: shared motion tokens** `agent-fleet`
  Animations now use the shared duration and easing tokens (nothing over 280ms except named canvas travel) and finish at once under reduced motion.
- **Agent Handoff: numbers count with the shared ticker** `agent-handoff`
  Handoff counts and spend now counts to its new value with the shared number ticker, and stays still on first render, on a poll with no change, and with reduced motion.
- **Agent Handoff: shared motion tokens** `agent-handoff`
  Animations now use the shared duration and easing tokens (nothing over 280ms except named canvas travel) and finish at once under reduced motion.
- **Agent Lanes: shared motion tokens** `agent-lanes`
  Animations now use the shared duration and easing tokens (nothing over 280ms except named canvas travel) and finish at once under reduced motion.
- **Agent Monitor: numbers count with the shared ticker** `agent-monitor`
  Cost now counts to its new value with the shared number ticker, and stays still on first render, on a poll with no change, and with reduced motion.
- **Agent Monitor: shared motion tokens** `agent-monitor`
  Animations now use the shared duration and easing tokens (nothing over 280ms except named canvas travel) and finish at once under reduced motion.
- **Agent Plan: shared motion tokens** `agent-plan`
  Animations now use the shared duration and easing tokens (nothing over 280ms except named canvas travel) and finish at once under reduced motion.
- **AI and content components use the shared motion timing** `ai-answer`, `chat-composer`, `code-block`, `data-table`, `ghost-text`, `message-actions`, `thinking-state`, `empty-states`, `run-pulse`, `tab-overload`, `tool-beam`, `text-animation-core`
  Chat and content components now share one set of motion timings: hovers fade in 120ms, rows and folds take 180ms, and the largest moves 280ms, all on the same ease-out curve. Streaming words, new steps and the composer's pops no longer carry their own durations, and the illustration loops use the shared easing.
- **AI answer citation chips are a touch larger** `ai-answer`
  The numbered citation chips in an answer now use an 11px number in a 19px chip (was 10.5px in 18px), so they stay readable when the answer is scaled down, for example in a phone-sized recording.
- **Alert motion and polish** `alert`
  Alert's dismiss button fades its hover colour on the shared 120ms token and ease-out.
- **Announcement bar motion and polish** `announcement-bar`
  Announcement bar uses the shared motion tokens for its hover and dismiss transitions.
- **Approval prompt pressed and agent colour** `approval-prompt`
  The new `pressed` prop shows the Approve or Deny button in its pressed state (scaled to 0.97), for a scripted demo that decides for the visitor. The real press already scales the same way. The requesting agent's avatar now carries that agent's colour as a border and tint, matching its node in Agent Graph.
- **Avatar motion and polish** `avatar`
  Avatar image fades and stack lift use the motion tokens (the image fade is 280ms, the stack lift 180ms), on one ease-out curve.
- **Badge motion and polish** `badge`
  Badge hover and press colours now fade over 120ms and 180ms from the motion tokens.
- **Blog grid motion and polish** `blog-grid`
  Blog grid cards fade hover colours on the shared 120ms token and ease-out.
- **Blog post motion and polish** `blog-post`
  Blog post controls name their duration and easing from the motion tokens.
- **Breadcrumb motion and polish** `breadcrumb`
  Breadcrumb links and the overflow button fade their colour over 120ms on ease-out, like every other link.
- **Calendar months nudge in the direction you page** `calendar`
  Paging months now moves the new month 8px in from the side you are heading to while it fades in (180ms), so next and previous read differently. Two months move as one block, the arrows stay still, nothing plays on first render, and reduced motion swaps at once.
- **Carousel shows part of the next slide** `carousel`
  `perView` takes a fraction such as 1.2, so the next slide peeks in and a swipe is obvious, and the new `perViewWide` sets how many show from 640px up.
- **Catalog grid motion and polish** `catalog-grid`
  Catalog grid cards press and fade on the shared motion tokens.
- **Changelog feed motion and polish** `changelog-feed`
  Changelog feed transitions use the shared motion tokens.
- **Chart value labels and bar colours** `chart`
  Bar charts can now write each bar's value above it with `valueLabels`, and give every bar its own colour with `barColors`. The labels fade in after the bars have grown, and nothing animates on the first render.
- **Chat composer sendPressed** `chat-composer`
  The new `sendPressed` prop shows the Send button in its pressed state (scaled to 0.97), for a scripted demo that sends the message for the visitor. The real press already scales the same way.
- **Checkbox motion and polish** `checkbox`
  The check and indeterminate marks pop in over 120ms on ease-out, from the motion tokens instead of Tailwind's default curve.
- **Combobox motion and polish** `combobox`
  Combobox footer buttons name their timing: 120ms and ease-out.
- **Command menu rows match the other menus** `command-menu`
  Rows are now 32px tall with an 8px radius and the highlight sits on the active row at once, like the menu and dropdown. The panel keeps its short opacity fade and uses the shared modal shadow.
- **Contact section motion and polish** `contact-section`
  Contact section fields and buttons use the shared motion tokens.
- **Context Window: numbers count with the shared ticker** `context-window`
  The used percentage and token count now counts to its new value with the shared number ticker, and stays still on first render, on a poll with no change, and with reduced motion.
- **Context Window: shared motion tokens** `context-window`
  Animations now use the shared duration and easing tokens (nothing over 280ms except named canvas travel) and finish at once under reduced motion.
- **Conversation list motion and polish** `conversation-list`
  Conversation list actions fade in on the shared motion tokens.
- **Custom cursor motion and polish** `custom-cursor`
  The cursor layer and its press scale use the 120ms token with ease-out.
- **Date picker motion and polish** `date-picker`
  Date picker uses the shared field surface and radius scale (8, 9 and 10px), and its hover colours fade over 120ms.
- **Date range picker motion and polish** `date-range-picker`
  Date range picker uses the shared field surface, and day cells and shortcuts fade over 120ms on ease-out.
- **Docs layout motion and polish** `docs-layout`
  Docs layout transitions use the shared motion tokens.
- **Docs page header motion and polish** `docs-page-header`
  Docs page header transitions use the shared motion tokens.
- **Docs Sidebar** `sidebar-docs`
  Counts next to sections and categories now roll to the new number when a filter changes them. Nothing plays on first render or when the count stays the same, and with reduced motion the number just changes.
- **Docs toc motion and polish** `docs-toc`
  Docs table of contents fades its active colour on the shared 120ms token and ease-out.
- **Dropdown timing uses the shared tokens** `dropdown`
  The chevron and panel transitions now read their duration and easing from the motion tokens, so they follow any change you make to them.
- **Error pages motion and polish** `error-pages`
  Error pages use the shared motion tokens for their buttons and links.
- **Faq section motion and polish** `faq-section`
  FAQ section folds open on the shared 180ms token and ease-out.
- **Feature grid, room for one bento visual** `feature-grid`
  Bento features take an optional `visualClassName` for the visual's frame (for example `h-48`), so one cell can show a taller preview without changing its size.
- **File drop motion and polish** `file-drop`
  File drop notes rise on the 180ms token and ease-out curve.
- **Free components follow the accent colour** `ai-answer`, `avatar`, `activity-feed`, `changelog-feed`, `cta-section`, `hero`, `marketing-core`, `settings-api-keys`, `sidebar-docs`, `announcement-bar`, `combobox`, `context-window`, `thinking-state`, `tool-call-card`
  The brand highlight in these components (links, eyebrows, running states, the New tag, the accent button and bar) now comes from --kn-accent, falling back to --primary, instead of a fixed indigo, sky or violet. Status colours and agent identity colours are unchanged.
- **Free install no longer needs a components.json entry** `installation`
  The @knowns-ui namespace is now in the shadcn CLI's own registry list, so `npx shadcn@latest add @knowns-ui/<name>` works with nothing added to components.json. The manual install guide, the Install with AI prompts and the setup prompt drop that step; Pro still adds its @knowns-ui-pro entry with the license header. `npx knowns-ui@latest init` is unchanged and still writes both entries, which keeps older shadcn CLIs working.
- **Hero motion and polish** `hero`
  Hero's ghost icon button no longer scales on press, and its transitions use the shared motion tokens.
- **Hover card shares the floating panel look** `hover-card`
  The hover card now uses the same radius, hairline ring, shadow and 12px padding as the menu and popover.
- **Input motion and polish** `input`
  Input fields share one surface timing: 180ms for the ring and 120ms for hover, both on ease-out.
- **Leftover motion timings use the shared tokens** `agent-monitor`, `aurora`, `gradient-floor`
  Agent Monitor, Aurora and Gradient Floor now use the shared motion timings and easing curves instead of private ones. Looks and behaviour stay the same, with steadier hover and fold timing.
- **Logo cloud motion and polish** `logo-cloud`
  Logo cloud logos sit at a calmer opacity and use the shared motion tokens.
- **Marketing core motion and polish** `marketing-core`
  Marketing core helpers use the shared motion tokens.
- **Menu shares the floating panel look** `menu`
  The menu panel takes its radius, hairline ring and shadow from one shared floating surface, and its transitions use the motion tokens.
- **Notification center motion and polish** `notification-center`
  Notification center uses the shared motion tokens.
- **Onboarding checklist motion and polish** `onboarding-checklist`
  Onboarding checklist pops its done mark on the shared 280ms token.
- **Otp input motion and polish** `otp-input`
  OTP cells fade their ring on the motion tokens.
- **Password field motion and polish** `password-field`
  The reveal icon pop runs on the 120ms token.
- **Password strength motion and polish** `password-strength`
  The strength bars fill over 280ms on the in-out curve, the checklist and label use 180ms, and the one-time sheen is 280ms instead of 900ms. The demo is now a sign-up form with a prefilled account.
- **Popover shares the floating panel look** `popover`
  The popover now uses the same radius, hairline ring and shadow as the menu and hover card.
- **Progress: light-band sweep, lg size, value labels and RTL** `progress`
  The indeterminate bar is now a band of light with a glow, the bar has an 8px size, the ring takes any pixel size, and value text can go through Intl or sit on the label row with a helper line below. The fill grows from the right inside dir="rtl", and reduced motion parks the sweep mid-rail.
- **Radio group motion and polish** `radio-group`
  The radio dot and its focus ring use the same hairline ring as text fields.
- **Resizable motion and polish** `resizable`
  Resizable handles and panels name their timing: 120ms colour, 180ms size.
- **Search results motion and polish** `search-results`
  Search results rows use the shared motion tokens.
- **Segmented control motion and polish** `segmented-control`
  The segmented thumb moves over 120ms on the in-out curve, and its labels fade on ease-out.
- **Settings api keys motion and polish** `settings-api-keys`
  Settings API keys lines up the key, its scopes and its dates in columns on wide containers.
- **Settings layout motion and polish** `settings-layout`
  Settings layout fades the edges of its tab strip on a phone so the clipped tabs read as scrollable.
- **Sheet enters and leaves on the same curve** `sheet`
  The sheet now slides in over 280ms and out over about two thirds of that, on one easing in both directions, and its backdrop fades with it. Before, the exit used a slower, different curve.
- **Shimmer Text: one step in an agent status card** `shimmer-text`
  The demo puts one shimmering step label inside an agent status card with steps, elapsed time and cost, and turns plain when the step is done. The announcement pill has its own example.
- **Shine border motion and polish** `shine-border`
  Shine border fades on the 180ms token and the shared ease-out curve.
- **Sidebar docs motion and polish** `sidebar-docs`
  Sidebar docs folds and chevrons use the shared motion tokens.
- **Sidebar motion and polish** `sidebar`
  Sidebar switches between full and rail width at once and fades its labels, so no layout is animated.
- **Site footer motion and polish** `site-footer`
  Site footer links fade on the shared 120ms token and ease-out.
- **Site header motion and polish** `site-header`
  Site header's mobile drawer slides in over 280ms on ease-out and leaves in about two thirds of that.
- **Skeleton demo: a report that loads** `skeleton`
  The Skeleton page now opens with a billing report card that loads and resolves into the finished card without moving anything, with a Reload button to replay it.
- **Skeleton motion and polish** `skeleton`
  The skeleton fade uses the 180ms token and ease-out instead of a fixed 220ms.
- **Skill chips compact on narrow widths** `chat-composer`
  Under 420px the `ComposerSkills` chips use less padding, a 6px gap and a smaller bracket glyph, so the command names fit two to a row on a phone.
- **Slider motion and polish** `slider`
  Slider thumb and track transitions use the motion tokens.
- **Stats band motion and polish** `stats-band`
  Stats band uses the shared motion tokens.
- **Stepper motion and polish** `stepper`
  The stepper connector fills over 280ms on the in-out curve, and the step dots fade on the tokens.
- **Tabs motion and polish** `tabs`
  Tab indicators and panels use the motion tokens; the panel focus ring is 2px away like every other control.
- **Tag motion and polish** `tag`
  Tag hover and select colours fade over 120ms on ease-out.
- **Team grid motion and polish** `team-grid`
  Team grid cards use the shared motion tokens.
- **Template docs site motion and polish** `template-docs-site`
  Docs site template uses the shared motion tokens.
- **Textarea motion and polish** `textarea`
  Textarea uses the shared field surface timing.
- **Theme toggle motion and polish** `theme-toggle`
  The theme reveal runs 280ms on ease-out (it was 450ms), and the icon morph no longer shrinks below 90%.
- **Theme Toggle: reveal across a real page, 280ms** `theme-toggle`
  The demo shows the toggle in the header of a small product page that owns its theme, so you see the reveal run across real content. The reveal now defaults to 280ms; pass duration for a longer one.
- **Timeline scrubber motion pass** `timeline-scrubber`
  The marker gets a soft halo while you hold it, a faint ghost dot follows the mouse to show where a click lands, and the card fades in on a click or key move. Opacity and transform only, on the existing tokens, and none of it plays under reduced motion.
- **Toast matches the floating panels** `toast`
  The toast uses the shared floating surface: same radius, hairline ring, shadow and 12px padding. It still enters and leaves from the bottom edge.
- **Toggle group motion and polish** `toggle-group`
  Toggle group buttons fade their colour on the 120ms token.
- **Trace Waterfall: shared motion tokens** `trace-waterfall`
  Animations now use the shared duration and easing tokens (nothing over 280ms except named canvas travel) and finish at once under reduced motion.
- **Uptime bar motion and polish** `uptime-bar`
  Uptime bar has a quiet option that softens the up days so trouble stands out.
- **Used for, What it handles, States and Works with on every Free page** `agent-graph`, `agent-lanes`, `tool-call-card`, `context-window`, `trace-waterfall`, `agent-monitor`, `agent-fleet`, `agent-handoff`, `agent-cursors`, `agent-plan`, `ai-answer`, `message-actions`, `chat-composer`, `conversation-list`, `ghost-text`, `thinking-state`, `avatar`, `data-table`, `uptime-bar`, `animated-number`, `badge`, `tag`, `card`, `kbd`, `code-block`, `separator`, `resizable`, `progress`, `accordion`, `skeleton`, `spinner`, `status-dot`, `shine-border`, `custom-cursor`, `parallax-card`, `fan-stack`, `button`, `dropdown`, `menu`, `segmented-control`, `theme-toggle`, `toggle-group`, `user-menu`, `input`, `textarea`, `select`, `combobox`, `checkbox`, `radio-group`, `switch`, `slider`, `file-drop`, `date-picker`, `date-range-picker`, `otp-input`, `password-field`, `password-strength`, `time-slots`, `dialog`, `sheet`, `alert`, `command-menu`, `popover`, `hover-card`, `tooltip`, `toast`, `tabs`, `stepper`, `breadcrumb`, `pagination`, `catalog-grid`, `hero`, `sidebar`, `app-shell`, `error-pages`, `testimonials`, `team-grid`, `notification-center`, `activity-feed`, `onboarding-checklist`, `setup-wizard`, `cookie-consent`, `template-saas-landing`, `template-app-dashboard`, `template-docs-site`, `auth-card`, `settings-layout`, `site-header`, `site-footer`, `announcement-bar`, `logo-cloud`, `feature-grid`, `stats-band`, `cta-section`, `faq-section`, `newsletter`, `contact-section`, `blog-grid`, `blog-post`, `changelog-feed`, `search-results`, `empty-states`, `run-pulse`, `tool-beam`, `prompt-to-team`, `model-reel`, `model-orbit`, `tab-overload`
  Every Free component, block and illustration page now says what it is used for, six things it handles, how each state moves with the real timing, and which other items it works with. Each page loads only its own text.
- **User menu looks and moves like the other menus** `user-menu`
  The panel uses the shared floating surface, and the phone bottom sheet now enters over 280ms and leaves over about two thirds of that. The docs demo is a realistic app header with a deployments list.

### Fixed

- **Agent fleet no longer crashes on an agent without a known state** `agent-fleet`
  Opening the tree of an agent whose sub-agents had no `state`, or a state outside `queued`, `running`, `waiting`, `done`, `failed` and `stopped`, threw React error 130 (element type undefined) and blanked the page, because the state pill looked its icon up by state. Such an agent is now drawn as queued, in the pill, the card's accessible name and the sub-agent counts. Agents without `tools` were never the cause and open as before.
- **Agent fleet passes strict index** `agent-fleet`
  The agent fleet now type-checks in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Agent graph passes strict index** `agent-graph`
  The agent graph and its layout, routing and pulse code now type-check in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Agent handoff passes strict index** `agent-handoff`
  The agent handoff now type-checks in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Approval history wraps instead of cutting** `approval-prompt`
  A decided row in the approval history wraps its title onto a second line instead of cutting it off, so a narrow column still shows what was approved.
- **Avatar compiles under noUncheckedIndexedAccess** `avatar`
  The initials helper no longer reads a word without checking it, so `avatar` type-checks in apps that turn on `noUncheckedIndexedAccess`. The initials are the same as before.
- **Backgrounds compile under noUncheckedIndexedAccess** `aurora`, `cube-field`, `dither-field`, `flickering-grid`, `gradient-floor`, `grid-pattern`, `node-field`, `backgrounds-core`
  The animated backgrounds and their shared helpers no longer read an array or typed-array slot without checking it, so they type-check in apps that turn on `noUncheckedIndexedAccess`. Nothing draws or moves differently.
- **Calendar keeps a range whole across blocked days** `calendar`
  A blocked day inside a selected range, such as a weekend, is now muted in the band without the strikethrough, so the range reads as one piece. Blocked days outside a range keep their strikethrough.
- **Catalog grid passes strict index** `catalog-grid`
  The catalog grid now type-checks in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Chart compiles under noUncheckedIndexedAccess** `chart`
  Chart, its helpers and the sparkline now type-check in apps that turn on `noUncheckedIndexedAccess`. Every array lookup is guarded or narrowed; nothing renders differently and the props are the same.
- **Content core passes strict index** `content-core`
  The shared content helpers and prose pieces now type-check in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Context window bar moves with its numbers** `context-window`
  The bar used to snap to each new size while the percentage rolled. Segments now slide to their new span in 280ms (in-out), together with the warn and full ticks, the percentage and the legend values, and the hatched reserve keeps its stripes. A change of state no longer moves the legend: its row keeps its height and the words fade in over 120ms. When the conversation is summarised its row stays and only the label swaps. The cell view changes colour in 120ms with no stagger.
- **Context window passes strict index** `context-window`
  The context window now type-checks in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Core lib passes strict index** `knowns-core`, `knowns-icons`, `motion`
  The run store, status helpers, icon lookups and motion helpers now type-check in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Dither Field redraws a picture without reloading it** `dither-field`
  In picture mode, changing `cell`, `levels` or `blur` used to fetch and decode the whole picture again each time, so dragging a slider over a phone photo stalled. The picture is now decoded once, a copy of at most 2560 px is kept, and a change redraws at most once per frame.
- **Free illustrations compile under noUncheckedIndexedAccess** `empty-states`, `run-pulse`, `tool-beam`, `model-orbit`, `tab-overload`, `illustrations-core`
  The shared helpers and the Free illustrations no longer read an array or typed-array slot without checking it, so they type-check in apps that turn on `noUncheckedIndexedAccess`. `illustrations-core` gains `hueAt` (the agent palette colour for a slot, wrapping around) and `nth` (an index the caller knows is in range). Nothing draws or moves differently.
- **Indeterminate progress ships its keyframes** `knowns-core`, `progress`
  The knowns-core css now includes the kn-sweep and kn-sweep-rtl keyframes, so an installed Progress with no value moves instead of sitting still. A test keeps knowns-core in step with the stylesheet from now on.
- **Marketing helpers pass strict index** `marketing-core`, `marketing-2b-core`, `testimonials`
  The stats parser, masonry columns and testimonials now type-check in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Menus and popovers place correctly inside a sheet** `knowns-floating`
  `useFloating` now takes the origin of a transformed ancestor into account (a sheet dialog always carries a `translate`), so a dropdown, menu or popover opened inside a side sheet lands on its trigger instead of far to the right.
- **More components pass strict index** `agent-cursors`, `agent-lanes`, `agent-monitor`, `ai-answer`, `chat-composer`, `code-block`, `command-menu`, `message-actions`, `thinking-state`, `typewriter`, `uptime-bar`
  These components now type-check in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Narrow graph names wrap instead of being cut** `agent-graph`
  On a phone-width AgentGraph the node names wrap to two lines at their own words, and the leaf columns are a little wider, so "Policy lookup" and "Escalation" are no longer cut to "Policy lo…" and "Escalati…".
- **Pro accounts see the Pro install steps without clicking** `installation`
  A signed-in Pro account now sees the @knowns-ui-pro install steps on a Pro component's docs page straight away, with no "I have a license" click. While the site is still working out the plan, the block shows a quiet placeholder instead of the lock. Signed-out and Free visitors keep the gate.
- **Segmented control passes strict index** `segmented-control`
  The segmented control now type-checks in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Settings, sidebar, app shell and chat list pass strict index** `settings-license-key`, `settings-notifications`, `sidebar`, `app-shell`, `conversation-list`
  These blocks now type-check in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Sidebar counts group thousands** `sidebar`
  A count on a sidebar row reads 1,284 instead of 1284, in a fixed locale so the server and the client agree.
- **Site header passes strict index** `site-header`
  These blocks now type-check in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Slider thumb blocks browser gestures itself** `slider`
  The thumb now sets its own `touch-action: none` and the track turns off the touch callout, so Safari on iPhone no longer depends on the parent for a finger drag, and a drag is not taken for a page scroll.
- **Small controls pass strict index** `combobox`, `date-picker`, `date-range-picker`, `file-drop`, `menu`, `password-strength`, `radio-group`, `resizable`, `shine-border`, `slider`, `stepper`, `tabs`, `tag`, `toggle-group`, `user-menu`
  These controls now type-check in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Stable activity clock and an idempotent core install** `live-activity`, `knowns-core`
  `ActivityStatus` and `ActivityCountdown` no longer restart their one second interval when a new `Date` of the same instant arrives on every render. Installing any item that depends on `knowns-core` no longer appends the `@property --kn-fade-l` and `--kn-fade-r` rules to your CSS again each time: the two lengths are registered from `lib/knowns/utils.ts` instead, and the edge fade rule and keyframes stay keyed, so a repeat install is a no-op. If you already have repeated copies, delete all but one, or all of them.
- **Trace waterfall passes strict index** `trace-waterfall`
  The trace waterfall now type-checks in apps that turn on `noUncheckedIndexedAccess`. Behaviour and props are unchanged.
- **Trace waterfall title no longer collapses on a narrow screen** `trace-waterfall`
  At about 390px the header title shrank to a single letter while the filters and search kept their width. The title now has its own row below a container width and truncates with an ellipsis, with the full text in its tooltip and accessible name, and the controls wrap under it.

### Pro

- A plan button that posts a form (Pro): https://ui.knowns.dev/changelog#0.9.3-pricing-cta-form
- A rel on pricing buttons (Pro): https://ui.knowns.dev/changelog#0.9.3-pricing-cta-rel
- Activity stack, many agents at a glance (Pro): https://ui.knowns.dev/changelog#0.9.3-activity-stack-pro
- Activity stack: label, pause on interact, announce (Pro): https://ui.knowns.dev/changelog#0.9.3-activity-stack-a11y
- Agent activities, capsules for running agents (Pro): https://ui.knowns.dev/changelog#0.9.3-agent-activities-pro
- Agent inbox (Pro): https://ui.knowns.dev/changelog#0.9.3-agent-inbox
- Agent Landing template (Pro): https://ui.knowns.dev/changelog#0.9.3-template-agent-landing
- Agent launcher block (Pro): https://ui.knowns.dev/changelog#0.9.3-agent-launcher-pro
- Agent Ops template (Pro): https://ui.knowns.dev/changelog#0.9.3-template-agent-ops
- Call overlay, live levels and transcript (Pro): https://ui.knowns.dev/changelog#0.9.3-call-overlay-live
- Citations for AI answers (Pro): https://ui.knowns.dev/changelog#0.9.3-citations
- Dither charts (Pro): https://ui.knowns.dev/changelog#0.9.3-dither-charts
- Emoji lens, a headline that turns into emoji under the pointer (Pro): https://ui.knowns.dev/changelog#0.9.3-emoji-lens
- Event calendar (Pro): https://ui.knowns.dev/changelog#0.9.3-event-calendar-pro
- Finished runs can say Done quietly (Pro): https://ui.knowns.dev/changelog#0.9.3-run-activity-quiet-done
- Gradebook and Student Progress (Pro): https://ui.knowns.dev/changelog#0.9.3-gradebook
- Grouped list (Pro): https://ui.knowns.dev/changelog#0.9.3-grouped-list
- Heatmap Card (Pro): https://ui.knowns.dev/changelog#0.9.3-heatmap-card
- Live Metrics (Pro): https://ui.knowns.dev/changelog#0.9.3-live-metrics
- Live Results (Pro): https://ui.knowns.dev/changelog#0.9.3-live-results
- Media dock, a floating player you can drag (Pro): https://ui.knowns.dev/changelog#0.9.3-media-dock
- Now Playing Pro (Pro): https://ui.knowns.dev/changelog#0.9.3-now-playing-pro
- Page Header icon tile and segmented progress (Pro): https://ui.knowns.dev/changelog#0.9.3-page-header-icon-progress
- Page Header tabs line up with the title (Pro): https://ui.knowns.dev/changelog#0.9.3-page-header-tabs-flush
- PiP video card for the media dock (Pro): https://ui.knowns.dev/changelog#0.9.3-pip-video-card
- Prompt editor with variables, ghost text and a token count (Pro): https://ui.knowns.dev/changelog#0.9.3-prompt-editor
- Prose Diff read-only mode and collapsed unchanged text (Pro): https://ui.knowns.dev/changelog#0.9.3-prose-diff-read
- Quiz Builder (Pro): https://ui.knowns.dev/changelog#0.9.3-quiz-builder
- Quiz Player (Pro): https://ui.knowns.dev/changelog#0.9.3-quiz-player
- Ring reel (Pro): https://ui.knowns.dev/changelog#0.9.3-ring-reel
- Run budget and board block (Pro): https://ui.knowns.dev/changelog#0.9.3-run-budget-board
- Run overview block (Pro): https://ui.knowns.dev/changelog#0.9.3-run-overview
- Run trace block (Pro): https://ui.knowns.dev/changelog#0.9.3-run-trace
- Scroll-over hero (Pro): https://ui.knowns.dev/changelog#0.9.3-scroll-over-hero
- Share Bar (Pro): https://ui.knowns.dev/changelog#0.9.3-share-bar
- Spend Overview template (Pro): https://ui.knowns.dev/changelog#0.9.3-template-spend-overview
- Stream Overlay (Pro): https://ui.knowns.dev/changelog#0.9.3-stream-overlay
- Table query builder (Pro): https://ui.knowns.dev/changelog#0.9.3-table-query-builder
- Task detail drawer (Pro): https://ui.knowns.dev/changelog#0.9.3-task-detail-drawer
- Task drawer fits your vocabulary (Pro): https://ui.knowns.dev/changelog#0.9.3-task-drawer-api
- Agent activity globe redesign (Pro): https://ui.knowns.dev/changelog#0.9.3-agent-globe-redesign
- Agent board hides empty columns (Pro): https://ui.knowns.dev/changelog#0.9.3-agent-board-hide-empty
- Agent builder gets a two column layout (Pro): https://ui.knowns.dev/changelog#0.9.3-app-agent-builder-wide
- Agent builder motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-agent-builder
- Agent health motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-agent-health
- Agent Memory: quieter rows (Pro): https://ui.knowns.dev/changelog#0.9.3-b5-agent-memory
- Agent Ops dashboard is now the template (Pro): https://ui.knowns.dev/changelog#0.9.3-dashboard-agent-ops
- Agent ops page fills its columns and reads cleaner (Pro): https://ui.knowns.dev/changelog#0.9.3-agent-ops-polish
- Agent run pivot motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-agent-run-pivot
- Agent Tree: shared motion tokens, demo opens mid-run (Pro): https://ui.knowns.dev/changelog#0.9.3-b5-agent-tree
- Agent Tree: spend counts with the shared ticker (Pro): https://ui.knowns.dev/changelog#0.9.3-b5b-counts
- Ai service status motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-ai-service-status
- Autonomy Dial: shared motion tokens, rotating needle (Pro): https://ui.knowns.dev/changelog#0.9.3-b5-autonomy-dial
- Branch Conflicts: scroll cue on narrow screens (Pro): https://ui.knowns.dev/changelog#0.9.3-b5-branch-conflicts
- Branch Graph: shared motion tokens (Pro): https://ui.knowns.dev/changelog#0.9.3-b5-branch-graph
- Changelog timeline motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-changelog-timeline
- Computer use viewer motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-computer-use-viewer
- Document extract motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-document-extract
- Eval Suite: numbers count with the shared ticker (Pro): https://ui.knowns.dev/changelog#0.9.3-b5b-eval-suite
- Eval Suite: shared motion tokens (Pro): https://ui.knowns.dev/changelog#0.9.3-b5-eval-suite
- EventCalendar events drop the coloured side stripe (Pro): https://ui.knowns.dev/changelog#0.9.3-event-calendar-no-stripe
- Heatmap card row labels follow a translucent surface (Pro): https://ui.knowns.dev/changelog#0.9.3-heatmap-card-surface
- Help center motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-help-center
- Hero product motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-hero-product
- Hero Statement leads with the product (Pro): https://ui.knowns.dev/changelog#0.9.3-hero-statement-product-strip
- Inline Diff reads calmer (Pro): https://ui.knowns.dev/changelog#0.9.3-polish-b6-free
- Knowledge sources motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-knowledge-sources
- Logo marquee motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-logo-marquee
- Map view motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-map-view
- Metric card can leave out its menu (Pro): https://ui.knowns.dev/changelog#0.9.3-metric-card-no-menu
- Model Arena: steady card height, word count (Pro): https://ui.knowns.dev/changelog#0.9.3-b5-model-arena
- Node graph editor demo fits its canvas (Pro): https://ui.knowns.dev/changelog#0.9.3-app-node-graph-editor-layout
- Node graph editor fits whole on a phone (Pro): https://ui.knowns.dev/changelog#0.9.3-app-node-graph-editor-phone
- Node graph editor motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-node-graph-editor
- Pricing calculator motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-pricing-calculator
- Pricing card motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-pricing-card
- Pricing faq motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-pricing-faq
- Pricing plans motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-pricing-plans
- Pro AI components use the shared motion timing (Pro): https://ui.knowns.dev/changelog#0.9.3-motion-b6-pro
- Pro leftovers on shared timing, calmer map labels (Pro): https://ui.knowns.dev/changelog#0.9.3-sweep-pro
- Pro polish for writing, diff, citations and maps (Pro): https://ui.knowns.dev/changelog#0.9.3-polish-b6-pro
- Screen chat composer lines up with the messages (Pro): https://ui.knowns.dev/changelog#0.9.3-app-screen-chat-axis
- Screen chat demo opens on a finished exchange (Pro): https://ui.knowns.dev/changelog#0.9.3-app-screen-chat-rest
- Screen chat motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-screen-chat
- Task detail motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-task-detail
- Task Flow: finished scene at rest (Pro): https://ui.knowns.dev/changelog#0.9.3-task-flow
- Team list motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-team-list
- Team showcase motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-team-showcase
- Team Showcase: real photos and quieter cards (Pro): https://ui.knowns.dev/changelog#0.9.3-team-showcase
- Testimonials carousel motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-testimonials-carousel
- Testimonials Quote: company, context and metrics (Pro): https://ui.knowns.dev/changelog#0.9.3-testimonials-quote
- Testimonials stage motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-testimonials-stage
- Usage Meter: numbers count with the shared ticker (Pro): https://ui.knowns.dev/changelog#0.9.3-b5b-usage-meter
- Usage Meter: one accent family (Pro): https://ui.knowns.dev/changelog#0.9.3-b5-usage-meter
- Webhooks motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-webhooks
- Workflow builder motion and polish (Pro): https://ui.knowns.dev/changelog#0.9.3-app-workflow-builder
- Activity stack clock keeps ticking (Pro): https://ui.knowns.dev/changelog#0.9.3-activity-stack-clock-pro
- Activity stack: stale open id, cancelled with actions, dismiss reason (Pro): https://ui.knowns.dev/changelog#0.9.3-activity-stack-dismiss
- Adapters pass strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-lib-pro-strict-index
- Agent globe passes strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-agent-globe-pro-strict-index
- Agent health and agent run pivot pass strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-analytics-pro-strict-index
- Agent tree passes strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-agent-tree-pro-strict-index
- Branch graph and branch conflicts pass strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-branch-pro-strict-index
- Changelog timeline passes strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-changelog-timeline-pro-strict-index
- Citation chip digit is larger (Pro): https://ui.knowns.dev/changelog#0.9.3-grounded-answer-chip-digit
- Context treemap passes strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-context-treemap-pro-strict-index
- Diff helpers compile under noUncheckedIndexedAccess (Pro): https://ui.knowns.dev/changelog#0.9.3-diff-strict-index
- Document extract passes strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-document-extract-pro-strict-index
- Kanban board compiles under noUncheckedIndexedAccess (Pro): https://ui.knowns.dev/changelog#0.9.3-strict-index-kanban
- Kanban compiles under noUncheckedIndexedAccess (Pro): https://ui.knowns.dev/changelog#0.9.3-kanban-strict-index
- Map view passes strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-map-view-pro-strict-index
- MCP servers, rows follow their own width (Pro): https://ui.knowns.dev/changelog#0.9.3-mcp-servers-container
- Model arena passes strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-model-arena-pro-strict-index
- More blocks pass strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-blocks-pro-strict-index
- More Pro components pass strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-components-pro-strict-index
- Operations blocks pass strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-operations-strict-index
- Page header compiles under strict indexing (Pro): https://ui.knowns.dev/changelog#0.9.3-page-header-strict
- Page header, the primary action keeps its label on phones (Pro): https://ui.knowns.dev/changelog#0.9.3-page-header-primary-label
- Pricing blocks pass strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-pricing-pro-strict-index
- Pro illustrations compile under noUncheckedIndexedAccess (Pro): https://ui.knowns.dev/changelog#0.9.3-strict-index-illustrations-pro
- Prose Diff and Change Summary compile under noUncheckedIndexedAccess (Pro): https://ui.knowns.dev/changelog#0.9.3-prose-diff-strict-index
- Task detail compiles under noUncheckedIndexedAccess (Pro): https://ui.knowns.dev/changelog#0.9.3-strict-index-task-detail
- Task drawer names, contrast and edge (Pro): https://ui.knowns.dev/changelog#0.9.3-task-drawer-a11y
- Team showcase and testimonials stage pass strict index (Pro): https://ui.knowns.dev/changelog#0.9.3-marketing-pro-strict-index

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
