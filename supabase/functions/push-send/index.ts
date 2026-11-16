// Sends a Web Push notification to every registered device of one user.
// Called only by the database (send_push trigger helper) with a shared secret header.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
let cfg: Record<string, string> | null = null;
async function config() {
  if (cfg) return cfg;
  const { data, error } = await sb.rpc("push_config");
  if (error) throw error;
  cfg = data as Record<string, string>;
  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
  return cfg;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  try {
    const c = await config();
    if (req.headers.get("x-push-secret") !== c.push_secret) return new Response("forbidden", { status: 403 });
    const { user_id, title, body, url, tag } = await req.json();
    if (!user_id) return new Response("missing user_id", { status: 400 });
    const { data: subs, error } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", user_id);
    if (error) throw error;
    const payload = JSON.stringify({ title: title || "Digital Team Tasks Tracker", body: body || "", url: url || "/", tag: tag || undefined });
    let sent = 0, removed = 0;
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await sb.from("push_subscriptions").delete().eq("id", s.id); removed++; }
        else console.error("push failed", code, (e as Error).message);
      }
    }));
    return Response.json({ sent, removed });
  } catch (e) {
    console.error(e);
    return new Response("error: " + (e as Error).message, { status: 500 });
  }
});
