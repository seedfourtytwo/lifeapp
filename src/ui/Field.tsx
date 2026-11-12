import React from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Icon } from './Icon';
import { NightText } from './NightText';
import { nightColors, nightRadius, nightState, nightStroke, nightType, space } from './tokens';

type Common = {
  /** Inside the field, on the left, dimmed: "Goal". Leave it off for a field that is its own label (a name). */
  label?: string;
  /** Said instead of the label, when the label alone would not say what the field is. */
  accessibilityLabel?: string;
  disabled?: boolean;
};

/** Shows a value and, pressed, opens what changes it: a picker, a list. */
export type FieldShowProps = Common & {
  value: string;
  /** Shown dimmed in place of an empty value. */
  placeholder?: string;
  onPress?: () => void;
  onChangeText?: never;
};

/** Typed into. */
export type FieldTextProps = Common & {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Digits only, on the number pad: a goal, a count. The caller reads the number. */
  numeric?: boolean;
  /** After the value, dimmed: "min", "glasses". */
  unit?: string;
  onPress?: never;
} & Pick<TextInputProps, 'maxLength' | 'autoFocus' | 'returnKeyType' | 'onSubmitEditing' | 'onBlur'>;

export type FieldProps = FieldShowProps | FieldTextProps;

/**
 * A field: the label inside it on the left, the value on the right. Either it
 * shows a value and opens what changes it, or it is typed into. Grows with
 * the system font.
 */
export function Field(props: FieldProps) {
  const { label, accessibilityLabel, disabled } = props;
  const labelText = label ? (
    <NightText kind="caption" tone="dim" style={fieldStyles.label}>
      {label}
    </NightText>
  ) : null;

  if (props.onChangeText) {
    const { value, onChangeText, placeholder, numeric, unit, ...input } = props;
    return (
      <View style={[fieldStyles.field, disabled && fieldStyles.disabled]}>
        {labelText}
        <TextInput
          maxLength={input.maxLength}
          autoFocus={input.autoFocus}
          returnKeyType={input.returnKeyType}
          onSubmitEditing={input.onSubmitEditing}
          onBlur={input.onBlur}
          value={value}
          onChangeText={numeric ? (text) => onChangeText(text.replace(/\D/g, '')) : onChangeText}
          keyboardType={numeric ? 'number-pad' : 'default'}
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={nightColors.creamDim}
          selectionColor={nightColors.cream}
          cursorColor={nightColors.cream}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: Boolean(disabled) }}
          style={[fieldStyles.input, label ? fieldStyles.inputBesideLabel : null]}
        />
        {unit ? (
          <NightText kind="caption" tone="dim">
            {unit}
          </NightText>
        ) : null}
      </View>
    );
  }

  const { value, placeholder, onPress } = props;
  const shown = (
    <>
      {labelText}
      <View style={fieldStyles.valueSide}>
        <NightText kind="name" tone={value ? 'cream' : 'dim'} style={fieldStyles.value}>
          {value || placeholder}
        </NightText>
        {onPress ? <Icon name="chevron-right" size="sm" tone="dim" /> : null}
      </View>
    </>
  );
  const said = [accessibilityLabel ?? label, value || placeholder].filter(Boolean).join(', ');
  if (!onPress) {
    return (
      <View style={fieldStyles.field} accessible accessibilityLabel={said}>
        {shown}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={said}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [fieldStyles.field, pressed && fieldStyles.pressed, disabled && fieldStyles.disabled]}
    >
      {shown}
    </Pressable>
  );
}

export const fieldStyles = StyleSheet.create({
  field: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: nightRadius.field,
    borderWidth: nightStroke.quiet,
    borderColor: nightColors.quietEdge,
    backgroundColor: nightColors.well,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  label: {
    flexShrink: 1,
  },
  valueSide: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.xs,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  input: {
    ...nightType.body,
    flexGrow: 1,
    flexShrink: 1,
    color: nightColors.cream,
    padding: 0,
  },
  inputBesideLabel: {
    ...nightType.name,
    textAlign: 'right',
  },
  pressed: {
    opacity: nightState.pressed,
  },
  disabled: {
    opacity: nightState.disabled,
  },
});
