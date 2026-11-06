"use client";
/** @registry name="app-shell" type="block" title="App Shell" description="The frame of a signed-in app: a sidebar with a workspace switcher, nav, pinned groups and a footer slot that folds to an icon rail (Cmd or Ctrl+B), and a sticky topbar with breadcrumb, search, notifications and the account menu. A modal sheet on mobile." */

/**
 * App Shell: the frame of a signed-in app. The Sidebar block (workspace switcher, nav tree with counts
 * and badges, pinned groups, a bottom slot for a usage meter or an upgrade card; an icon rail with
 * tooltips, remembered; a sheet on mobile) beside a topbar (sidebar toggle, breadcrumb, search for your
 * Command Menu, a notifications slot, your UserMenu) and the page. ⌘B / Ctrl+B toggles the sidebar.
 */
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Breadcrumb, type BreadcrumbItem } from "../../breadcrumb";
import { Kbd } from "../../kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarNav,
  SidebarProvider,
  SidebarSwitcher,
  SidebarTrigger,
  type SidebarNavProps,
  type SidebarNode,
  type SidebarWorkspace,
} from "../sidebar/sidebar";

export type { SidebarNode, SidebarWorkspace } from "../sidebar/sidebar";

export interface AppShellGroup {
  id: string;
  /** "Pinned", "Favorites"... */
  label: string;
  items: SidebarNode[];
  /** The label folds the group. Default true. */
  collapsible?: boolean;
}

export interface AppShellProps {
  children: ReactNode;
  /** Accessible name of the sidebar. Default "Main". */
  label?: string;

  /* Sidebar */
  /** The workspace switcher at the top. Leave out for a single workspace. */
  workspaces?: SidebarWorkspace[];
  workspace?: string;
  onWorkspaceChange?: (id: string) => void;
  /** Adds "Create workspace" to the switcher. */
  onCreateWorkspace?: () => void;
  /** The main nav tree. */
  nav: SidebarNode[];
  /** The current row id (in nav or any group). */
  active?: string;
  onSelect?: (node: SidebarNode) => void;
  linkAs?: SidebarNavProps["linkAs"];
  /** Pinned items, favourites: labelled groups under the main nav. */
  groups?: AppShellGroup[];
  /** The bottom of the sidebar: a usage meter, an upgrade card. Hidden in the rail. */
  sidebarFooter?: ReactNode;

  /* Topbar */
  breadcrumb?: BreadcrumbItem[];
  /** A search button (⌘K hint from 768px). Open your Command Menu in onOpen. */
  search?: { onOpen: () => void; label?: string };
  /** A notifications button or popover. */
  notifications?: ReactNode;
  /** Extra controls before the user, e.g. a "New" button. */
  actions?: ReactNode;
  /** Your UserMenu. */
  user?: ReactNode;

  /* State */
  /** Remembers the rail and the open branches under this localStorage key. */
  storageKey?: string;
  defaultCollapsed?: boolean;
  /** ⌘B / Ctrl+B toggles the sidebar. Default true. */
  hotkey?: boolean;
  /** Below this width the sidebar is a sheet. Default 768. */
  mobileBelow?: number;
  /**
   * "page" (default): the window scrolls; the sidebar and topbar stick. "fill": the shell fills its
   * parent and the main column scrolls, for an app that owns the whole viewport or a preview frame.
   */
  layout?: "page" | "fill";
  className?: string;
}

const SearchGlyph = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="size-4 shrink-0">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L13.5 13.5" />
  </svg>
);

function TopbarSearch({ onOpen, label = "Search" }: { onOpen: () => void; label?: string }) {
  // Read after mount so the server and the first client render agree.
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)), []);
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="hidden h-8 w-56 items-center gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-2.5 text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 md:flex"
      >
        <SearchGlyph />
        <span className="flex-1 truncate text-left">{label}</span>
        <span className="flex gap-0.5">
          <Kbd size="sm">{mac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd size="sm">K</Kbd>
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:size-11 md:hidden"
      >
        <SearchGlyph />
      </button>
    </>
  );
}

export function AppShell({
  children,
  label = "Main",
  workspaces,
  workspace,
  onWorkspaceChange,
  onCreateWorkspace,
  nav,
  active,
  onSelect,
  linkAs,
  groups = [],
  sidebarFooter,
  breadcrumb,
  search,
  notifications,
  actions,
  user,
  storageKey,
  defaultCollapsed,
  hotkey = true,
  mobileBelow = 768,
  layout = "page",
  className,
}: AppShellProps) {
  const fill = layout === "fill";
  return (
    <SidebarProvider storageKey={storageKey} defaultCollapsed={defaultCollapsed} hotkey={hotkey} mobileBelow={mobileBelow} className={cn(fill ? "h-full min-h-0" : "min-h-dvh", className)}>
      {/* Without a switcher the sheet needs its own top row for the close button. */}
      <Sidebar label={label} sticky={!fill} sheetHeader={workspaces && workspaces.length > 0 ? undefined : label}>
        {workspaces && workspaces.length > 0 && (
          <SidebarHeader>
            <SidebarSwitcher workspaces={workspaces} value={workspace ?? workspaces[0].id} onChange={onWorkspaceChange} onCreate={onCreateWorkspace} />
          </SidebarHeader>
        )}
        <SidebarContent className={cn(!workspaces?.length && "pt-3")}>
          <SidebarNav items={nav} active={active} onSelect={onSelect} linkAs={linkAs} label={label} storageKey={storageKey && `${storageKey}:nav`} />
          {groups.map((g) => (
            <SidebarGroup key={g.id} label={g.label} collapsible={g.collapsible ?? true}>
              <SidebarNav items={g.items} active={active} onSelect={onSelect} linkAs={linkAs} label={g.label} storageKey={storageKey && `${storageKey}:${g.id}`} />
            </SidebarGroup>
          ))}
        </SidebarContent>
        {sidebarFooter && (
          // The slot is hidden in the rail, its hairline and padding with it.
          <SidebarFooter className="group-data-[rail]/sb:hidden">{sidebarFooter}</SidebarFooter>
        )}
      </Sidebar>
      <SidebarInset className={cn(fill && "min-h-0 overflow-y-auto")}>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-[color-mix(in_srgb,var(--background)_88%,transparent)] px-3 backdrop-blur-md sm:px-4">
          <SidebarTrigger className="-ml-1" />
          {breadcrumb && breadcrumb.length > 0 && (
            <>
              <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
              {/* One line in the topbar; below 640px only the current page shows. */}
              <Breadcrumb
                items={breadcrumb}
                size="sm"
                maxItems={3}
                className="min-w-0 [&_ol]:flex-nowrap max-sm:[&_li:not(:last-child)]:hidden max-sm:[&_li:last-child>span[aria-hidden]]:hidden"
              />
            </>
          )}
          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            {search && <TopbarSearch {...search} />}
            {actions}
            {notifications}
            {user}
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
