import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { COLORS, SHADOWS, SIZES } from '../constants/theme';

interface PremiumCardProps extends ViewProps {
  variant?: 'elevated' | 'flat' | 'outlined';
}

export default function PremiumCard({
  children,
  style,
  variant = 'elevated',
  ...props
}: PremiumCardProps) {
  return (
    <View
      style={[
        styles.card,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        variant === 'flat' && styles.flat,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  elevated: {
    ...SHADOWS.light, // Default to light shadow for subtle depth
  },
  flat: {
    backgroundColor: COLORS.background, // Or surface with no shadow
  },
  outlined: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
