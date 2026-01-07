import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import PremiumCard from '../../components/PremiumCard';

export default function AdminDashboard() {
  const navigation = useNavigation<any>();
  const { signOut, user } = useAuth();

  const menuActions = [
    {
      title: 'Manage Menu',
      icon: 'fast-food',
      description: 'Add, edit, or remove food items',
      onPress: () => navigation.navigate('ManageMenu'),
      color: COLORS.primary,
    },
    {
      title: 'Categories',
      icon: 'list',
      description: 'Organize menu categories',
      onPress: () => navigation.navigate('ManageCategories'),
      color: COLORS.success,
    },
    {
      title: 'Orders',
      icon: 'receipt',
      description: 'View all order history',
      onPress: () => navigation.navigate('AllOrders'),
      color: COLORS.warning,
    },
    {
      title: 'Analytics',
      icon: 'bar-chart',
      description: 'Sales and performance stats',
      onPress: () => navigation.navigate('OrderAnalytics'),
      color: COLORS.info,
    },
    {
      title: 'Promotions',
      icon: 'megaphone',
      description: 'Broadcast offers to users',
      onPress: () => navigation.navigate('Promotions'),
      color: COLORS.error, // Using error/red for attention/marketing
    },
    {
      title: 'Staff',
      icon: 'people',
      description: 'Manage roles & permissions',
      onPress: () => navigation.navigate('ManageStaff'),
      color: COLORS.primary,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, Admin</Text>
          <Text style={styles.subtitle}>Manage NZ Grills</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          {menuActions.map((action, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.cardContainer}
              onPress={action.onPress}
            >
              <PremiumCard style={styles.card}>
                <View style={[styles.iconContainer, { backgroundColor: action.color + '20' }]}>
                  <Ionicons name={action.icon as any} size={28} color={action.color} />
                </View>
                <Text style={styles.cardTitle}>{action.title}</Text>
                <Text style={styles.cardDescription}>{action.description}</Text>
              </PremiumCard>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.l,
  },
  greeting: {
    ...FONTS.h1,
    color: COLORS.text,
  },
  subtitle: {
    ...FONTS.body2,
    color: COLORS.textSecondary,
  },
  signOutButton: {
    padding: SPACING.s,
    backgroundColor: COLORS.error + '10',
    borderRadius: SIZES.radius,
  },
  content: {
    paddingHorizontal: SPACING.m,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.m,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardContainer: {
    width: '48%',
    marginBottom: SPACING.m,
  },
  card: {
    padding: SPACING.m,
    alignItems: 'center',
    height: 160,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  cardTitle: {
    ...FONTS.h4,
    color: COLORS.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
