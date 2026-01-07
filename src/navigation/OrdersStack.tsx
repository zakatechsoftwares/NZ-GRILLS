import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OrdersScreen from '../screens/customer/OrdersScreen';
import OrderDetailScreen from '../screens/customer/OrderDetailScreen';
import TrackDeliveryScreen from '../screens/customer/TrackDeliveryScreen';

const Stack = createStackNavigator();

export default function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrdersList" component={OrdersScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="TrackDelivery" component={TrackDeliveryScreen} />
    </Stack.Navigator>
  );
}
