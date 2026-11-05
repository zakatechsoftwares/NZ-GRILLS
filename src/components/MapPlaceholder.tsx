import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, SIZES } from '../constants/theme';

interface MapPlaceholderProps {
  address?: string;
  onOpenMaps: () => void;
  style?: StyleProp<ViewStyle>;
}

// Shown instead of MapView in builds without a Google Maps API key (see MAPS_ENABLED)
export default function MapPlaceholder({ address, onOpenMaps, style }: MapPlaceholderProps) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="map-outline" size={48} color={COLORS.primary} />
      <Text style={styles.address} numberOfLines={3}>
        {address || 'No address'}
      </Text>
      <TouchableOpacity style={styles.button} onPress={onOpenMaps}>
        <Ionicons name="navigate" size={18} color={COLORS.textInverse} />
        <Text style={styles.buttonText}>Open in Maps</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.l,
    backgroundColor: COLORS.surfaceHighlight,
  },
  address: {
    ...FONTS.body1,
    color: COLORS.text,
    textAlign: 'center',
    marginVertical: SPACING.m,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s + SPACING.xs,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    color: COLORS.textInverse,
    fontWeight: '600',
    marginLeft: SPACING.s,
  },
});
