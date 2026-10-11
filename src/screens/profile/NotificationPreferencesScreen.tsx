import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, Linking } from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { clearUserPushToken, registerForPushNotificationsAsync, updateUserPushToken } from '../../lib/notifications';
import { COLORS, SPACING, FONTS } from '../../constants/theme';
import ScreenHeader from '../../components/ScreenHeader';

export default function NotificationPreferencesScreen() {
  const { profile, refreshProfile } = useAuth();
  const [notifyPush, setNotifyPush] = useState(!!profile?.notify_push);
  const [notifyPromotions, setNotifyPromotions] = useState(!!profile?.notify_promotions);
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const savePreference = async (fields: { notify_push?: boolean; notify_promotions?: boolean }) => {
    const { error } = await supabase.from('profiles').update(fields).eq('id', profile.id);
    if (error) throw error;
  };

  const handleTogglePush = async (enabled: boolean) => {
    setSaving(true);
    try {
      if (enabled) {
        const token = await registerForPushNotificationsAsync({ prompt: true });
        if (!token) {
          Alert.alert(
            'Notifications blocked',
            'Allow notifications for NZ Grills in your phone settings, then try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }
        await updateUserPushToken(profile.id, token);
      } else {
        await clearUserPushToken(profile.id);
      }
      await savePreference({ notify_push: enabled });
      setNotifyPush(enabled);
      await refreshProfile();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update notifications');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePromotions = async (enabled: boolean) => {
    setSaving(true);
    try {
      await savePreference({ notify_promotions: enabled });
      setNotifyPromotions(enabled);
      await refreshProfile();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update notifications');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Notifications" />

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.textWrap}>
            <Text style={styles.title}>Push notifications</Text>
            <Text style={styles.description}>
              Alerts on this phone when your order status changes. Updates always appear in the app.
            </Text>
          </View>
          <Switch
            value={notifyPush}
            onValueChange={handleTogglePush}
            disabled={saving}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
          />
        </View>

        <View style={[styles.row, styles.lastRow]}>
          <View style={styles.textWrap}>
            <Text style={styles.title}>Promotions & offers</Text>
            <Text style={styles.description}>Deals and announcements from NZ Grills.</Text>
          </View>
          <Switch
            value={notifyPromotions}
            onValueChange={handleTogglePromotions}
            disabled={saving}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: SPACING.m,
    paddingTop: 50,
    backgroundColor: COLORS.background,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: SPACING.m,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '50',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  textWrap: {
    flex: 1,
    marginRight: SPACING.m,
  },
  title: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: FONTS.medium,
    marginBottom: 2,
  },
  description: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
});
