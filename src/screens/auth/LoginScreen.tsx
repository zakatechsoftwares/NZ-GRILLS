import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SIZES } from '../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import PremiumInput from '../../components/PremiumInput';
import PremiumButton from '../../components/PremiumButton';
import { Ionicons } from '@expo/vector-icons';
import { performGoogleSignIn } from '../../lib/auth-helpers';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
    setLoading(false);
  }

  async function signInWithGoogle() {
    try {
      setLoading(true);
      await performGoogleSignIn();
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue ordering</Text>
        </View>

        <View style={styles.form}>
          <PremiumInput
            label="Email"
            placeholder="email@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            icon={<Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />}
          />

          <PremiumInput
            label="Password"
            placeholder="********"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />}
          />

          <PremiumButton
            title="Sign In"
            onPress={signInWithEmail}
            isLoading={loading}
            style={styles.button}
          />

          <PremiumButton
            title="Sign In with Google"
            variant="outline"
            onPress={signInWithGoogle}
            style={styles.googleButton}
            icon={<Ionicons name="logo-google" size={20} color={COLORS.primary} />}
          />

          <PremiumButton
            title="Don't have an account? Sign Up"
            variant="ghost"
            onPress={() => navigation.navigate('Signup')}
            style={styles.linkButton}
            textStyle={styles.linkText}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SIZES.padding,
    justifyContent: 'center',
  },
  header: {
    marginBottom: SPACING.xxl,
  },
  title: {
    ...FONTS.h1,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...FONTS.body1,
    color: COLORS.textSecondary,
  },
  form: {
    gap: SIZES.padding,
  },
  button: {
    marginTop: SPACING.m,
  },
  linkButton: {
    marginTop: SPACING.s,
  },
  linkText: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  googleButton: {
    marginTop: SPACING.s,
    borderColor: COLORS.border,
  },
});
