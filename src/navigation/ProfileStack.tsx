import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfileScreen from '../screens/auth/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import AddressesScreen from '../screens/profile/AddressesScreen';
import AddressFormScreen from '../screens/profile/AddressFormScreen';
import NotificationPreferencesScreen from '../screens/profile/NotificationPreferencesScreen';

const Stack = createStackNavigator();

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="AddressForm" component={AddressFormScreen} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
    </Stack.Navigator>
  );
}
