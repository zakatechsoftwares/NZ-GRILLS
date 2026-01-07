import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions, ViewStyle } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  Easing
} from 'react-native-reanimated';
import { COLORS, SIZES } from '../constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  style?: ViewStyle;
  borderRadius?: number;
}

export default function Skeleton({ 
  width = '100%', 
  height = 20, 
  style,
  borderRadius = SIZES.radiusSm 
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { 
          width: width as any, 
          height: height as any, 
          borderRadius 
        },
        animatedStyle,
        style
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.secondaryLight, // OR a specific skeleton color
    opacity: 0.3,
  },
});
