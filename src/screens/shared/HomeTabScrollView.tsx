import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  View,
} from 'react-native';

const RUBBER = 0.28;
const MAX_PULL = 64;
/** Treat as fitting when content is within 1px of the viewport (subpixel noise). */
const FITS_EPSILON = 1;

export type HomeTabScrollViewHandle = {
  getScrollOffsetY: () => number;
  getLayoutHeight: () => number;
  getWindowTop: () => number;
  scrollBy: (deltaY: number) => void;
};

type Props = Omit<
  ScrollViewProps,
  'refreshControl' | 'bounces' | 'alwaysBounceVertical' | 'overScrollMode'
> & {
  /** Freeze scrolling / rubber-band while a row is being drag-reordered. */
  scrollLocked?: boolean;
};

function contentFitsViewport(contentHeight: number, layoutHeight: number): boolean {
  if (layoutHeight <= 0 || contentHeight <= 0) return false;
  return contentHeight <= layoutHeight + FITS_EPSILON;
}

/**
 * Home Habits/Counters list: light rubber-band when the list fits on screen
 * (nowhere to scroll). When content overflows, the ScrollView scrolls normally
 * and the bounce pan is detached so it cannot steal vertical gestures.
 * Native Android overscroll is unreliable inside the Home horizontal pager.
 */
export const HomeTabScrollView = forwardRef<HomeTabScrollViewHandle, Props>(
  function HomeTabScrollView(
    {
      children,
      contentContainerStyle,
      style,
      onScroll,
      onLayout,
      onContentSizeChange,
      scrollLocked = false,
      ...rest
    },
    ref,
  ) {
    const scrollRef = useRef<ScrollView>(null);
    const rootRef = useRef<View>(null);
    const translateY = useRef(new Animated.Value(0)).current;
    const scrollY = useRef(0);
    const contentH = useRef(0);
    const innerContentH = useRef(0);
    const contentSizeH = useRef(0);
    const layoutH = useRef(0);
    const windowTop = useRef(0);
    const dragOrigin = useRef(0);
    const scrollLockedRef = useRef(scrollLocked);
    scrollLockedRef.current = scrollLocked;
    /** False until measured so long lists stay scrollable. */
    const [fitsViewport, setFitsViewport] = useState(false);
    const fitsViewportRef = useRef(fitsViewport);
    fitsViewportRef.current = fitsViewport;

    const recomputeFits = useCallback(() => {
      // Prefer the larger measurement: flexGrow can make content-size ≈ viewport
      // while the inner children are taller (or the reverse on some ROMs).
      contentH.current = Math.max(innerContentH.current, contentSizeH.current);
      setFitsViewport(contentFitsViewport(contentH.current, layoutH.current));
    }, []);

    const springHome = useCallback(() => {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 140,
      }).start();
    }, [translateY]);

    const springHomeRef = useRef(springHome);
    springHomeRef.current = springHome;

    useEffect(() => {
      if (!fitsViewport || scrollY.current <= 0) return;
      scrollY.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [fitsViewport]);

    useEffect(() => {
      if (!scrollLocked) return;
      translateY.setValue(0);
    }, [scrollLocked, translateY]);

    useImperativeHandle(
      ref,
      () => ({
        getScrollOffsetY: () => scrollY.current,
        getLayoutHeight: () => layoutH.current,
        getWindowTop: () => windowTop.current,
        scrollBy: (deltaY: number) => {
          const maxY = Math.max(0, contentH.current - layoutH.current);
          const next = Math.max(0, Math.min(maxY, scrollY.current + deltaY));
          scrollY.current = next;
          scrollRef.current?.scrollTo({ y: next, animated: false });
        },
      }),
      [],
    );

    const measureWindowTop = useCallback(() => {
      rootRef.current?.measureInWindow((_x, y) => {
        windowTop.current = y;
      });
    }, []);

    const pan = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (scrollLockedRef.current) return false;
          // Only rubber-band short lists. Long lists must leave gestures to ScrollView.
          if (!fitsViewportRef.current) return false;
          if (Math.abs(gesture.dy) < 6) return false;
          if (Math.abs(gesture.dy) <= Math.abs(gesture.dx)) return false;
          return true;
        },
        onPanResponderGrant: () => {
          translateY.stopAnimation((value) => {
            dragOrigin.current = typeof value === 'number' ? value : 0;
          });
        },
        onPanResponderMove: (_, gesture) => {
          if (scrollLockedRef.current || !fitsViewportRef.current) return;
          let next = dragOrigin.current + gesture.dy * RUBBER;
          next = Math.max(-MAX_PULL, Math.min(MAX_PULL, next));
          translateY.setValue(next);
        },
        onPanResponderRelease: () => springHomeRef.current(),
        onPanResponderTerminate: () => springHomeRef.current(),
      }),
    ).current;

    const scrollEnabled = !scrollLocked && !fitsViewport;
    /** Attach bounce pan only when the list fits — never compete with overflow scroll. */
    const rubberBandActive = !scrollLocked && fitsViewport;

    return (
      <View
        ref={rootRef}
        style={[styles.fill, style]}
        {...(rubberBandActive ? pan.panHandlers : {})}
        onLayout={measureWindowTop}
        collapsable={false}
      >
        <Animated.View
          style={[styles.fill, { transform: [{ translateY }] }]}
          pointerEvents="box-none"
        >
          <ScrollView
            {...rest}
            ref={scrollRef}
            style={styles.fill}
            contentContainerStyle={contentContainerStyle}
            nestedScrollEnabled
            scrollEventThrottle={16}
            bounces={!scrollLocked}
            alwaysBounceVertical={!scrollLocked}
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={scrollEnabled}
            onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
              onScroll?.(event);
            }}
            onLayout={(event: LayoutChangeEvent) => {
              layoutH.current = event.nativeEvent.layout.height;
              recomputeFits();
              measureWindowTop();
              onLayout?.(event);
            }}
            onContentSizeChange={(width, height) => {
              contentSizeH.current = height;
              recomputeFits();
              onContentSizeChange?.(width, height);
            }}
          >
            <View
              collapsable={false}
              onLayout={(event: LayoutChangeEvent) => {
                innerContentH.current = event.nativeEvent.layout.height;
                recomputeFits();
              }}
            >
              {children}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
