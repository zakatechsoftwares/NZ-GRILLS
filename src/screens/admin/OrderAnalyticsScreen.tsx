import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import PremiumCard from '../../components/PremiumCard';
import { getOrderStats, getPopularItems, getPeakHours, getRevenueByDay, OrderStats, PopularItem, PeakHour, RevenueByDay, getDateRange, getStaffPerformance } from '../../lib/api/analytics';

const SCREEN_WIDTH = Dimensions.get('window').width;

type TimeRange = 'today' | 'week' | 'month';

export default function OrderAnalyticsScreen() {
  const navigation = useNavigation();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueByDay[]>([]);
  const [staffStats, setStaffStats] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange);
      
      const [statsData, itemsData, hoursData, revenueTrend, staffData] = await Promise.all([
        getOrderStats(startDate, endDate),
        getPopularItems(startDate, endDate, 5),
        getPeakHours(startDate, endDate),
        getRevenueByDay(startDate, endDate),
        getStaffPerformance() // This is independent of date range for now as RPC aggregates all time
      ]);

      setStats(statsData);
      setPopularItems(itemsData);
      setPeakHours(hoursData);
      setRevenueData(revenueTrend);
      setStaffStats(staffData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderSimpleBarChart = (data: any[], labelKey: string, valueKey: string, height = 150, isCurrency = false) => {
    if (!data.length) return <Text style={styles.emptyText}>No data available</Text>;
    
    const maxValue = Math.max(...data.map(d => (d as any)[valueKey]));
    
    return (
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingTop: 20 }}>
        {data.map((item, index) => {
          const value = (item as any)[valueKey];
          const barHeight = maxValue > 0 ? (value / maxValue) * (height - 30) : 0;
          return (
            <View key={index} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: COLORS.textSecondary, marginBottom: 4 }}>
                {isCurrency ? '₦' + Math.round(value) : value}
              </Text>
              <View 
                style={{ 
                  width: '60%', 
                  height: Math.max(barHeight, 4), 
                  backgroundColor: isCurrency ? COLORS.success : COLORS.primary,
                  borderRadius: 4,
                  opacity: 0.8
                }} 
              />
              <Text style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>
                {(item as any)[labelKey]}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const StatCard = ({ title, value, icon, color, subtitle }: any) => (
    <PremiumCard style={styles.statCard}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
    </PremiumCard>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {(['today', 'week', 'month'] as TimeRange[]).map(range => (
            <TouchableOpacity
              key={range}
              style={[styles.filterChip, timeRange === range && styles.filterChipActive]}
              onPress={() => setTimeRange(range)}
            >
              <Text style={[styles.filterChipText, timeRange === range && styles.filterChipTextActive]}>
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statsGrid}>
            <StatCard 
              title="Total Sales" 
              value={`₦${stats?.totalRevenue.toFixed(2)}`} 
              icon="cash" 
              color={COLORS.success}
              subtitle={`${stats?.totalOrders} orders`}
            />
            <StatCard 
              title="Avg. Order" 
              value={`₦${stats?.averageOrderValue.toFixed(2)}`} 
              icon="cart" 
              color={COLORS.primary}
            />
            <StatCard 
              title="Completion" 
              value={`${stats?.completionRate.toFixed(0)}%`} 
              icon="checkmark-circle" 
              color={COLORS.info}
            />
            <StatCard 
              title="Cancelled" 
              value={stats?.cancelledOrders} 
              icon="close-circle" 
              color={COLORS.error}
            />
          </View>

          <Text style={styles.sectionTitle}>Revenue Trend</Text>
          <PremiumCard style={styles.chartCard}>
            {renderSimpleBarChart(
              revenueData.slice(-7), // Last 7 days
              'date',
              'revenue',
              150,
              true
            )}
          </PremiumCard>

          <Text style={styles.sectionTitle}>Peak Hours</Text>
          <PremiumCard style={styles.chartCard}>
            {renderSimpleBarChart(
              peakHours.filter(h => h.order_count > 0).slice(0, 12), // Show active hours
              'hour', 
              'order_count'
            )}
          </PremiumCard>

          <Text style={styles.sectionTitle}>Staff Performance</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.m, paddingBottom: SPACING.m }}>
            {staffStats.length > 0 ? staffStats.map((staff) => (
              <PremiumCard key={staff.staff_id} style={{ width: 140, padding: SPACING.m }}>
                 <View style={{ alignItems: 'center', marginBottom: SPACING.s }}>
                   <View style={[styles.iconContainer, { backgroundColor: COLORS.primary + '20' }]}>
                      <Text style={{ fontFamily: FONTS.bold, color: COLORS.primary, fontSize: 18 }}>
                        {staff.staff_name ? staff.staff_name.charAt(0) : '?'}
                      </Text>
                   </View>
                   <Text style={{ ...FONTS.h4, color: COLORS.text, textAlign: 'center' }} numberOfLines={1}>{staff.staff_name || 'Unknown'}</Text>
                 </View>
                 <View>
                   <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Orders Completed</Text>
                   <Text style={{ ...FONTS.h3, color: COLORS.text }}>{staff.total_orders}</Text>
                 </View>
                 {staff.avg_prep_time && (
                    <View style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Avg Prep Time</Text>
                      <Text style={{ ...FONTS.h4, color: COLORS.text }}>
                         {/* Simple formatting for postgres interval if string, or handle accordingly */}
                         {typeof staff.avg_prep_time === 'string' ? staff.avg_prep_time.substring(0, 8) : 'N/A'}
                      </Text>
                    </View>
                 )}
              </PremiumCard>
            )) : (
              <Text style={styles.emptyText}>No performance data yet</Text>
            )}
          </ScrollView>

          <Text style={styles.sectionTitle}>Popular Items</Text>
          <View style={styles.popularList}>
            {popularItems.map((item, index) => (
              <PremiumCard key={item.item_id} style={styles.popularCard}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.m }}>
                  <Text style={styles.popularName}>{item.item_name}</Text>
                  <Text style={styles.popularStats}>{item.total_quantity} sold • ₦{item.total_revenue.toFixed(2)}</Text>
                </View>
              </PremiumCard>
            ))}
            {popularItems.length === 0 && (
              <Text style={styles.emptyText}>No popular items data</Text>
            )}
          </View>
        </ScrollView>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  backButton: {
    padding: SPACING.s,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
    gap: SPACING.s,
  },
  filterChip: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 0,
    ...SHADOWS.light,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.surface,
    fontFamily: FONTS.bold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: SPACING.m,
    paddingBottom: 50,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.m,
    marginBottom: SPACING.l,
  },
  statCard: {
    width: (SCREEN_WIDTH - SPACING.m * 3) / 2,
    padding: SPACING.m,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  statLabel: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  statSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.m,
    marginTop: SPACING.s,
  },
  chartCard: {
    padding: SPACING.m,
    marginBottom: SPACING.l,
  },
  popularList: {
    gap: SPACING.s,
  },
  popularCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  popularName: {
    ...FONTS.h4,
    color: COLORS.text,
  },
  popularStats: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginVertical: 20,
  },
});
