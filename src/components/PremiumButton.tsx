import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, TouchableOpacityProps } from 'react-native';
import { COLORS, SHADOWS, SIZES, FONTS } from '../constants/theme';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withSequence } from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface PremiumButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export default function PremiumButton({
  title,
  variant = 'primary',
  isLoading = false,
  style,
  textStyle,
  icon,
  onPress,
  disabled,
  ...props
}: PremiumButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getBackgroundColor = () => {
    if (disabled) return COLORS.textLight; // Disabled state
    switch (variant) {
      case 'primary': return COLORS.primary;
      case 'secondary': return COLORS.secondary;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return COLORS.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return COLORS.surface;
    switch (variant) {
      case 'primary': return COLORS.textInverse;
      case 'secondary': return COLORS.textInverse;
      case 'outline': return COLORS.primary;
      case 'ghost': return COLORS.primary;
      default: return COLORS.textInverse;
    }
  };

  return (
    <AnimatedTouchable
      activeOpacity={0.8}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled || isLoading}
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor() },
        variant === 'outline' && { borderWidth: 1.5, borderColor: COLORS.primary },
        (variant === 'primary' || variant === 'secondary') && !disabled && SHADOWS.medium,
        animatedStyle,
        style,
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <>
          {icon && <React.Fragment>{icon}</React.Fragment>}
          <Text style={[styles.text, { color: getTextColor() }, icon && { marginLeft: 8 }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: SIZES.btnHeight,
    borderRadius: SIZES.radius,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
  },
  text: {
    ...FONTS.h4,
    fontSize: 16,
    textAlign: 'center',
  },
});
