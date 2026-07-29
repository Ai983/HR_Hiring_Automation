// ============================================================
// notify-attendance — broadcast the "new attendance system" guide to employees
// over WhatsApp (MayTAPI). Admin/HR only. Sends to active employees with a phone
// (or a supplied subset). Message tells them to sign in with their Hagerstone
// Hub login and how to punch.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// 10-digit Indian numbers → 91XXXXXXXXXX; pass through already-prefixed ones.
function normalizePhone(raw: string): string | null {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) return "91" + d;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
  return null;
}

function buildMessage(name: string, url: string): string {
  const first = (name || "there").split(" ")[0];
  return (
    `*Hagerstone — New Attendance System* 🟢\n\n` +
    `Hi ${first}, we've moved to a new digital attendance system.\n\n` +
    `*How to mark attendance:*\n` +
    `1. Open ${url} on your phone\n` +
    `2. Sign in with your *Hagerstone Hub email & password* (same login as other tools)\n` +
    `3. Allow location access\n` +
    `4. Tap ✅ *Check In* when you arrive and 🏁 *Check Out* when you leave\n\n` +
    `You can also apply for leave from the same screen.\n\n` +
    `Questions? Contact HR.`
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // MayTAPI config (edge-function secrets).
    const MT_PRODUCT = Deno.env.get("MAYTAPI_PRODUCT_ID")!;
    const MT_PHONE = Deno.env.get("MAYTAPI_PHONE_ID")!;
    const MT_TOKEN = Deno.env.get("MAYTAPI_TOKEN")!;

    const body = await req.json().catch(() => ({}));
    const { portal_url, employee_ids, test_phone, dry_run } = body ?? {};
    if (!portal_url) return json({ error: "portal_url is required." }, 400);

    // ── Admin/HR gate ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return json({ error: "Not signed in." }, 401);

    const pub = createClient(url, serviceKey, { db: { schema: "public" } });
    const { data: caller } = await pub.from("employees").select("role, is_active").eq("auth_user_id", user.id).single();
    if (!caller || !caller.is_active || !["admin", "founder", "hr", "management"].includes(caller.role)) {
      return json({ error: "Only HR/admin can send this broadcast." }, 403);
    }

    // ── Recipients ──
    let q = pub.from("employees").select("id, name, phone").eq("is_active", true).not("phone", "is", null);
    if (Array.isArray(employee_ids) && employee_ids.length) q = q.in("id", employee_ids);
    const { data: emps, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const targets = (test_phone
      ? [{ id: "test", name: "Test", phone: String(test_phone) }]
      : (emps ?? []))
      .map((e) => ({ ...e, wa: normalizePhone(e.phone) }))
      .filter((e) => e.wa);

    if (dry_run) {
      return json({ dry_run: true, recipients: targets.length, sample: buildMessage(targets[0]?.name ?? "there", portal_url) });
    }

    // ── Send ──
    const endpoint = `https://api.maytapi.com/api/${MT_PRODUCT}/${MT_PHONE}/sendMessage`;
    let sent = 0, failed = 0;
    const results: unknown[] = [];
    for (const t of targets) {
      try {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-maytapi-key": MT_TOKEN },
          body: JSON.stringify({ to_number: t.wa, type: "text", message: buildMessage(t.name, portal_url) }),
        });
        const ok = r.ok;
        ok ? sent++ : failed++;
        results.push({ name: t.name, wa: t.wa, status: r.status });
      } catch (e) {
        failed++;
        results.push({ name: t.name, wa: t.wa, error: String(e) });
      }
    }
    return json({ ok: true, sent, failed, total: targets.length, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
