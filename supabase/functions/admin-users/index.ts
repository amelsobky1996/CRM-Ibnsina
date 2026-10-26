// Ibnsina Digital Tasks Tracker — admin-users Edge Function
// إنشاء الحسابات، تغيير كلمة السر، إيقاف/تفعيل، وحذف الموظفين.
// المدير يقدر يدير اللي تحته فقط، والأدمن يدير الكل.
// تغيير كلمة سر أي موظف تاني متاح للأدمن (المدير الرئيسي) بس.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const EMAIL_DOMAIN = Deno.env.get("EMAIL_DOMAIN") ?? "ibnsina-crm.local";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !auth?.user) return json({ error: "يلزم تسجيل الدخول" }, 401);

    const { data: me } = await admin
      .from("profiles").select("id,is_admin,active").eq("id", auth.user.id).single();
    if (!me || !me.active) return json({ error: "الحساب غير مفعّل" }, 403);

    const isAncestor = async (mgr: string, emp: string) => {
      const { data } = await admin.rpc("is_ancestor", { p_manager: mgr, p_emp: emp });
      return data === true;
    };
    const canManage = async (target: string) => me.is_admin || (await isAncestor(me.id, target));

    const body = await req.json();

    switch (body.action) {
      case "create": {
        const username = String(body.username ?? "").trim().toLowerCase();
        const password = String(body.password ?? "");
        const full_name = String(body.full_name ?? "").trim();
        const job_title = String(body.job_title ?? "").trim();
        const manager_id = body.manager_id || null;

        if (!/^[a-z0-9._-]{3,30}$/.test(username))
          return json({ error: "اسم المستخدم من 3 إلى 30 حرف: حروف إنجليزية صغيرة وأرقام و . _ -" }, 400);
        if (password.length < 8) return json({ error: "كلمة السر لازم تكون 8 حروف على الأقل" }, 400);
        if (!full_name) return json({ error: "اكتب اسم الموظف" }, 400);

        if (!me.is_admin) {
          const ok = manager_id && (manager_id === me.id || (await isAncestor(me.id, manager_id)));
          if (!ok) return json({ error: "تقدر تضيف موظفين تحت إدارتك فقط" }, 403);
        }

        const { data: taken } = await admin
          .from("profiles").select("id").eq("username", username).maybeSingle();
        if (taken) return json({ error: "اسم المستخدم ده مستخدم قبل كده" }, 409);

        const { data, error } = await admin.auth.admin.createUser({
          email: `${username}@${EMAIL_DOMAIN}`,
          password,
          email_confirm: true,
          user_metadata: { username, full_name, job_title, manager_id: manager_id ?? "" },
        });
        if (error) return json({ error: error.message }, 400);
        return json({ id: data.user.id });
      }

      case "set_password": {
        const target = String(body.user_id ?? "");
        const password = String(body.password ?? "");
        if (password.length < 8) return json({ error: "كلمة السر لازم تكون 8 حروف على الأقل" }, 400);
        // تغيير كلمة سر حد تاني: الأدمن الرئيسي بس
        if (target !== me.id && !me.is_admin)
          return json({ error: "تغيير كلمة سر الموظفين متاح للمدير الرئيسي بس" }, 403);
        const { error } = await admin.auth.admin.updateUserById(target, { password });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "set_active": {
        const target = String(body.user_id ?? "");
        const active = !!body.active;
        if (target === me.id) return json({ error: "مش هينفع توقف حسابك" }, 400);
        if (!(await canManage(target))) return json({ error: "غير مسموح" }, 403);
        const { error } = await admin.auth.admin.updateUserById(target, {
          ban_duration: active ? "none" : "876000h",
        });
        if (error) return json({ error: error.message }, 400);
        await admin.from("profiles").update({ active }).eq("id", target);
        return json({ ok: true });
      }

      case "delete": {
        const target = String(body.user_id ?? "");
        if (target === me.id) return json({ error: "مش هينفع تحذف حسابك" }, 400);
        if (!(await canManage(target))) return json({ error: "غير مسموح" }, 403);
        // الموظفين اللي تحته يتنقلوا لمديره
        const { data: t } = await admin.from("profiles").select("manager_id").eq("id", target).single();
        await admin.from("profiles").update({ manager_id: t?.manager_id ?? null }).eq("manager_id", target);
        const { error } = await admin.auth.admin.deleteUser(target);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
