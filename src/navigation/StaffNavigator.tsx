import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import StaffDashboard from '../screens/staff/StaffDashboard';

const Stack = createStackNavigator();

export default function StaffNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StaffDashboard" component={StaffDashboard} />
      {/* Add Order Detail or Inventory screens later */}
    </Stack.Navigator>
  );
}
