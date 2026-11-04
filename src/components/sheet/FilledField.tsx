import React, { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';

export type FilledFieldProps = Omit<TextInputProps, 'style'> & {
  /**
   * A caption above the field — only when the placeholder cannot say what it
   * is for ("Due"). Most fields have none.
   */
  label?: string;
  /** One line in red under the field when what was typed cannot be saved. */
  error?: string | null;
  /** Sits inside the field on the right: a mic, a clear button. */
  rightAccessory?: React.ReactNode;
  /**
   * What the field sits on. On a sheet it is a well of the page colour; on
   * the page itself that well would vanish, so it takes the tile colour.
   */
  fill?: 'sheet' | 'page';
  style?: StyleProp<ViewStyle>;
};

const MIN_HEIGHT = 56;
const MULTILINE_MIN_HEIGHT = 112;

/**
 * A text field as a filled well: ground colour on the sheet, no outline, no
 * floating label. The fill alone says "you can type here", and a label that
 * floats into the border is what made every editor look like a stock form.
 */
const FilledField = forwardRef<TextInput, FilledFieldProps>(function FilledField(
  { label, error, rightAccessory, fill = 'sheet', style, multiline, ...input },
  ref,
) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();

  return (
    <View style={style}>
      {label ? (
        <Text style={[typeScale.caption, styles.label, { color: theme.colors.onSurfaceVariant }]}>
          {label}
        </Text>
      ) : null}
      <View
        testID="filled-field-box"
        style={[
          styles.box,
          {
            backgroundColor: fill === 'page' ? theme.colors.surface : theme.colors.background,
            borderRadius: deco.radius.md,
            minHeight: multiline ? MULTILINE_MIN_HEIGHT : MIN_HEIGHT,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        <TextInput
          ref={ref}
          multiline={multiline}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          underlineColorAndroid="transparent"
          textAlignVertical={multiline ? 'top' : 'center'}
          accessibilityLabel={input.accessibilityLabel ?? label ?? input.placeholder}
          {...input}
          style={[typeScale.body, styles.input, { color: theme.colors.onSurface }]}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {error ? (
        <Text style={[typeScale.caption, styles.error, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

export default FilledField;

const styles = StyleSheet.create({
  label: {
    marginBottom: space.xs + space.xxs,
    paddingHorizontal: space.xs,
  },
  box: {
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  accessory: {
    alignSelf: 'center',
    paddingRight: space.xs,
  },
  error: {
    marginTop: space.xs + space.xxs,
    paddingHorizontal: space.xs,
  },
});
