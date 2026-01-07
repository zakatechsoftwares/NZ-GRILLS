// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')

serve(async (req) => {
  try {
    const { title, body, userId, broadcast, data } = await req.json()

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let profiles = []

    if (broadcast) {
      // Fetch all users with push tokens
      const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('id, expo_push_token')
        .not('expo_push_token', 'is', null)
      
      if (error) throw error
      profiles = users
    } else if (userId) {
      // Fetch specific user
      const { data: user, error } = await supabaseClient
        .from('profiles')
        .select('id, expo_push_token')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      if (user) profiles = [user]
    }

    // Filter valid tokens
    const messages = []
    const notificationsToInsert = []

    for (const profile of profiles) {
      if (!profile.expo_push_token || !profile.expo_push_token.startsWith('ExponentPushToken')) {
        continue
      }

      messages.push({
        to: profile.expo_push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
      })

      notificationsToInsert.push({
        user_id: profile.id,
        title,
        body,
        data: data || {},
        is_read: false
      })
    }

    // 1. Send to Expo
    // Note: Expo handles batches automatically but it's good to be mindful of limits.
    // For large broadcasts, you'd chunk this.
    if (messages.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
    }

    // 2. Store in Database
    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('notifications')
        .insert(notificationsToInsert)
      
      if (insertError) console.error('Error inserting notifications:', insertError)
    }

    return new Response(
      JSON.stringify({ success: true, count: messages.length }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }
})
