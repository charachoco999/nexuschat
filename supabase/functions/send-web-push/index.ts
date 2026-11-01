import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const receivedSecret = req.headers.get("x-nexus-webhook-secret");
  if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) {
    return Response.json({ error: "Unauthorized webhook" }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "";
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject.startsWith("mailto:")) {
    return Response.json({ error: "Missing push secrets" }, { status: 503 });
  }

  try {
    const payload = await req.json();
    const notification = payload?.record;
    if (payload?.type !== "INSERT" || payload?.table !== "notifications" || !notification?.user_id) {
      return Response.json({ ignored: true });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: subscriptions } = await admin.from("push_subscriptions")
      .select("id,subscription").eq("user_id", notification.user_id);

    if (!subscriptions?.length) {
      return Response.json({ sent: 0, skipped: true });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    const pushPayload = JSON.stringify({
      title: String(notification.title || "Nexus").slice(0, 100),
      body: String(notification.body || "Tienes un mensaje nuevo.").slice(0, 180),
      url: String(notification.target_path || "/").slice(0, 500),
      tag: `nexus-message-${notification.message_id}`,
    });

    let sent = 0;
    for (const row of subscriptions) {
      try {
        await webpush.sendNotification(row.subscription, pushPayload, { TTL: 60 * 60 });
        sent += 1;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
        } else {
          console.warn("Push delivery failed", statusCode, String(error).slice(0, 250));
        }
      }
    }
    return Response.json({ sent });
  } catch (error) {
    console.error("send-web-push failed", error);
    return Response.json({ error: "Push delivery failed" }, { status: 500 });
  }
});
