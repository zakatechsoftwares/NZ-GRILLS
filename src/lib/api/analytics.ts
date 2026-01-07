import { supabase } from '../supabase';

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  completionRate: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
}

export interface PopularItem {
  item_id: string;
  item_name: string;
  total_quantity: number;
  total_revenue: number;
  order_count: number;
}

export interface PeakHour {
  hour: number;
  order_count: number;
}

export interface RevenueByDay {
  date: string;
  revenue: number;
  order_count: number;
}

/**
 * Get order statistics for a date range
 */
export async function getOrderStats(startDate: string, endDate: string): Promise<OrderStats> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('status, total_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error) {
    throw new Error(`Failed to fetch order stats: ${error.message}`);
  }

  if (!orders || orders.length === 0) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      completionRate: 0,
      pendingOrders: 0,
      preparingOrders: 0,
      readyOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
    };
  }

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
  const averageOrderValue = totalRevenue / totalOrders;

  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deliveredOrders = statusCounts['delivered'] || 0;
  const completionRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;

  return {
    totalOrders,
    totalRevenue,
    averageOrderValue,
    completionRate,
    pendingOrders: statusCounts['pending'] || 0,
    preparingOrders: statusCounts['preparing'] || 0,
    readyOrders: statusCounts['ready'] || 0,
    deliveredOrders,
    cancelledOrders: statusCounts['cancelled'] || 0,
  };
}

/**
 * Get popular items for a date range
 */
export async function getPopularItems(startDate: string, endDate: string, limit: number = 10): Promise<PopularItem[]> {
  const { data, error } = await supabase.rpc('get_popular_items', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_limit: limit,
  });

  if (error) {
    // If RPC function doesn't exist, fall back to manual calculation
    console.warn('RPC function not found, using fallback method');
    return getPopularItemsFallback(startDate, endDate, limit);
  }

  return data || [];
}

/**
 * Fallback method to get popular items without RPC
 */
async function getPopularItemsFallback(startDate: string, endDate: string, limit: number): Promise<PopularItem[]> {
  // Get orders in date range
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (ordersError || !orders) {
    return [];
  }

  const orderIds = orders.map(o => o.id);

  if (orderIds.length === 0) {
    return [];
  }

  // Get order items for these orders
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('menu_item_id, quantity, unit_price')
    .in('order_id', orderIds);

  if (itemsError || !orderItems) {
    return [];
  }

  // Aggregate by menu item
  const itemStats = orderItems.reduce((acc, item) => {
    const id = item.menu_item_id;
    if (!acc[id]) {
      acc[id] = {
        total_quantity: 0,
        total_revenue: 0,
        order_count: 0,
      };
    }
    acc[id].total_quantity += item.quantity;
    acc[id].total_revenue += item.quantity * Number(item.unit_price);
    acc[id].order_count += 1;
    return acc;
  }, {} as Record<string, { total_quantity: number; total_revenue: number; order_count: number }>);

  // Get menu item names
  const itemIds = Object.keys(itemStats);
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('id, name')
    .in('id', itemIds);

  const itemMap = new Map(menuItems?.map(item => [item.id, item.name]) || []);

  // Convert to array and sort
  const popularItems = Object.entries(itemStats)
    .map(([id, stats]) => ({
      item_id: id,
      item_name: itemMap.get(id) || 'Unknown Item',
      total_quantity: stats.total_quantity,
      total_revenue: stats.total_revenue,
      order_count: stats.order_count,
    }))
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, limit);

  return popularItems;
}

/**
 * Get peak hours (orders by hour of day)
 */
export async function getPeakHours(startDate: string, endDate: string): Promise<PeakHour[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error || !orders) {
    return [];
  }

  // Group by hour
  const hourCounts = orders.reduce((acc, order) => {
    const hour = new Date(order.created_at).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  // Convert to array
  const peakHours: PeakHour[] = [];
  for (let hour = 0; hour < 24; hour++) {
    peakHours.push({
      hour,
      order_count: hourCounts[hour] || 0,
    });
  }

  return peakHours;
}

/**
 * Get revenue by day
 */
export async function getRevenueByDay(startDate: string, endDate: string): Promise<RevenueByDay[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('created_at, total_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  if (error || !orders) {
    return [];
  }

  // Group by date
  const dateMap = orders.reduce((acc, order) => {
    const date = new Date(order.created_at).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = { revenue: 0, order_count: 0 };
    }
    acc[date].revenue += Number(order.total_amount);
    acc[date].order_count += 1;
    return acc;
  }, {} as Record<string, { revenue: number; order_count: number }>);

  // Convert to array
  return Object.entries(dateMap).map(([date, stats]) => ({
    date,
    revenue: stats.revenue,
    order_count: stats.order_count,
  }));
}

/**
 * Helper function to get date range presets
 */
export function getDateRange(period: 'today' | 'yesterday' | 'week' | 'month' | 'last_month'): { startDate: string; endDate: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case 'today':
      startDate = today;
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
      break;
    case 'yesterday':
      startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      endDate = new Date(today.getTime() - 1);
      break;
    case 'week':
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(today.getTime() - daysToMonday * 24 * 60 * 60 * 1000);
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

export interface StaffPerformance {
  staff_id: string;
  staff_name: string;
  total_orders: number;
  avg_prep_time: any; // Postgres interval
}

/**
 * Get staff performance metrics
 */
export async function getStaffPerformance(): Promise<StaffPerformance[]> {
  const { data, error } = await supabase.rpc('get_staff_performance');
  if (error) {
    console.error('Error fetching staff performance:', error);
    return [];
  }
  return data || [];
}
