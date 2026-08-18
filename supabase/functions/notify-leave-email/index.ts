// ============================================================
// notify-leave-email — emails HR when an employee applies for leave.
//
// Reproduces the mail the old Google Form / Apps Script used to send from
// systems@hagerstone.com, so nothing changes for the people reading it: same
// subject line, same plain-text body, same "Click Here" call to action — only
// the link now points at the Leave Requests panel in the Hub instead of the
// Google Form, because that's where approving actually updates the row.
//
// Called (fire-and-forget) by the attendance portal right after the
// leave_requests row is inserted. Requires a signed-in caller — Supabase
// enforces that for us via verify_jwt, so only a logged-in employee can make
// this send. The payload is trusted the same way the WhatsApp path trusts it:
// this is an internal tool and the mail only ever goes to two fixed HR inboxes.
//
// Secrets (supabase secrets set ...):
//   SMTP_USER  systems@hagerstone.com
//   SMTP_PASS  16-char Google Workspace App Password for that account
//   HUB_URL    https://hub.hagerstone.com   (optional; overrides the caller)
//   LEAVE_MAIL_TO  optional CSV to override the default recipients
// ============================================================

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Both HR inboxes get every request. Overridable without a redeploy.
const DEFAULT_TO = ["ea@hagerstone.com", "systems@hagerstone.com"];

// Leave types, mirrored from src/leaveConfig.js. The old mail printed the
// English label with the Hindi in brackets ("Emergency Leave (आपात छुट्टी)"),
// so keep both here rather than shipping only what the portal stores.
const LEAVE_LABELS: Record<string, string> = {
  casual:      "Casual Leave (आकस्मिक अवकाश)",
  half_day:    "Half Day Leave (आधे दिन की छुट्टी)",
  short_leave: "Short Leave (थोड़े समय की छुट्टी)",
  emergency:   "Emergency Leave (आपात छुट्टी)",
  sick:        "Sick Leave (बीमारी के लिए)",
  uninformed:  "Uninformed Leave (बिना सूचना छुट्टी)",
};

// "2026-08-17" → "8/17/2026", matching the M/D/YYYY the Apps Script produced.
// Parsed by hand: `new Date(iso)` would drag the value through UTC and can slip
// a day for anyone east of Greenwich, which is everyone here.
function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  if (!m) return String(iso ?? "");
  return `${Number(m[2])}/${Number(m[3])}/${m[1]}`;
}

// Header injection guard — a newline in a name would let the caller append
// their own headers or recipients to the message.
function oneLine(s: unknown): string {
  return String(s ?? "").replace(/[\r\n]+/g, " ").trim();
}

function buildSubject(name: string): string {
  return `New Leave Request Form | ${oneLine(name) || "Employee"}`;
}

// NOTE: "End Date::" carries the double colon from the original Apps Script
// template on purpose — this is a byte-for-byte match of the mail HR has been
// reading for years. Drop one colon here if you'd rather have it clean.
function buildBody(req: Record<string, unknown>, link: string): string {
  const type = LEAVE_LABELS[String(req.leave_type)] ?? String(req.leave_type ?? "—");
  return (
    `*Hi, Sir*\n\n` +
    `I hope this email finds you well.\n\n` +
    `Type of leave: ${type}\n` +
    `Reason of leave: ${oneLine(req.reason) || "—"}\n` +
    `Start Date: ${fmtDate(String(req.start_date ?? ""))}\n` +
    `End Date:: ${fmtDate(String(req.end_date ?? ""))}\n\n` +
    `Please Update the Status as per your decisions please Click The Link update Status\n\n` +
    `Click Here ${link}\n`
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    if (!SMTP_USER || !SMTP_PASS) {
      return json({ error: "SMTP_USER / SMTP_PASS are not configured on this function." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { employee, leave, hub_url } = body ?? {};
    if (!employee?.full_name) return json({ error: "employee.full_name is required." }, 400);
    if (!leave?.start_date || !leave?.leave_type) {
      return json({ error: "leave.leave_type and leave.start_date are required." }, 400);
    }

    // Approvers open this to act on the request, so it must point at THIS app —
    // hr-hiring-automation.vercel.app, which owns the Leave Requests panel.
    // HUB_PUBLIC_URL is read only as a last resort: the other Hub functions set
    // it to hagerstone-hub.vercel.app, a different app on the same database with
    // no leave panel, so HUB_URL has to win over it.
    const base = (Deno.env.get("HUB_URL") || hub_url || Deno.env.get("HUB_PUBLIC_URL") || "")
      .replace(/\/+$/, "");
    const link = base ? `${base}/?panel=leave` : "the Hagerstone Hub → Leave Requests";

    const to = (Deno.env.get("LEAVE_MAIL_TO") || "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const recipients = to.length ? to : DEFAULT_TO;

    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "smtp.gmail.com",
        port: Number(Deno.env.get("SMTP_PORT") || 465),
        tls: true,
        auth: { username: SMTP_USER, password: SMTP_PASS },
      },
    });

    try {
      await client.send({
        from: SMTP_USER,
        to: recipients,
        subject: buildSubject(employee.full_name),
        content: buildBody(leave, link),
      });
    } finally {
      await client.close().catch(() => {});
    }

    return json({ ok: true, sent_to: recipients });
  } catch (e) {
    // Surfaced in the function logs; the portal ignores it so a mail failure
    // never costs the employee their leave request.
    console.error("notify-leave-email failed:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
