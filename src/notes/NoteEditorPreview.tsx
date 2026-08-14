import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  DictationStageGlow,
  DICTATION_LIVE_COLOR,
  DICTATION_LIVE_COLOR_DARK,
} from '../components/dictation/DictationPresence';
import type { DictationLivePreview } from '../dictation/livePreview';

const FOLLOW_BOTTOM_PX = 48;

function joinCommittedDraft(draft: string, liveCommitted: string): string {
  if (!liveCommitted) return draft;
  if (!draft) return liveCommitted;
  return draft.endsWith('\n') ? `${draft}${liveCommitted}` : `${draft}\n${liveCommitted}`;
}

type Props = {
  noun: string;
  isJournal: boolean;
  draft: string;
  live: DictationLivePreview | null;
  listening: boolean;
  capturing: boolean;
  capturedReview: boolean;
  placeholder: string;
  flashOpacity: Animated.AnimatedInterpolation<number>;
  saving: boolean;
  onEdit: () => void;
};

/**
 * Mic-first note body. Live tail stays italic and inline with committed text.
 */
export function NoteEditorPreview({
  noun,
  isJournal,
  draft,
  live,
  listening,
  capturing,
  capturedReview,
  placeholder,
  flashOpacity,
  saving,
  onEdit,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const scrollRef = useRef<ScrollView>(null);
  const followRef = useRef(true);
  const liveCommitted = live?.committed ?? '';
  const liveTail = live?.tail ?? '';
  const committedBody = joinCommittedDraft(draft, liveCommitted);
  const hasDraft = draft.trim().length > 0;
  const hasLive = Boolean(liveCommitted || liveTail);
  const ink = theme.dark ? DICTATION_LIVE_COLOR_DARK : DICTATION_LIVE_COLOR;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const fromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    followRef.current = fromBottom < FOLLOW_BOTTOM_PX;
  };

  const scrollToEnd = (animated: boolean) => {
    if (!followRef.current) return;
    scrollRef.current?.scrollToEnd({ animated });
  };

  useEffect(() => {
    if (!listening && !hasLive) return;
    const frame = requestAnimationFrame(() => scrollToEnd(false));
    return () => cancelAnimationFrame(frame);
  }, [listening, hasLive, liveTail, liveCommitted, draft]);

  useEffect(() => {
    if (!capturedReview) return;
    followRef.current = true;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [capturedReview]);

  const tailPrefix =
    liveTail && committedBody ? (liveCommitted ? ' ' : committedBody.endsWith('\n') ? '' : '\n') : '';

  return (
    <DictationStageGlow
      active={capturing && listening}
      color={ink}
      borderRadius={10}
      style={[
        styles.preview,
        isJournal && styles.journalPreview,
        {
          borderColor: theme.colors.outline,
          borderWidth: StyleSheet.hairlineWidth * 2,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.previewScroll}
        contentContainerStyle={[
          styles.previewPress,
          isJournal && styles.journalPreviewPress,
        ]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (listening || hasLive) scrollToEnd(false);
          else if (capturedReview) {
            followRef.current = true;
            scrollRef.current?.scrollToEnd({ animated: true });
          }
        }}
      >
        <Pressable
          onPress={onEdit}
          disabled={saving || listening}
          accessibilityRole="button"
          accessibilityLabel={
            hasDraft
              ? t('note.editNoteAccessible', { noun })
              : t('note.editNoteEmptyAccessible', { noun })
          }
          accessibilityHint={t('note.editNoteHint')}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: theme.colors.onSurface,
                opacity: flashOpacity,
                borderRadius: 3,
              },
            ]}
          />
          {hasDraft || hasLive ? (
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface }}
              accessibilityLiveRegion={hasLive ? 'polite' : 'none'}
              accessibilityLabel={hasLive ? t('note.dictatingA11y') : undefined}
            >
              {committedBody}
              {liveTail ? (
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    fontStyle: 'italic',
                    opacity: 0.75,
                  }}
                >
                  {tailPrefix}
                  {liveTail}
                </Text>
              ) : null}
            </Text>
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {placeholder}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </DictationStageGlow>
  );
}

const styles = StyleSheet.create({
  preview: {
    minHeight: 140,
    maxHeight: 280,
  },
  journalPreview: {
    minHeight: 180,
    maxHeight: 320,
  },
  previewScroll: {
    flex: 1,
  },
  previewPress: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 140,
  },
  journalPreviewPress: {
    minHeight: 180,
  },
});
