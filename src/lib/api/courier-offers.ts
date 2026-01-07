import { supabase } from '../supabase';
import { sendNotification } from '../notifications';

export interface CourierOffer {
  id: string;
  order_id: string;
  courier_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  offered_at: string;
  responded_at?: string;
  responded_by?: string;
  created_at: string;
}

/**
 * Create a courier offer for an order
 */
export async function createCourierOffer(orderId: string, courierId: string): Promise<{ success: boolean; error?: any; data?: CourierOffer }> {
  try {
    const { data, error } = await supabase
      .from('courier_offers')
      .insert({
        order_id: orderId,
        courier_id: courierId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    
    // Notify staff who completed the order
    const { data: order } = await supabase
      .from('orders')
      .select('completed_by, id')
      .eq('id', orderId)
      .single();

    if (order?.completed_by) {
      await sendNotification(
        order.completed_by, 
        'New Courier Offer 🛵', 
        `A courier is interested in delivering Order #${orderId.slice(0, 4)}`,
        { orderId, type: 'courier_offer' }
      );
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error creating courier offer:', error);
    return { success: false, error };
  }
}

/**
 * Withdraw a courier offer
 */
export async function withdrawCourierOffer(offerId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('courier_offers')
      .update({ status: 'withdrawn' })
      .eq('id', offerId)
      .eq('status', 'pending'); // Only withdraw pending offers

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error withdrawing courier offer:', error);
    return { success: false, error };
  }
}

/**
 * Get all offers for an order
 */
export async function getCourierOffers(orderId: string): Promise<CourierOffer[]> {
  try {
    const { data, error } = await supabase
      .from('courier_offers')
      .select(`
        *,
        profiles:courier_id (full_name, phone, email)
      `)
      .eq('order_id', orderId)
      .order('offered_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching courier offers:', error);
    return [];
  }
}

/**
 * Accept a courier offer and assign courier to order
 */
export async function acceptCourierOffer(
  offerId: string,
  orderId: string,
  courierId: string,
  staffId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    // Start a transaction-like operation
    // 1. Update the offer to accepted
    const { error: offerError } = await supabase
      .from('courier_offers')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
        responded_by: staffId,
      })
      .eq('id', offerId);

    if (offerError) throw offerError;

    // 2. Assign courier to order
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        courier_id: courierId,
        courier_assigned_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (orderError) throw orderError;

    // 3. Reject all other pending offers for this order
    const { error: rejectError } = await supabase
      .from('courier_offers')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
        responded_by: staffId,
      })
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .neq('id', offerId);

    if (rejectError) console.warn('Error rejecting other offers:', rejectError);

    // Notify Courier
    await sendNotification(
      courierId,
      'Offer Accepted! ✅',
      'You have been assigned to this delivery. Please pick it up from the kitchen.',
      { orderId, type: 'offer_accepted' }
    );

    return { success: true };
  } catch (error) {
    console.error('Error accepting courier offer:', error);
    return { success: false, error };
  }
}

/**
 * Reject a courier offer
 */
export async function rejectCourierOffer(offerId: string, staffId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('courier_offers')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
        responded_by: staffId,
      })
      .eq('id', offerId);

    if (error) throw error;

    // Get courier ID from offer to notify them
    const { data: offer } = await supabase.from('courier_offers').select('courier_id').eq('id', offerId).single();
    if (offer?.courier_id) {
       await sendNotification(
         offer.courier_id,
         'Offer Declined',
         'Your offer for this delivery was not accepted.',
         { type: 'offer_rejected' }
       );
    }

    return { success: true };
  } catch (error) {
    console.error('Error rejecting courier offer:', error);
    return { success: false, error };
  }
}

/**
 * Manually assign a courier to an order (without offer)
 */
export async function assignCourier(
  orderId: string,
  courierId: string,
  staffId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('orders')
      .update({
        courier_id: courierId,
        courier_assigned_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) throw error;

    // Reject any pending offers for this order
    await supabase
      .from('courier_offers')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
        responded_by: staffId,
      })
      .eq('order_id', orderId)
      .eq('status', 'pending');

    // Notify Courier
    await sendNotification(
      courierId,
      'New Delivery Assigned! 📦',
      'You have been assigned a new delivery by the staff.',
      { orderId, type: 'courier_assigned' }
    );

    return { success: true };
  } catch (error) {
    console.error('Error assigning courier:', error);
    return { success: false, error };
  }
}

/**
 * Courier confirms pickup of order
 */
export async function confirmCourierPickup(orderId: string, courierId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('orders')
      .update({
        courier_accepted_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('courier_id', courierId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error confirming courier pickup:', error);
    return { success: false, error };
  }
}

/**
 * Get courier's pending offers
 */
export async function getMyCourierOffers(courierId: string): Promise<CourierOffer[]> {
  try {
    const { data, error } = await supabase
      .from('courier_offers')
      .select('*')
      .eq('courier_id', courierId)
      .in('status', ['pending', 'accepted'])
      .order('offered_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching my courier offers:', error);
    return [];
  }
}
