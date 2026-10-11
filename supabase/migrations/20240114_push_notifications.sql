-- Send a push notification for every row inserted into notifications.
--
-- Order status updates (staff/courier), courier offers and promotion
-- broadcasts all insert into notifications, so this one trigger covers them.
-- Push goes only to users with notify_push on and a valid Expo token.
--
-- Uses pg_net (asynchronous HTTP), so inserts are never blocked or failed by
-- the push service. Requests are batched 100 per call (Expo's limit).
--
-- Optional: if Expo "Enhanced push security" is enabled for the project,
-- store an Expo access token in Vault:
--   select vault.create_secret('<token>', 'expo_access_token');

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.send_push_for_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_messages jsonb;
  v_batch jsonb;
  v_headers jsonb := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json');
  v_access_token text;
  v_batch_index int;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'to', p.expo_push_token,
           'title', n.title,
           'body', n.body,
           'data', coalesce(n.data, '{}'::jsonb) || jsonb_build_object('notificationId', n.id),
           'sound', 'default',
           'channelId', 'default',
           'priority', 'high'
         )), '[]'::jsonb)
    INTO v_messages
    FROM new_notifications n
    JOIN public.profiles p ON p.id = n.user_id
   WHERE p.notify_push
     AND p.expo_push_token ~ '^Expo(nent)?PushToken\[';

  IF jsonb_array_length(v_messages) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_access_token
    FROM vault.decrypted_secrets
   WHERE name = 'expo_access_token';

  IF v_access_token IS NOT NULL THEN
    v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_access_token);
  END IF;

  FOR v_batch_index IN 0 .. (jsonb_array_length(v_messages) - 1) / 100 LOOP
    SELECT jsonb_agg(m.value ORDER BY m.ordinality)
      INTO v_batch
      FROM jsonb_array_elements(v_messages) WITH ORDINALITY AS m
     WHERE m.ordinality > v_batch_index * 100
       AND m.ordinality <= (v_batch_index + 1) * 100;

    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_batch,
      headers := v_headers
    );
  END LOOP;

  RETURN NULL;
EXCEPTION WHEN others THEN
  -- Never fail the notification insert because of push delivery
  RAISE WARNING 'send_push_for_notifications failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS send_push_for_notifications ON public.notifications;
CREATE TRIGGER send_push_for_notifications
  AFTER INSERT ON public.notifications
  REFERENCING NEW TABLE AS new_notifications
  FOR EACH STATEMENT EXECUTE FUNCTION public.send_push_for_notifications();
