import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, SPACING, FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Form state
  // In a real app we'd have full edit capability
  
  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut }
    ]);
  };

  if (!profile) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {profile.full_name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{profile.full_name}</Text>
        <Text style={styles.role}>{profile.role.toUpperCase()}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile.email || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{profile.phone || 'N/A'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Coming Soon', 'Edit Profile coming soon')}>
          <Text style={styles.menuItemText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Coming Soon', 'Addresses coming soon')}>
          <Text style={styles.menuItemText}>Manage Addresses</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Coming Soon', 'Notifications coming soon')}>
          <Text style={styles.menuItemText}>Notification Preferences</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.m,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.l,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.m,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: 40,
    color: COLORS.surface,
    fontFamily: FONTS.bold,
  },
  name: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  role: {
    fontSize: 14,
    color: COLORS.primary,
    fontFamily: FONTS.medium,
    backgroundColor: COLORS.primary + '15', // light primary
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.m,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
    paddingBottom: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '50',
  },
  label: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  value: {
    color: COLORS.text,
    fontFamily: FONTS.regular,
  },
  menuItem: {
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '50',
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: FONTS.regular,
  },
  signOutButton: {
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  signOutText: {
    color: COLORS.error,
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
});
