import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import PremiumCard from '../../components/PremiumCard';

type Notification = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data: any;
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      
      // Mark all as read when viewing (simple logic for now)
      if (data && data.length > 0) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
      }

    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const renderItem = ({ item }: { item: Notification }) => (
    <PremiumCard style={[styles.card, !item.is_read && styles.unreadCard]}>
      <View style={styles.iconContainer}>
        <Ionicons 
          name={!item.is_read ? "notifications" : "notifications-outline"} 
          size={24} 
          color={!item.is_read ? COLORS.primary : COLORS.textSecondary} 
        />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, !item.is_read && styles.unreadText]}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.time}>
          {new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {item.data?.valid_until && (
          <View style={styles.validityContainer}>
            <Ionicons name="calendar" size={12} color={COLORS.primary} />
            <Text style={styles.validityText}>
              Valid: {new Date(item.data.valid_from || item.created_at).toLocaleDateString()} - {new Date(item.data.valid_until).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </PremiumCard>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notifications</Text>
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
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
    ...FONTS.h1,
    color: COLORS.text,
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  list: {
    padding: SPACING.m,
  },
  card: {
    flexDirection: 'row',
    marginBottom: SPACING.m,
    padding: SPACING.m,
  },
  unreadCard: {
    backgroundColor: COLORS.surfaceHighlight, // slightly lighter/different to indicate unread
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  iconContainer: {
    marginRight: SPACING.m,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...FONTS.h4,
    color: COLORS.text,
    marginBottom: 4,
  },
  unreadText: {
    fontFamily: FONTS.bold,
  },
  body: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  time: {
    ...FONTS.body2,
    fontSize: 12, // Override font size since body4 doesn't exist
    color: COLORS.textLight,
  },
  validityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: COLORS.primary + '10',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  validityText: {
    ...FONTS.body2,
    fontSize: 10,
    color: COLORS.primary,
    marginLeft: 4,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.textSecondary,
    marginTop: SPACING.m,
  },
});
