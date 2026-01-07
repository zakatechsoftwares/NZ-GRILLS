import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeStack from '../navigation/HomeStack';
import OrdersStack from '../navigation/OrdersStack';
import ProfileScreen from '../screens/auth/ProfileScreen';
import { COLORS } from '../constants/theme';
import PlaceholderHomeScreen from '../screens/PlaceholderHomeScreen';

const Tab = createBottomTabNavigator();

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.surface,
          paddingTop: 5,
        }
      }}
    >
      <Tab.Screen 
        name="Explore" 
        component={HomeStack} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="fast-food" size={size} color={color} />
          )
        }}
      />
      <Tab.Screen 
        name="Orders" 
        component={OrdersStack} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          )
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          )
        }}
      />
    </Tab.Navigator>
  );
}
