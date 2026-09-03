import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Menu, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { TrackerIcon } from '../components/trackerIcons/TrackerIcon';
import type { TrackerIconId } from '../protocol';

type Props = {
  heading: string;
  /** Formatted day under the title; blank hides the line. */
  subtitle: string;
  titleIcon?: TrackerIconId;
  isJournal: boolean;
  /** Accessibility noun — "note" or "journal". */
  noun: string;
  showShare: boolean;
  shareColor: string;
  shareStatusA11y: string;
  sharing: boolean;
  onShare: () => void;
  showMenu: boolean;
  menuOpen: boolean;
  /** Remounts Paper's Menu so a dismissed overlay cannot swallow the next tap. */
  menuEpoch: number;
  onMenuOpenChange: (open: boolean) => void;
  menuDisabled: boolean;
  showClear: boolean;
  onClear: () => void;
  showCopy: boolean;
  copyDisabled: boolean;
  copyLabel: string;
  onCopy: () => void;
  onClose: () => void;
};

/**
 * The note sheet's top row: what you are writing in, when, and the three
 * things you can do to the whole thing — share it, act on it, close it.
 *
 * Split out of NoteEditorSheet when chapters arrived: the sheet was carrying
 * the header, the chapter bar, the field, the limit banner and the action row
 * in one 750-line component, and the header is the piece with no dependency on
 * the draft beyond a couple of booleans.
 */
export default function NoteEditorHeader({
  heading,
  subtitle,
  titleIcon,
  isJournal,
  noun,
  showShare,
  shareColor,
  shareStatusA11y,
  sharing,
  onShare,
  showMenu,
  menuOpen,
  menuEpoch,
  onMenuOpenChange,
  menuDisabled,
  showClear,
  onClear,
  showCopy,
  copyDisabled,
  copyLabel,
  onCopy,
  onClose,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <View style={styles.headerTitleRow}>
          {titleIcon ? (
            <TrackerIcon name={titleIcon} size={20} color={theme.colors.onSurface} />
          ) : null}
          <Text variant="titleMedium" numberOfLines={1} style={styles.headerTitle}>
            {heading}
          </Text>
        </View>
        {subtitle ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showShare ? (
        <IconButton
          icon="share-variant"
          onPress={onShare}
          disabled={sharing}
          iconColor={shareColor}
          accessibilityLabel={`${t('note.shareA11y', { noun })}. ${shareStatusA11y}`}
          style={styles.headerIcon}
        />
      ) : null}
      {showMenu ? (
        <Menu
          key={menuEpoch}
          visible={menuOpen}
          onDismiss={() => onMenuOpenChange(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              onPress={() => onMenuOpenChange(!menuOpen)}
              disabled={menuDisabled}
              accessibilityLabel={t('note.moreActions')}
              style={styles.headerIcon}
            />
          }
        >
          {showClear ? (
            <Menu.Item
              onPress={onClear}
              title={t('note.clear')}
              leadingIcon="delete-outline"
              titleStyle={{ color: theme.colors.error }}
            />
          ) : null}
          {showCopy ? (
            <Menu.Item
              onPress={onCopy}
              title={copyLabel}
              leadingIcon="content-copy"
              disabled={copyDisabled}
            />
          ) : null}
        </Menu>
      ) : null}
      <IconButton
        icon="close"
        onPress={onClose}
        accessibilityLabel={
          isJournal ? t('note.closeJournalAccessible') : t('note.closeNoteAccessible')
        }
        style={styles.headerIcon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'visible',
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
  },
  headerIcon: {
    margin: 0,
  },
});
