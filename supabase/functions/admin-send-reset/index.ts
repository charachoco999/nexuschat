import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const mailFrom = Deno.env.get("MAIL_FROM");
  const appUrl = Deno.env.get("APP_URL");

  if (!supabaseUrl || !anonKey || !secretKey || !resendKey || !mailFrom || !appUrl) {
    return json(500, { error: "Faltan secretos de configuración de la función." });
  }

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Authentication required" });

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: callerData, error: callerError } = await userClient.auth.getUser(token);
  if (callerError || !callerData.user) return json(401, { error: "Sesión no válida." });

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminRole, error: roleError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerData.user.id)
    .in("role", ["admin", "moderator"])
    .limit(1)
    .maybeSingle();
  if (roleError || !adminRole) return json(403, { error: "No tienes permisos de administración." });

  let targetUserId = "";
  try {
    const body = await request.json();
    targetUserId = String(body?.targetUserId || "");
  } catch {
    return json(400, { error: "Solicitud no válida." });
  }
  if (!targetUserId) return json(400, { error: "Falta el usuario de destino." });
  if (targetUserId === callerData.user.id) return json(400, { error: "Usa la recuperación normal para tu propia cuenta." });

  const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);
  const targetEmail = targetData?.user?.email;
  if (targetError || !targetEmail) return json(404, { error: "No se ha encontrado el correo de esa cuenta." });

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: targetEmail,
    options: { redirectTo: appUrl },
  });
  const actionLink = linkData?.properties?.action_link;
  if (linkError || !actionLink) return json(500, { error: "No se pudo generar el enlace de recuperación." });

  const safeLink = actionLink.replaceAll("&", "&amp;").replaceAll("\"", "&quot;");
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: mailFrom,
      to: [targetEmail],
      subject: "Recuperación de contraseña de Nexus",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202333"><h2>Recupera tu cuenta de Nexus</h2><p>Un administrador ha solicitado que recibas un enlace para cambiar tu contraseña.</p><p><a href="${safeLink}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#7665e8;color:#fff;text-decoration:none">Cambiar contraseña</a></p><p>Si no esperabas este correo, puedes ignorarlo. Nunca compartas este enlace.</p></div>`,
    }),
  });

  if (!emailResponse.ok) {
    const details = await emailResponse.text();
    console.error("Email delivery failed:", details);
    return json(502, { error: "El proveedor de correo no pudo enviar el mensaje." });
  }

  return json(200, { message: "Correo de recuperación enviado." });
});
