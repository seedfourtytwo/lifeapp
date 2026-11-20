import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { springOrSnap, timingOrSnap } from '../../utils/motion';
import { moveIdInOrder } from '../../utils/reorderHabits';
import {
  playChartSelectHaptic,
  playReorderDragHaptic,
} from '../../utils/habitHaptics';
import type { HomeTabScrollViewHandle } from './HomeTabScrollView';
import { useAppTheme } from '../../hooks/useAppTheme';

const LONG_PRESS_MS = 380;
const EDGE_SCROLL_ZONE = 48;
const EDGE_SCROLL_STEP = 14;

function sameIdOrder(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  for (const id of b) {
    if (!set.has(id)) return false;
  }
  return true;
}

/** How long a row takes to fade and give up its place — or to open one. */
const EXIT_MS = 180;

const NO_ENTRIES: ReadonlySet<string> = new Set();

/** A row that left `itemIds`, kept on screen while it fades out. */
type LeavingRow = {
  id: string;
  /** The row it stood under, or null at the top. */
  anchor: string | null;
  height: number;
  /** What it last rendered: its owner may no longer be able to render it. */
  node: React.ReactNode;
};

type ExitProps = {
  height: number;
  reduceMotion: boolean;
  onGone: () => void;
  children: React.ReactNode;
};

/**
 * The last moment of a row that left the list: it fades while its place closes
 * under it, so the rows below slide up rather than jump. Height is laid out,
 * so this cannot ride the native driver; it is one row for 180ms.
 */
function ExitingRow({ height, reduceMotion, onGone, children }: ExitProps) {
  const presence = useRef(new Animated.Value(1)).current;
  const exit = useRef({ reduceMotion, onGone });
  exit.current = { reduceMotion, onGone };

  useEffect(() => {
    const leaving = timingOrSnap(
      presence,
      { toValue: 0, duration: EXIT_MS, useNativeDriver: false },
      exit.current.reduceMotion,
    );
    leaving.start(() => exit.current.onGone());
    return () => leaving.stop();
  }, [presence]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.leaving,
        {
          opacity: presence,
          height: presence.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

type EnterProps = {
  reduceMotion: boolean;
  onArrived: () => void;
  children: React.ReactNode;
};

/**
 * The first moment of a row that came into the list after it mounted — an
 * un-ticked habit, a reopened todo: the mirror of `ExitingRow`. Its place
 * opens from nothing while it fades in, so the rows below move down with it.
 * The height to open to is the row's own, measured once it has laid out.
 */
function EnteringRow({ reduceMotion, onArrived, children }: EnterProps) {
  const presence = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState<number | null>(null);
  const entry = useRef({ reduceMotion, onArrived });
  entry.current = { reduceMotion, onArrived };

  useEffect(() => {
    if (height == null) return;
    const arriving = timingOrSnap(
      presence,
      { toValue: 1, duration: EXIT_MS, useNativeDriver: false },
      entry.current.reduceMotion,
    );
    arriving.start(({ finished }) => {
      if (finished) entry.current.onArrived();
    });
    return () => arriving.stop();
  }, [height, presence]);

  return (
    <Animated.View
      style={[
        styles.leaving,
        {
          opacity: presence,
          height:
            height == null
              ? 0
              : presence.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
        },
      ]}
    >
      <View
        onLayout={(event) => {
          const measured = event.nativeEvent.layout.height;
          setHeight((known) => known ?? measured);
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

export type DraggableRenderContext = {
  /**
   * Wire these to the title Pressable so the *same* finger that long-presses
   * can keep moving (no second tap). Do not put them on action buttons.
   * Stable per row id across renders, so memoised rows can take them as props.
   */
  onLongPress: (event: GestureResponderEvent) => void;
  onTouchMove: (event: GestureResponderEvent) => void;
  onTouchEnd: (event: GestureResponderEvent) => void;
  onTouchCancel: (event: GestureResponderEvent) => void;
  delayLongPress: number;
  isDragging: boolean;
  /** False when fewer than two rows can be reordered. */
  canDrag: boolean;
};

type RowGestureHandlers = Pick<
  DraggableRenderContext,
  'onLongPress' | 'onTouchMove' | 'onTouchEnd' | 'onTouchCancel'
>;

type Props = {
  itemIds: readonly string[];
  /** Ids that may be dragged. Defaults to all `itemIds`. */
  draggableIds?: readonly string[];
  onReorder: (nextItemIds: string[]) => void | Promise<void>;
  onDragActiveChange?: (active: boolean) => void;
  scrollRef?: React.RefObject<HomeTabScrollViewHandle | null>;
  renderItem: (id: string, ctx: DraggableRenderContext) => React.ReactNode;
};

/**
 * Long-press drag-and-drop for Home tracker rows.
 * Continues on the activating touch via Pressable onTouchMove/End.
 *
 * A row whose id leaves `itemIds` — a ticked habit, a finished todo — does not
 * blink out: it fades and its place closes (`ExitingRow`). One that arrives
 * after the list mounted opens its place the same way (`EnteringRow`).
 */
export function DraggableTrackerList({
  itemIds,
  draggableIds,
  onReorder,
  onDragActiveChange,
  scrollRef,
  renderItem,
}: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const draggableSet = useMemo(
    () => new Set(draggableIds ?? itemIds),
    [draggableIds, itemIds],
  );

  const [order, setOrder] = useState<string[]>(() => [...itemIds]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<LeavingRow[]>([]);
  /** Ids that arrived after mount and are still opening their place. */
  const [entering, setEntering] = useState<ReadonlySet<string>>(NO_ENTRIES);
  /** Each row's latest render, kept so a row can still be drawn once it has left. */
  const lastNodesRef = useRef(new Map<string, React.ReactNode>());

  const orderRef = useRef(order);
  const itemIdsRef = useRef(itemIds);
  const draggingIdRef = useRef<string | null>(null);
  const hoverIndexRef = useRef(0);
  const originIndexRef = useRef(0);
  const startPageYRef = useRef(0);
  const startScrollYRef = useRef(0);
  const startCenterRef = useRef(0);
  const heightsRef = useRef(heights);
  const dragTranslate = useRef(new Animated.Value(0)).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const dropPulse = useRef(new Animated.Value(0)).current;
  // Via a ref: the gesture callbacks below are memoised and close over it once.
  const reduceMotionRef = useRef(false);
  reduceMotionRef.current = useReduceMotion();
  const edgeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPageYRef = useRef(0);
  const movedDuringDragRef = useRef(false);
  /** Optimistic order after drop until parent `itemIds` catches up from the store. */
  const pendingOrderRef = useRef<string[] | null>(null);
  const onDragActiveChangeRef = useRef(onDragActiveChange);
  onDragActiveChangeRef.current = onDragActiveChange;

  orderRef.current = order;
  itemIdsRef.current = itemIds;
  draggingIdRef.current = draggingId;
  hoverIndexRef.current = hoverIndex;
  heightsRef.current = heights;

  /**
   * Take the parent's ids as the order. Rows that are no longer among them are
   * handed to `leaving`, each under the surviving row it stood below.
   */
  const adopt = useCallback((next: readonly string[]) => {
    const staying = new Set(next);
    const gone: LeavingRow[] = [];
    /** Each departing id → the staying row above it. */
    const anchors = new Map<string, string | null>();
    let anchor: string | null = null;
    for (const id of orderRef.current) {
      if (staying.has(id)) {
        anchor = id;
        continue;
      }
      anchors.set(id, anchor);
      const height = heightsRef.current[id];
      const node = lastNodesRef.current.get(id);
      // Never measured or never drawn: nothing to fade.
      if (height != null && height > 0 && node != null) gone.push({ id, anchor, height, node });
    }
    if (gone.length > 0) {
      setLeaving((current) => [
        ...current
          .filter((row) => !staying.has(row.id) && !anchors.has(row.id))
          // A row still fading under one that now leaves moves up with it.
          .map((row) =>
            row.anchor != null && anchors.has(row.anchor)
              ? { ...row, anchor: anchors.get(row.anchor) ?? null }
              : row,
          ),
        ...gone,
      ]);
    }
    // Rows that were not here a moment ago open their place rather than pop
    // in. Never on mount — this only runs once the list already has an order —
    // and with motion reduced they are simply there.
    const before = new Set(orderRef.current);
    const arrived = next.filter((id) => !before.has(id));
    if (arrived.length > 0 && !reduceMotionRef.current) {
      setEntering((current) => new Set([...current, ...arrived]));
    }
    setOrder([...next]);
  }, []);

  const settleEntry = useCallback((id: string) => {
    setEntering((current) => {
      if (!current.has(id)) return current;
      const rest = new Set(current);
      rest.delete(id);
      return rest.size > 0 ? rest : NO_ENTRIES;
    });
  }, []);

  useEffect(() => {
    if (draggingId) return;

    const pending = pendingOrderRef.current;
    if (pending) {
      if (sameIdOrder(itemIds, pending)) {
        pendingOrderRef.current = null;
        adopt(itemIds);
        return;
      }
      // Persist may land while parent re-parks non-draggable rows (e.g. done habits).
      const pendingPeers = pending.filter((id) => draggableSet.has(id));
      const propPeers = itemIds.filter((id) => draggableSet.has(id));
      if (sameIdOrder(pendingPeers, propPeers) && sameIdSet(itemIds, pending)) {
        pendingOrderRef.current = null;
        adopt(itemIds);
        return;
      }
      // Membership changed (archive / filter) — abandon optimistic hold.
      if (!sameIdSet(itemIds, pending)) {
        pendingOrderRef.current = null;
        adopt(itemIds);
      }
      return;
    }

    if (!sameIdOrder(orderRef.current, itemIds)) adopt(itemIds);
  }, [adopt, draggableSet, itemIds, draggingId]);

  const canDrag = draggableSet.size >= 2;

  const cumulativeOffset = useCallback((index: number, ids: string[]) => {
    let y = 0;
    for (let i = 0; i < index; i += 1) {
      y += heightsRef.current[ids[i]] ?? 64;
    }
    return y;
  }, []);

  const clampHoverIndex = useCallback(
    (raw: number, ids: string[], fromIndex: number) => {
      const peerIndexes: number[] = [];
      ids.forEach((id, index) => {
        if (draggableSet.has(id)) peerIndexes.push(index);
      });
      if (peerIndexes.length === 0) return fromIndex;

      let best = peerIndexes[0];
      let bestDist = Math.abs(raw - best);
      for (const index of peerIndexes) {
        const dist = Math.abs(raw - index);
        if (dist < bestDist) {
          best = index;
          bestDist = dist;
        }
      }
      return best;
    },
    [draggableSet],
  );

  const indexFromContentY = useCallback((contentY: number, ids: string[]) => {
    let acc = 0;
    for (let i = 0; i < ids.length; i += 1) {
      const h = heightsRef.current[ids[i]] ?? 64;
      if (contentY < acc + h / 2) return i;
      acc += h;
    }
    return Math.max(0, ids.length - 1);
  }, []);

  const stopEdgeScroll = useCallback(() => {
    if (edgeTimerRef.current) {
      clearInterval(edgeTimerRef.current);
      edgeTimerRef.current = null;
    }
  }, []);

  /** Finger delta + scroll delta so the row stays under the finger while edge-scrolling. */
  const updateDragFromPageY = useCallback(
    (pageY: number) => {
      const ids = orderRef.current;
      const from = originIndexRef.current;
      const scrollNow = scrollRef?.current?.getScrollOffsetY() ?? 0;
      const scrollDelta = scrollNow - startScrollYRef.current;
      const gestureDy = pageY - startPageYRef.current;
      const center = startCenterRef.current + gestureDy + scrollDelta;
      const raw = indexFromContentY(center, ids);
      const nextHover = clampHoverIndex(raw, ids, from);
      if (nextHover !== hoverIndexRef.current) {
        hoverIndexRef.current = nextHover;
        setHoverIndex(nextHover);
      }
      const translateY = gestureDy + scrollDelta;
      dragTranslate.setValue(translateY);
      return gestureDy;
    },
    [clampHoverIndex, dragTranslate, indexFromContentY, scrollRef],
  );

  const tickEdgeScroll = useCallback(() => {
    const handle = scrollRef?.current;
    if (!handle || !draggingIdRef.current) return;
    const pageY = lastPageYRef.current;
    const top = handle.getWindowTop();
    const height = handle.getLayoutHeight();
    const localY = pageY - top;
    let delta = 0;
    if (localY < EDGE_SCROLL_ZONE) delta = -EDGE_SCROLL_STEP;
    else if (localY > height - EDGE_SCROLL_ZONE) delta = EDGE_SCROLL_STEP;
    if (delta === 0) return;
    handle.scrollBy(delta);
    updateDragFromPageY(pageY);
  }, [scrollRef, updateDragFromPageY]);

  const playDropFeedback = useCallback(
    (id: string) => {
      setJustDroppedId(id);
      dropPulse.setValue(0);
      // Zero-duration under reduced motion, so `justDroppedId` still clears.
      Animated.sequence([
        timingOrSnap(
          dropPulse,
          { toValue: 1, duration: 120, useNativeDriver: true },
          reduceMotionRef.current,
        ),
        timingOrSnap(
          dropPulse,
          { toValue: 0, duration: 280, useNativeDriver: true },
          reduceMotionRef.current,
        ),
      ]).start(() => setJustDroppedId(null));
      void playChartSelectHaptic();
    },
    [dropPulse],
  );

  const endDrag = useCallback(
    (commit: boolean) => {
      stopEdgeScroll();
      const id = draggingIdRef.current;
      if (!id) return;

      const from = originIndexRef.current;
      const to = hoverIndexRef.current;
      const ids = orderRef.current;
      const didMove = movedDuringDragRef.current || from !== to;

      const clearDrag = () => {
        dragTranslate.setValue(0);
        dragScale.setValue(1);
        setDraggingId(null);
        draggingIdRef.current = null;
        onDragActiveChangeRef.current?.(false);
      };

      if (commit && from !== to) {
        const next = moveIdInOrder(ids, from, to);
        if (next) {
          pendingOrderRef.current = next;
          setOrder(next);
          clearDrag();
          playDropFeedback(id);
          void Promise.resolve(onReorder(next)).catch(() => {
            pendingOrderRef.current = null;
            if (!draggingIdRef.current) {
              setOrder([...itemIdsRef.current]);
            }
          });
          return;
        }
      }

      pendingOrderRef.current = null;
      Animated.parallel([
        springOrSnap(
          dragTranslate,
          { toValue: 0, useNativeDriver: true, friction: 8, tension: 140 },
          reduceMotionRef.current,
        ),
        springOrSnap(
          dragScale,
          { toValue: 1, useNativeDriver: true, friction: 8, tension: 140 },
          reduceMotionRef.current,
        ),
      ]).start(() => {
        clearDrag();
        if (commit && didMove && from === to) {
          void playChartSelectHaptic();
        }
      });
    },
    [dragScale, dragTranslate, onReorder, playDropFeedback, stopEdgeScroll],
  );

  const startDrag = useCallback(
    (id: string, pageY: number) => {
      if (!canDrag || !draggableSet.has(id)) return;
      if (draggingIdRef.current) return;
      const ids = orderRef.current;
      const from = ids.indexOf(id);
      if (from < 0) return;

      pendingOrderRef.current = null;
      // A drag measures every row: anything still opening its place snaps open.
      setEntering(NO_ENTRIES);
      originIndexRef.current = from;
      hoverIndexRef.current = from;
      startPageYRef.current = pageY;
      lastPageYRef.current = pageY;
      startScrollYRef.current = scrollRef?.current?.getScrollOffsetY() ?? 0;
      const h = heightsRef.current[id] ?? 64;
      startCenterRef.current = cumulativeOffset(from, ids) + h / 2;
      movedDuringDragRef.current = false;
      dragTranslate.setValue(0);
      dragScale.setValue(1);
      setHoverIndex(from);
      setDraggingId(id);
      draggingIdRef.current = id;
      onDragActiveChangeRef.current?.(true);
      void playReorderDragHaptic();

      // The lift cue stays — a picked-up row still reads as lifted — but it
      // arrives instead of growing.
      springOrSnap(
        dragScale,
        { toValue: 1.045, useNativeDriver: true, friction: 6, tension: 160 },
        reduceMotionRef.current,
      ).start();

      stopEdgeScroll();
      edgeTimerRef.current = setInterval(tickEdgeScroll, 32);
    },
    [
      canDrag,
      cumulativeOffset,
      draggableSet,
      dragScale,
      dragTranslate,
      scrollRef,
      stopEdgeScroll,
      tickEdgeScroll,
    ],
  );

  const onDragTouchMove = useCallback(
    (id: string, event: GestureResponderEvent) => {
      if (draggingIdRef.current !== id) return;
      const pageY = event.nativeEvent.pageY;
      const gestureDy = pageY - startPageYRef.current;
      if (Math.abs(gestureDy) > 4) movedDuringDragRef.current = true;
      lastPageYRef.current = pageY;
      updateDragFromPageY(pageY);
    },
    [updateDragFromPageY],
  );

  const onDragTouchEnd = useCallback(
    (id: string) => {
      if (draggingIdRef.current !== id) return;
      endDrag(true);
    },
    [endDrag],
  );

  const onDragTouchCancel = useCallback(
    (id: string) => {
      if (draggingIdRef.current !== id) return;
      endDrag(false);
    },
    [endDrag],
  );

  // One handler set per row id, created once: rows render memoised cards, and a
  // fresh closure per render would defeat the memo on every list render. The
  // handlers call through a ref so they always reach the current callbacks.
  const gestureHandlersRef = useRef({ startDrag, onDragTouchMove, onDragTouchEnd, onDragTouchCancel });
  gestureHandlersRef.current = { startDrag, onDragTouchMove, onDragTouchEnd, onDragTouchCancel };
  const rowHandlersRef = useRef(new Map<string, RowGestureHandlers>());
  const rowHandlersFor = useCallback((id: string): RowGestureHandlers => {
    const cached = rowHandlersRef.current.get(id);
    if (cached) return cached;
    const handlers: RowGestureHandlers = {
      onLongPress: (event) => {
        gestureHandlersRef.current.startDrag(id, event.nativeEvent.pageY);
      },
      onTouchMove: (event) => gestureHandlersRef.current.onDragTouchMove(id, event),
      onTouchEnd: () => gestureHandlersRef.current.onDragTouchEnd(id),
      onTouchCancel: () => gestureHandlersRef.current.onDragTouchCancel(id),
    };
    rowHandlersRef.current.set(id, handlers);
    return handlers;
  }, []);

  useEffect(
    () => () => {
      stopEdgeScroll();
      if (draggingIdRef.current) {
        draggingIdRef.current = null;
        onDragActiveChangeRef.current?.(false);
      }
    },
    [stopEdgeScroll],
  );

  // If persist never catches up (failure / no-op), drop the optimistic hold.
  useEffect(() => {
    if (!pendingOrderRef.current) return;
    const timer = setTimeout(() => {
      if (!pendingOrderRef.current) return;
      pendingOrderRef.current = null;
      if (!draggingIdRef.current) {
        setOrder([...itemIdsRef.current]);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [order, itemIds]);

  const onRowLayout = useCallback((id: string, event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setHeights((prev) => {
      if (prev[id] === next) return prev;
      return { ...prev, [id]: next };
    });
  }, []);

  // Drop layout cache (and row handlers) for ids that left the list.
  useEffect(() => {
    const live = new Set(order);
    for (const id of [...rowHandlersRef.current.keys()]) {
      if (!live.has(id)) rowHandlersRef.current.delete(id);
    }
    for (const id of [...lastNodesRef.current.keys()]) {
      if (!live.has(id)) lastNodesRef.current.delete(id);
    }
    setHeights((prev) => {
      const idSet = new Set(order);
      let changed = false;
      const next: Record<string, number> = {};
      for (const [id, height] of Object.entries(prev)) {
        if (idSet.has(id)) next[id] = height;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [order]);

  const slotOffsetForIndex = useCallback(
    (index: number) => {
      if (!draggingId) return 0;
      const from = originIndexRef.current;
      const to = hoverIndex;
      const activeH = heights[draggingId] ?? 64;
      if (from === to) return 0;
      if (from < to) {
        if (index > from && index <= to) return -activeH;
      } else if (index >= to && index < from) {
        return activeH;
      }
      return 0;
    },
    [draggingId, heights, hoverIndex],
  );

  const dropFlashColor = theme.colors.primary;
  // One interpolation for the whole list: it depends only on `dropPulse`, and
  // at most one row shows the flash at a time. Building it per row allocated a
  // fresh node for every tracker on every render of every drag frame.
  const dropHighlight = useMemo(
    () => dropPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
    [dropPulse],
  );

  const present = new Set(order);
  /** The fading rows that stood under `anchor`; one that came back is not drawn twice. */
  const leavingUnder = (anchor: string | null) =>
    leaving
      .filter(
        (row) =>
          !present.has(row.id) &&
          (row.anchor === anchor || (anchor == null && row.anchor != null && !present.has(row.anchor))),
      )
      .map((row) => (
        <ExitingRow
          key={`leaving:${row.id}`}
          height={row.height}
          reduceMotion={reduceMotionRef.current}
          onGone={() => setLeaving((current) => current.filter((other) => other !== row))}
        >
          {row.node}
        </ExitingRow>
      ));

  return (
    <View style={styles.root} collapsable={false}>
      {leavingUnder(null)}
      {order.flatMap((id, index) => {
        const isDragging = draggingId === id;
        const isJustDropped = justDroppedId === id;
        const slotOffsetY = isDragging ? 0 : slotOffsetForIndex(index);
        const node = renderItem(id, {
          ...rowHandlersFor(id),
          delayLongPress: LONG_PRESS_MS,
          isDragging,
          canDrag,
        });
        // The owner may stop rendering a row a render before its id leaves
        // (a finished todo is gone from its map at once): keep the last one.
        if (node != null) lastNodesRef.current.set(id, node);
        const shown = node ?? lastNodesRef.current.get(id);

        return [
          <Animated.View
            key={id}
            onLayout={(event) => onRowLayout(id, event)}
            style={[
              styles.row,
              isDragging
                ? {
                    zIndex: 20,
                    elevation: 12,
                    shadowColor: '#000',
                    shadowOpacity: 0.28,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 6 },
                    transform: [
                      { translateY: dragTranslate },
                      { scale: dragScale },
                    ],
                  }
                : {
                    zIndex: 1,
                    transform: [{ translateY: slotOffsetY }],
                  },
            ]}
            pointerEvents={draggingId && !isDragging ? 'none' : 'auto'}
          >
            {isJustDropped ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.dropFlash,
                  { borderRadius: deco.radius.md },
                  {
                    opacity: dropHighlight,
                    backgroundColor: dropFlashColor,
                  },
                ]}
              />
            ) : null}
            {entering.has(id) ? (
              <EnteringRow reduceMotion={reduceMotionRef.current} onArrived={() => settleEntry(id)}>
                {shown}
              </EnteringRow>
            ) : (
              shown
            )}
          </Animated.View>,
          ...leavingUnder(id),
        ];
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  row: {
    width: '100%',
    position: 'relative',
  },
  /** A row on its way out or in: clipped to the place it is closing or opening. */
  leaving: {
    width: '100%',
    overflow: 'hidden',
  },
  dropFlash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
});
