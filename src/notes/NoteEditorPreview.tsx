import React, { useEffect, useRef } from 'react';
import {
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
  DICTATION_PRESENCE_COLOR,
  DICTATION_PRESENCE_COLOR_DARK,
} from '../components/dictation/DictationPresence';
import type { DictationLivePreview } from '../dictation/livePreview';

const FOLLOW_BOTTOM_PX = 48;
const REVIEW_ADDED_WASH = 'rgba(91, 75, 138, 0.10)';
const REVIEW_ADDED_WASH_DARK = 'rgba(155, 139, 196, 0.18)';

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
  /** Prior saved body + unsaved additions. */
  reviewHighlight?: { base: string; added: string } | null;
  placeholder: string;
  minHeight?: number;
  maxHeight?: number;
  saving: boolean;
  editLocked?: boolean;
  onEdit: () => void;
};

/**
 * Mic-first note body. Live tail stays italic; unsaved additions tint after Done.
 */
export function NoteEditorPreview({
  noun,
  isJournal,
  draft,
  live,
  listening,
  capturing,
  reviewHighlight = null,
  placeholder,
  minHeight,
  maxHeight,
  saving,
  editLocked = false,
  onEdit,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const scrollRef = useRef<ScrollView>(null);
  const followRef = useRef(true);
  const wasListeningRef = useRef(listening);
  const liveCommitted = live?.committed ?? '';
  const liveTail = live?.tail ?? '';
  const committedBody = joinCommittedDraft(draft, liveCommitted);
  const hasDraft = draft.trim().length > 0;
  const hasLive = Boolean(liveCommitted || liveTail);
  const ink = theme.dark ? DICTATION_LIVE_COLOR_DARK : DICTATION_LIVE_COLOR;
  const addedInk = theme.dark ? DICTATION_PRESENCE_COLOR_DARK : DICTATION_PRESENCE_COLOR;
  const addedWash = theme.dark ? REVIEW_ADDED_WASH_DARK : REVIEW_ADDED_WASH;
  const showReviewHighlight =
    Boolean(reviewHighlight?.added) && !listening && !hasLive;

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
    const ended = wasListeningRef.current && !listening;
    wasListeningRef.current = listening;
    if (!ended) return;
    followRef.current = true;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [listening]);

  const tailPrefix =
    liveTail && committedBody ? (liveCommitted ? ' ' : committedBody.endsWith('\n') ? '' : '\n') : '';

  return (
    <DictationStageGlow
      active={capturing && listening}
      color={ink}
      borderRadius={12}
      style={[
        styles.preview,
        isJournal && styles.journalPreview,
        minHeight != null || maxHeight != null
          ? { minHeight: minHeight ?? undefined, maxHeight: maxHeight ?? undefined }
          : null,
        {
          borderColor: theme.colors.outline,
          borderWidth: deco.cardBorderWidth,
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
          minHeight != null ? { minHeight } : null,
        ]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (listening || hasLive) scrollToEnd(false);
        }}
      >
        <Pressable
          onPress={onEdit}
          disabled={saving || listening || editLocked}
          accessibilityRole="button"
          accessibilityLabel={
            hasDraft
              ? t('note.editNoteAccessible', { noun })
              : t('note.editNoteEmptyAccessible', { noun })
          }
          accessibilityHint={t('note.editNoteHint')}
        >
          {hasDraft || hasLive ? (
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface }}
              accessibilityLiveRegion={hasLive ? 'polite' : 'none'}
              accessibilityLabel={hasLive ? t('note.dictatingA11y') : undefined}
            >
              {showReviewHighlight && reviewHighlight
                ? reviewHighlight.base
                : committedBody}
              {showReviewHighlight && reviewHighlight ? (
                <Text
                  variant="bodyMedium"
                  accessibilityLabel={t('note.reviewAddedA11y')}
                  style={{
                    color: addedInk,
                    backgroundColor: addedWash,
                  }}
                >
                  {reviewHighlight.added}
                </Text>
              ) : liveTail ? (
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    fontStyle: 'italic',
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
    minHeight: 144,
    maxHeight: 280,
  },
  journalPreview: {
    minHeight: 184,
    maxHeight: 320,
  },
  previewScroll: {
    flex: 1,
  },
  previewPress: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 144,
  },
  journalPreviewPress: {
    minHeight: 184,
  },
});
