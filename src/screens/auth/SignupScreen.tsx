import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, ROLES, SIZES } from '../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import PremiumInput from '../../components/PremiumInput';
import PremiumButton from '../../components/PremiumButton';
import { Ionicons } from '@expo/vector-icons';
import { performGoogleSignIn } from '../../lib/auth-helpers';

export default function SignupScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUpWithEmail() {
    if (!email || !password || !confirmPassword || !fullName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    
    try {
      const { data: { session, user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!user) throw new Error("No user created");

      Alert.alert('Success', 'Account created successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithGoogle() {
    try {
      setLoading(true);
      await performGoogleSignIn();
    } finally {
      setLoading(false);
    }
  }


  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join us to order delicious food</Text>
      </View>

      <View style={styles.form}>
        <PremiumInput
          label="Full Name"
          placeholder="John Doe"
          value={fullName}
          onChangeText={setFullName}
          icon={<Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />}
        />

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
          label="Phone (Optional)"
          placeholder="+1 234 567 890"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          icon={<Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />}
        />

        <PremiumInput
          label="Password"
          placeholder="********"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />}
        />

        <PremiumInput
          label="Confirm Password"
          placeholder="********"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />}
        />

        <PremiumButton
          title="Sign Up"
          onPress={signUpWithEmail}
          isLoading={loading}
          style={styles.button}
        />

        <PremiumButton
          title="Sign Up with Google"
          variant="outline"
          onPress={signUpWithGoogle}
          style={styles.googleButton}
          icon={<Ionicons name="logo-google" size={20} color={COLORS.primary} />}
        />

        <PremiumButton
          title="Already have an account? Sign In"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={styles.linkButton}
          textStyle={styles.linkText}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    padding: SIZES.padding,
    justifyContent: 'center',
    paddingTop: 60,
  },
  header: {
    marginBottom: SPACING.xl,
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
    gap: SIZES.margin,
  },
  button: {
    marginTop: SPACING.s,
  },
  linkButton: {
    marginTop: SPACING.s,
  },
  linkText: {
    ...FONTS.body3,
    color: COLORS.secondary,
  },
  googleButton: {
    marginTop: SPACING.s,
    borderColor: COLORS.border,
  },
});
