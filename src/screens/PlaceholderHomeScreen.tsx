import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { COLORS } from '../constants/theme';

export default function PlaceholderHomeScreen() {
  const { signOut, user, profile } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome, {profile?.full_name || user?.email}</Text>
      <Text style={styles.role}>Role: {profile?.role || 'Guest'}</Text>
      <Button title="Sign Out" onPress={signOut} color={COLORS.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  text: {
    fontSize: 20,
    marginBottom: 10,
    color: COLORS.text,
  },
  role: {
    fontSize: 16,
    marginBottom: 20,
    color: COLORS.textSecondary,
  },
});
