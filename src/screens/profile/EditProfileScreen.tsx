import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS } from '../../constants/theme';
import PremiumInput from '../../components/PremiumInput';
import PremiumButton from '../../components/PremiumButton';
import ScreenHeader from '../../components/ScreenHeader';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      Alert.alert('Saved', 'Your profile has been updated');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Edit Profile" />

      <View style={styles.form}>
        <PremiumInput
          label="Full Name"
          placeholder="Your name"
          value={fullName}
          onChangeText={setFullName}
          icon={<Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />}
        />
        <PremiumInput
          label="Phone Number"
          placeholder="080..."
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          icon={<Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />}
        />
        <PremiumInput
          label="Email"
          value={profile.email || ''}
          editable={false}
          icon={<Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />}
        />
        <Text style={styles.hint}>Email can't be changed here. Contact support if you need to update it.</Text>
      </View>

      <PremiumButton title="Save Changes" onPress={handleSave} isLoading={saving} />
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
  form: {
    gap: SPACING.m,
    marginBottom: SPACING.l,
  },
  hint: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
});
