import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TextStyle, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import type { WeatherCondition, WeatherTrend } from '../../weather/types';
import {
  BUBBLE_HEIGHT,
  BUBBLE_RADIUS,
  BUBBLE_WIDTH,
} from '../../weather/bubblePosition';
import { conditionIconName } from '../../weather/codes';
import { formatBubbleDate, formatTempC } from '../../weather/format';
import BubbleChargeRing from './BubbleChargeRing';
import { RAIN_NOTABLE_PCT, weatherMoodFor, type WeatherMoodVariant } from './weatherMood';

/** Nudge from the date’s center so `· N` sits just to the right without shifting layout. */
const CORNER_SCORE_FROM_CENTER = 20;

interface Props {
  condition: WeatherCondition;
  currentTempC: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  precipProbabilityPct: number | null;
  trend?: WeatherTrend | null;
  /** Calendar day on the bottom row; defaults to today (DD/MM). */
  dateLabel?: string;
  /**
   * Today's corner tally — fades in to the right of the date after a hit,
   * without shifting the date. Hidden when null/undefined.
   */
  cornerScoreFlash?: number | null;
  muted?: boolean;
  offline?: boolean;
  error?: boolean;
  /** 0..1 — charge affordance while holding to fling. */
  chargeProgress?: number;
}

/**
 * Centered three-line chip:
 *   now · condition · tendency
 *   high · low · rain
 *   date
 *
 * While charging: soft lift, luminous wash, and a bright border meter.
 */
export default function WeatherDayFace({
  condition,
  currentTempC,
  tempMinC,
  tempMaxC,
  precipProbabilityPct,
  trend = null,
  dateLabel,
  cornerScoreFlash = null,
  muted = false,
  offline = false,
  error = false,
  chargeProgress = 0,
}: Props) {
  const moodVariant: WeatherMoodVariant = offline ? 'offline' : error ? 'error' : 'normal';
  const mood = weatherMoodFor(condition, {
    muted,
    variant: moodVariant,
    precipProbabilityPct,
  });
  const p = Math.max(0, Math.min(1, chargeProgress));
  const charging = p > 0.02;
  const scale = 1 + 0.06 * p;

  const ink: TextStyle = {
    color: mood.ink,
    fontVariant: ['tabular-nums'],
  };
  const inkSoft: TextStyle = {
    color: mood.inkSoft,
    fontVariant: ['tabular-nums'],
  };

  const dateText = dateLabel ?? formatBubbleDate();
  const nowLabel = currentTempC != null ? formatTempC(currentTempC) : '—';
  const hasRange = tempMinC != null && tempMaxC != null;
  const hasRain = precipProbabilityPct != null;
  const rainNotable = hasRain && precipProbabilityPct >= RAIN_NOTABLE_PCT;
  const trendIcon =
    trend === 'improving' ? 'trending-up' : trend === 'worsening' ? 'trending-down' : null;
  const trendColor =
    trend === 'improving' ? mood.border : trend === 'worsening' ? mood.ink : mood.inkSoft;

  // Score overlays to the right of the centered date (no layout shift).
  const [cornerShown, setCornerShown] = useState<number | null>(null);
  const cornerOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    if (cornerScoreFlash != null && cornerScoreFlash > 0) {
      setCornerShown(cornerScoreFlash);
      cornerOpacity.stopAnimation();
      Animated.timing(cornerOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return () => {
        cancelled = true;
      };
    }
    cornerOpacity.stopAnimation();
    Animated.timing(cornerOpacity, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !cancelled) setCornerShown(null);
    });
    return () => {
      cancelled = true;
    };
  }, [cornerOpacity, cornerScoreFlash]);

  return (
    <View
      style={[
        styles.shell,
        charging
          ? {
              transform: [{ scale }],
              shadowColor: mood.border,
              shadowOpacity: 0.2 + 0.35 * p,
              shadowRadius: 6 + 12 * p,
              shadowOffset: { width: 0, height: 2 + 4 * p },
              elevation: 4 + Math.round(8 * p),
            }
          : null,
      ]}
    >
      <View
        style={[
          styles.face,
          {
            width: BUBBLE_WIDTH,
            height: BUBBLE_HEIGHT,
            borderRadius: BUBBLE_RADIUS,
            backgroundColor: mood.fill,
            borderColor: mood.border,
            borderWidth: charging ? 0 : mood.borderWidth,
          },
        ]}
      >
        {charging ? (
          <View
            pointerEvents="none"
            style={[
              styles.chargeClip,
              { borderRadius: BUBBLE_RADIUS },
            ]}
          >
            {/* Mood-tinted wash — chip “charges up” from inside. */}
            <View
              style={[
                styles.wash,
                {
                  backgroundColor: mood.border,
                  opacity: 0.07 + 0.16 * p,
                },
              ]}
            />
            {/* Hot highlight near the top — reads as energy, not a flat tint. */}
            <View
              style={[
                styles.sheen,
                {
                  opacity: 0.1 + 0.22 * p,
                },
              ]}
            />
            <BubbleChargeRing
              progress={p}
              color={mood.border}
              strokeWidth={Math.max(2.15, mood.borderWidth + 0.35)}
            />
          </View>
        ) : null}

        <View style={styles.row}>
          <Text numberOfLines={1} style={[ink, styles.nowTemp]}>
            {nowLabel}
          </Text>
          {moodVariant === 'normal' ? (
            <MaterialCommunityIcons
              name={conditionIconName(condition)}
              size={18}
              color={mood.border}
            />
          ) : (
            <MaterialCommunityIcons
              name={offline ? 'cloud-off-outline' : 'weather-cloudy-alert'}
              size={16}
              color={mood.inkSoft}
            />
          )}
          {trendIcon ? (
            <MaterialCommunityIcons name={trendIcon} size={14} color={trendColor} />
          ) : (
            <Text style={[inkSoft, styles.trendFlat]}>-</Text>
          )}
        </View>

        <View style={styles.row}>
          {hasRange ? (
            <>
              <Text numberOfLines={1} style={[ink, styles.hiText]}>
                {formatTempC(tempMaxC!)}
              </Text>
              <Text numberOfLines={1} style={[inkSoft, styles.loText]}>
                {formatTempC(tempMinC!)}
              </Text>
            </>
          ) : (
            <Text numberOfLines={1} style={[inkSoft, styles.loText]}>
              —
            </Text>
          )}
          {hasRain ? (
            <View style={styles.rainGroup}>
              <MaterialCommunityIcons
                name="water"
                size={11}
                color={rainNotable ? mood.ink : mood.inkSoft}
              />
              <Text
                numberOfLines={1}
                style={[
                  rainNotable ? ink : inkSoft,
                  styles.rainText,
                  rainNotable ? styles.rainTextHot : null,
                ]}
              >
                {`${precipProbabilityPct}%`}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.dateRow}>
          <Text numberOfLines={1} style={[inkSoft, styles.dateLabel]}>
            {dateText}
          </Text>
          {cornerShown != null ? (
            <Animated.Text
              numberOfLines={1}
              pointerEvents="none"
              style={[
                styles.cornerScore,
                { color: mood.ink, opacity: cornerOpacity },
              ]}
            >
              {`· ${cornerShown}`}
            </Animated.Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    // Allow `· N` to sit just outside the date without clipping.
    overflow: 'visible',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    gap: 4,
    padding: 8,
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
  },
  chargeClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: '42%',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rainGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 2,
  },
  nowTemp: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  hiText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
  loText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
  },
  rainText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  rainTextHot: {
    fontWeight: '800',
  },
  trendFlat: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
    includeFontPadding: false,
  },
  dateRow: {
    position: 'relative',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 12,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  cornerScore: {
    position: 'absolute',
    left: '50%',
    marginLeft: CORNER_SCORE_FROM_CENTER,
    top: 0,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
});
