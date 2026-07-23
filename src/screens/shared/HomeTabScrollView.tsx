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

/**
 * Home Habits/Counters list: light rubber-band feedback when the user drags
 * vertically with nowhere to scroll (short lists) or past a scroll edge.
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
    const layoutH = useRef(0);
    const windowTop = useRef(0);
    const dragOrigin = useRef(0);
    const scrollLockedRef = useRef(scrollLocked);
    scrollLockedRef.current = scrollLocked;
    /** False until measured so long lists are not briefly non-scrollable. */
    const [fitsViewport, setFitsViewport] = useState(false);

    const recomputeFits = useCallback(() => {
      if (layoutH.current <= 0 || contentH.current <= 0) return;
      setFitsViewport(contentH.current <= layoutH.current + 1);
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
          if (Math.abs(gesture.dy) < 6) return false;
          if (Math.abs(gesture.dy) <= Math.abs(gesture.dx)) return false;

          const fits = contentH.current <= layoutH.current + 1;
          if (fits) return true;

          const top = scrollY.current <= 0.5;
          const bottom =
            scrollY.current + layoutH.current >= contentH.current - 1;
          if (top && gesture.dy > 0) return true;
          if (bottom && gesture.dy < 0) return true;
          return false;
        },
        onPanResponderGrant: () => {
          translateY.stopAnimation((value) => {
            dragOrigin.current = typeof value === 'number' ? value : 0;
          });
        },
        onPanResponderMove: (_, gesture) => {
          if (scrollLockedRef.current) return;
          let next = dragOrigin.current + gesture.dy * RUBBER;
          const fits = contentH.current <= layoutH.current + 1;
          if (!fits) {
            const top = scrollY.current <= 0.5;
            const bottom =
              scrollY.current + layoutH.current >= contentH.current - 1;
            if (top && !bottom) next = Math.max(0, next);
            if (bottom && !top) next = Math.min(0, next);
          }
          next = Math.max(-MAX_PULL, Math.min(MAX_PULL, next));
          translateY.setValue(next);
        },
        onPanResponderRelease: () => springHomeRef.current(),
        onPanResponderTerminate: () => springHomeRef.current(),
      }),
    ).current;

    const scrollEnabled = !scrollLocked && !fitsViewport;

    return (
      <View
        ref={rootRef}
        style={[styles.fill, style]}
        {...(scrollLocked ? {} : pan.panHandlers)}
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
              contentH.current = height;
              recomputeFits();
              onContentSizeChange?.(width, height);
            }}
          >
            {children}
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
