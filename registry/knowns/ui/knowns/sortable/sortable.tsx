"use client";
/** @registry name="sortable" type="ui" title="Sortable" description="A list you reorder by dragging or from the keyboard: whole row or a handle, screen-reader announcements for every move, a lifted look on pick-up and a 180ms settle." */
/*
 * Adapted from the Sortable of Dice UI (MIT, https://github.com/sadmann7/diceui), which wraps dnd-kit.
 * Copyright (c) 2025 Dice UI contributors. Permission is granted under the MIT licence; this notice stays with the code.
 * Changes: Knowns tokens and kn-motion timing, a settle through dnd-kit's own transition (no drag overlay), labelled
 * announcements and one vertical or horizontal axis.
 */

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DndContextProps,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  KeyboardSensor,
  PointerSensor,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis, restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createContext, type ComponentProps, type ReactNode, useCallback, useContext, useId, useMemo } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { EASE, MOTION, prefersReducedMotion } from "@/registry/knowns/lib/knowns/motion";

type Orientation = "vertical" | "horizontal";

/** The sentences a screen reader hears. Pure, so they can be tested and replaced. */
export function sortableAnnouncements(opts: { count: number; label: (id: UniqueIdentifier) => string }): Announcements {
  const { count, label } = opts;
  const pos = (index: number | undefined) => `${(index ?? 0) + 1} of ${count}`;
  return {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}. Position ${pos(active.data.current?.sortable?.index)}. Use the arrow keys to move it, space to drop, escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? `${label(active.id)} moved to position ${pos(over.data.current?.sortable?.index)}.` : `${label(active.id)} is outside the list. Press escape to cancel.`),
    onDragEnd: ({ active, over }) => (over ? `${label(active.id)} dropped at position ${pos(over.data.current?.sortable?.index)}.` : `${label(active.id)} dropped. Nothing changed.`),
    onDragCancel: ({ active }) => `Cancelled. ${label(active.id)} is back at position ${pos(active.data.current?.sortable?.index)}.`,
  };
}

interface Ctx {
  orientation: Orientation;
  handle: boolean;
  label: (id: UniqueIdentifier) => string;
}
const SortableCtx = createContext<Ctx | null>(null);
function useSortableCtx(name: string) {
  const c = useContext(SortableCtx);
  if (!c) throw new Error(`\`${name}\` must be used within \`Sortable\``);
  return c;
}

export interface SortableProps<T> extends Omit<ComponentProps<"ul">, "children" | "onChange"> {
  value: T[];
  onValueChange: (next: T[]) => void;
  /** A unique id for an item. Needed when the items are objects. */
  getItemValue?: (item: T) => UniqueIdentifier;
  /** What a screen reader calls an item. Default: the id. */
  getItemLabel?: (item: T) => string;
  orientation?: Orientation;
  /** Drag only by a <SortableHandle>; the row itself stays clickable. Default: the whole row drags. */
  handle?: boolean;
  /** Called after a move with the item and its new place. */
  onMove?: (info: { item: T; from: number; to: number }) => void;
  children: (item: T, index: number) => ReactNode;
}

export function Sortable<T>({ value, onValueChange, getItemValue, getItemLabel, orientation = "vertical", handle = false, onMove, children, className, ...rest }: SortableProps<T>) {
  const dndId = useId();
  const idOf = useCallback((item: T): UniqueIdentifier => (getItemValue ? getItemValue(item) : (item as unknown as UniqueIdentifier)), [getItemValue]);
  const ids = useMemo(() => value.map(idOf), [value, idOf]);
  const label = useCallback(
    (id: UniqueIdentifier) => {
      const item = value.find((v) => idOf(v) === id);
      return item === undefined ? String(id) : getItemLabel ? getItemLabel(item) : String(id);
    },
    [value, idOf, getItemLabel],
  );

  // A short press-and-move distance keeps a click on a row from starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const from = ids.indexOf(active.id);
      const to = ids.indexOf(over.id);
      const item = value[from];
      if (from < 0 || to < 0 || item === undefined) return;
      onValueChange(arrayMove(value, from, to));
      onMove?.({ item, from, to });
    },
    [ids, value, onValueChange, onMove],
  );

  const announcements = useMemo(() => sortableAnnouncements({ count: value.length, label }), [value.length, label]);
  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: `To pick up an item, press space or enter. Use the ${orientation === "vertical" ? "up and down" : "left and right"} arrow keys to move it, then space or enter to drop, or escape to cancel.`,
  };
  const modifiers: DndContextProps["modifiers"] = [orientation === "vertical" ? restrictToVerticalAxis : restrictToHorizontalAxis, restrictToParentElement];
  const ctx = useMemo<Ctx>(() => ({ orientation, handle, label }), [orientation, handle, label]);

  return (
    <SortableCtx.Provider value={ctx}>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={modifiers} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions }}>
        <SortableContext items={ids} strategy={orientation === "vertical" ? verticalListSortingStrategy : horizontalListSortingStrategy}>
          <ul data-slot="sortable" data-orientation={orientation} className={cn("flex gap-2", orientation === "vertical" ? "flex-col" : "flex-row", className)} {...rest}>
            {value.map((item, i) => (
              <SortableItem key={String(idOf(item))} id={idOf(item)}>
                {children(item, i)}
              </SortableItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </SortableCtx.Provider>
  );
}

interface ItemCtx {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners | undefined;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  dragging: boolean;
}
const ItemCtx = createContext<ItemCtx | null>(null);

function SortableItem({ id, children }: { id: UniqueIdentifier; children: ReactNode }) {
  const { handle, orientation } = useSortableCtx("SortableItem");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    // The neighbours slide and the dropped row settles in 180ms, ease out. Reduced motion: it just lands.
    transition: prefersReducedMotion() ? null : { duration: MOTION.base, easing: EASE.out },
    animateLayoutChanges: () => true,
  });
  const item = useMemo<ItemCtx>(() => ({ attributes, listeners, setActivatorNodeRef, dragging: isDragging }), [attributes, listeners, setActivatorNodeRef, isDragging]);
  const wholeRow = !handle;
  return (
    <ItemCtx.Provider value={item}>
      <li
        ref={setNodeRef}
        data-slot="sortable-item"
        data-dragging={isDragging ? "" : undefined}
        style={{ transform: CSS.Translate.toString(transform), transition: transition ?? undefined }}
        // Lifted look is on at once (the row gets a stronger border and a shadow, no fade): the state is true at frame 0.
        className={cn(
          "relative list-none rounded-lg outline-none",
          orientation === "horizontal" && "shrink-0",
          wholeRow && "touch-none select-none cursor-grab focus-visible:ring-2 focus-visible:ring-ring",
          isDragging && "z-10 cursor-grabbing [&>*]:border-ring [&>*]:shadow-lg",
        )}
        {...(wholeRow ? { ...attributes, ...listeners } : {})}
      >
        {children}
      </li>
    </ItemCtx.Provider>
  );
}

/** The grip a row is dragged by when `handle` is set. Put it inside the row; it needs a name for screen readers. */
export function SortableHandle({ className, children, ...rest }: ComponentProps<"button">) {
  const item = useContext(ItemCtx);
  if (!item) throw new Error("`SortableHandle` must be used within `Sortable`");
  return (
    <button
      type="button"
      ref={item.setActivatorNodeRef}
      data-slot="sortable-handle"
      data-dragging={item.dragging ? "" : undefined}
      className={cn(
        "touch-none select-none cursor-grab rounded-md p-1 text-muted-foreground outline-none transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-dragging:cursor-grabbing",
        className,
      )}
      aria-label="Reorder"
      {...item.attributes}
      {...item.listeners}
      {...rest}
    >
      {children ?? (
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
          {[4, 8, 12].flatMap((y) => [5.5, 10.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />))}
        </svg>
      )}
    </button>
  );
}
