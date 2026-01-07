import React from 'react';
import { useAuth } from '../lib/AuthContext';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import StaffNavigator from './StaffNavigator';
import AdminNavigator from './AdminNavigator';
import CourierNavigator from './CourierNavigator';
import { COLORS } from '../constants/theme';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

export default function RootNavigator() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthNavigator />
      ) : profile?.role === 'staff' ? (
        <StaffNavigator />
      ) : profile?.role === 'admin' ? (
        <AdminNavigator />
      ) : profile?.role === 'courier' ? (
        <CourierNavigator />
      ) : (
        <MainNavigator />
      )}
    </NavigationContainer>
  );
}
