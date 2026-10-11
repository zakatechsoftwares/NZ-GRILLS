import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../constants/theme';

export default function ScreenHeader({ title }: { title: string }) {
  const navigation = useNavigation();

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  backButton: {
    padding: SPACING.s,
    marginRight: SPACING.m,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusFull,
    ...SHADOWS.light,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
});
