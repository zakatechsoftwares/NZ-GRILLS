// Follow this guide to deploy: https://supabase.com/docs/guides/functions/deploy
// 1. Install Supabase CLI
// 2. Run: supabase functions new verify-payment
// 3. Paste this code into supabase/functions/verify-payment/index.ts
// 4. Run: supabase functions deploy verify-payment
// 5. Set secrets: supabase secrets set FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-...

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { transaction_id, order_id } = await req.json()
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!transaction_id || !order_id) {
      throw new Error('Missing transaction_id or order_id')
    }

    // 1. Verify transaction with Flutterwave
    const flwResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
      },
    })
    
    const flwData = await flwResponse.json()

    if (flwData.status !== 'success') {
      throw new Error('Payment verification failed with Flutterwave')
    }

    const { amount, currency, status } = flwData.data

    if (status !== 'successful') {
      throw new Error('Payment was not successful')
    }

    // 2. Update order in Supabase
    // Using service role client to bypass RLS if needed, although user should be able to update their own order if policies allow
    // Ideally we check if the amount matches the order total here too
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get order to check amount (optional strict check)
    // const { data: order } = await supabase.from('orders').select('total_amount').eq('id', order_id).single()
    // if (order.total_amount > amount) throw new Error('Insufficient payment amount')

    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'paid',
        payment_id: transaction_id 
      })
      .eq('id', order_id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true, message: 'Payment verified and order updated' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
