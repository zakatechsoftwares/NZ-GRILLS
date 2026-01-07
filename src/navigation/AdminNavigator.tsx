import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminDashboard from '../screens/admin/AdminDashboard';
import ManageMenuScreen from '../screens/admin/ManageMenuScreen';
import EditMenuItemScreen from '../screens/admin/EditMenuItemScreen';
import ManageCategoriesScreen from '../screens/admin/ManageCategoriesScreen';
import EditCategoryScreen from '../screens/admin/EditCategoryScreen';
import OrderAnalyticsScreen from '../screens/admin/OrderAnalyticsScreen';
import PromotionsScreen from '../screens/admin/PromotionsScreen';
import ManageStaffScreen from '../screens/admin/ManageStaffScreen';
import AllOrdersScreen from '../screens/admin/AllOrdersScreen';

const Stack = createNativeStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="ManageMenu" component={ManageMenuScreen} />
      <Stack.Screen name="EditMenuItem" component={EditMenuItemScreen} />
      <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} />
      <Stack.Screen name="EditCategory" component={EditCategoryScreen} />
      <Stack.Screen name="OrderAnalytics" component={OrderAnalyticsScreen} />
      <Stack.Screen name="Promotions" component={PromotionsScreen} />
      <Stack.Screen name="ManageStaff" component={ManageStaffScreen} />
      <Stack.Screen name="AllOrders" component={AllOrdersScreen} />
    </Stack.Navigator>
  );
}
