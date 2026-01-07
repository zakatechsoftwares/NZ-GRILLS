import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    // Learn more about projectId:
    // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
    try {
        // We use check Project ID implicitly from app.json if configured, 
        // or just try default getExpoPushTokenAsync
        // NOTE: For Expo Go, this works but won't receive remote push from external servers easily without EAS configuration.
        // But we can use it for local testing or dev builds.
        const tokenData = await Notifications.getExpoPushTokenAsync();
        token = tokenData.data;
        console.log('Expo Push Token:', token);
    } catch (e) {
        console.error('Error getting push token', e);
    }
  } else {
    // alert('Must use physical device for Push Notifications');
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export async function updateUserPushToken(userId: string, token: string) {
    const { error } = await supabase
        .from('profiles')
        .update({ expo_push_token: token })
        .eq('id', userId);
    
    if (error) console.error('Error updating push token:', error);
}

// Send a local notification (for immediate feedback testing)
export async function sendLocalNotification(title: string, body: string, data = {}) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data,
        },
        trigger: null, // immediate
    });
}

// Generic helper to send in-app notification
export async function sendNotification(userId: string, title: string, body: string, data = {}) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      body,
      data,
      is_read: false
    });

  if (error) {
    console.error('Error creating notification:', error);
  }
}

// Send an order notification helper
export async function sendOrderNotification(
  userId: string, 
  orderId: string, 
  status: string, 
  orderRef: string
) {
  let title = 'Order Update';
  let body = `Your order #${orderRef} is now ${status}`;
  
  if (status === 'ready') {
    title = 'Order Ready! 🍽️';
    body = `Your order #${orderRef} is ready for pickup/delivery!`;
  } else if (status === 'out_for_delivery') {
    title = 'Order En Route 🛵';
    body = `Your order #${orderRef} is on the way!`;
  }

  // 1. Insert into database (reliable in-app notification)
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      body,
      data: { orderId, status },
      is_read: false
    });

  if (error) {
    console.error('Error creating notification:', error);
  }

  // 2. Try to trigger Edge Function for Push Notification (best effort)
  try {
     // Check if we can invoke the function (requires deployment)
     // For now we just log, or we could try invoke
     console.log('Notification created in DB for:', userId);
     
     /* 
     // Any edge function invocation would go here
     await supabase.functions.invoke('push-notification', {
        body: { userId, title, body, data: { orderId } } 
     });
     */
  } catch (e) {
    console.log('Push notification skipped (dev mode)');
  }
}
