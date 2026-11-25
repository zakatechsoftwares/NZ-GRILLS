import React, { useState } from 'react';
import { TextInput, View, Text, StyleSheet, TextInputProps, ViewStyle, Platform } from 'react-native';
import { COLORS, SIZES, FONTS, SPACING } from '../constants/theme';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolateColor } from 'react-native-reanimated';

interface PremiumInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export default function PremiumInput({
  label,
  error,
  containerStyle,
  icon,
  rightIcon,
  onFocus,
  onBlur,
  style,
  ...props
}: PremiumInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const borderColorProgress = useSharedValue(0);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    borderColorProgress.value = withTiming(1);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    borderColorProgress.value = withTiming(0);
    onBlur?.(e);
  };

  const animatedContainerStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      borderColorProgress.value,
      [0, 1],
      [COLORS.border, COLORS.primary]
    );
    return {
      borderColor: error ? COLORS.error : borderColor,
      backgroundColor: isFocused ? COLORS.surface : COLORS.background, // Subtle shift
    };
  });

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View style={[styles.container, props.multiline && styles.containerMultiline, animatedContainerStyle]}>
        {icon && <View style={styles.iconLeft}>{icon}</View>}
        <TextInput
          style={[styles.input, props.multiline && styles.inputMultiline, style]}
          placeholderTextColor={COLORS.textLight}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </Animated.View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SIZES.margin,
  },
  label: {
    ...FONTS.body3,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginLeft: 4,
    fontWeight: '600',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SIZES.inputHeight,
    borderRadius: SIZES.radius,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.m, // Increased padding
  },
  // Multi-line fields grow from 5 lines instead of the single-line fixed height
  containerMultiline: {
    height: undefined,
    minHeight: 130,
    alignItems: 'flex-start',
    paddingVertical: SPACING.s,
  },
  input: {
    flex: 1,
    height: '100%',
    color: COLORS.text,
    fontSize: 16, // Explicit font size
    fontFamily: 'System', // Standard font
    paddingHorizontal: SPACING.s,
    marginTop: Platform.OS === 'android' ? 2 : 0, // Better vertical align on Android
  },
  inputMultiline: {
    height: undefined,
    minHeight: 112,
    marginTop: 0,
    textAlignVertical: 'top',
  },
  iconLeft: {
    marginRight: SPACING.s, // Use margin for clear separation
  },
  iconRight: {
    marginLeft: SPACING.s,
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 4,
  },
});
