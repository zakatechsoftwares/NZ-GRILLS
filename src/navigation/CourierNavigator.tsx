import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CourierDashboard from '../screens/courier/CourierDashboard';
import DeliveryDetailScreen from '../screens/courier/DeliveryDetailScreen';

const Stack = createStackNavigator();

export default function CourierNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CourierDashboard" component={CourierDashboard} />
      <Stack.Screen name="DeliveryDetail" component={DeliveryDetailScreen} />
    </Stack.Navigator>
  );
}
