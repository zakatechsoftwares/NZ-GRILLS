import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/customer/HomeScreen';
import MenuScreen from '../screens/customer/MenuScreen';
import ItemDetailScreen from '../screens/customer/ItemDetailScreen';
import CartScreen from '../screens/customer/CartScreen';
import CheckoutScreen from '../screens/customer/CheckoutScreen';
import FavoritesScreen from '../screens/customer/FavoritesScreen';
import NotificationsScreen from '../screens/customer/NotificationsScreen';
import AddressesScreen from '../screens/profile/AddressesScreen';
import AddressFormScreen from '../screens/profile/AddressFormScreen';

const Stack = createStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="AddressForm" component={AddressFormScreen} />
    </Stack.Navigator>
  );
}
