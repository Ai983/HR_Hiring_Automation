import { supabase } from "../supabaseClient.js";

// ─────────────────────────────────────────────────────────────────────
// Company policy documents (hr.policies + the private `hr-policies` bucket).
//
// READ is open to every authenticated employee — that is the point of
// publishing a policy. WRITE is hr_admin/super_admin, enforced in RLS, not
// here: the checks in this file only decide what the UI offers. Never treat
// a client-side role check as the control.
// ─────────────────────────────────────────────────────────────────────

const BUCKET = "hr-policies";

/** The four sections HR asked for, plus a catch-all. Order is display order. */
export const POLICY_CATEGORIES = [
  { id: "company",            label: "Company Policy",       icon: "🏛", blurb: "How Hagerstone works — conduct, communication, escalation." },
  { id: "timings_attendance", label: "Timings & Attendance", icon: "⏰", blurb: "Office hours, punch-in rules, late marks, overtime." },
  { id: "leave",              label: "Leave Policy",         icon: "🌴", blurb: "Entitlements, how to apply, approvals, unpaid leave." },
  { id: "ztp",                label: "ZTP Policy",           icon: "🚫", blurb: "Zero Tolerance Policy — conduct that ends employment." },
  { id: "other",              label: "Other",                icon: "📄", blurb: "Anything that doesn't belong in the four above." },
];

export const categoryLabel = (id) =>
  POLICY_CATEGORIES.find((c) => c.id === id)?.label || id;

// Word, PDF and plain text. Deliberately narrow: this is a document library,
// and letting people upload .exe or .zip here turns it into a file share.
export const ACCEPTED_POLICY_TYPES =
  ".pdf,.doc,.docx,application/pdf,application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const MAX_POLICY_BYTES = 25 * 1024 * 1024; // 25 MB

/** Every policy, newest first. RLS decides what comes back. */
export async function fetchPolicies({ includeInactive = false } = {}) {
  if (!supabase) return [];
  let q = supabase.from("policies").select("*").order("created_at", { ascending: false });
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message || "Could not load policies.");
  return data || [];
}

/**
 * Upload the file, then write the row.
 *
 * Order matters and is not arbitrary. If the row were written first and the
 * upload then failed, the library would list a policy that 404s when anyone
 * clicks it — the worst failure mode here, because it looks published. This
 * way a failed upload leaves nothing behind, and a failed insert leaves an
 * orphaned object that costs storage but misleads nobody. The orphan is
 * cleaned up below rather than left to rot.
 */
export async function uploadPolicy({ category, title, description, effectiveFrom, file, ctx }) {
  if (!supabase) throw new Error("Supabase not configured.");
  if (!file) throw new Error("Choose a file to upload.");
  if (file.size > MAX_POLICY_BYTES) {
    throw new Error(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`);
  }

  const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
  const path = `${category}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) {
    throw new Error(
      /row-level security|not authorized|403/i.test(upErr.message || "")
        ? "You don't have permission to upload policies. Ask a super admin."
        : upErr.message || "Upload failed."
    );
  }

  const { data, error } = await supabase
    .from("policies")
    .insert({
      category,
      title: title.trim(),
      description: description?.trim() || null,
      effective_from: effectiveFrom || null,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: ctx?.employee_id || null,
      uploaded_by_name: ctx?.name || null,
    })
    .select("*")
    .single();

  if (error) {
    // Don't leave the uploaded object behind pointing at nothing.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw new Error(error.message || "Could not save the policy.");
  }
  return data;
}

/**
 * The bucket is PRIVATE, so a download is a short-lived signed URL rather
 * than a stable link. Five minutes is enough to open or save the file and
 * short enough that a URL pasted into a group chat is dead on arrival.
 */
export async function signedPolicyUrl(path, expiresIn = 300) {
  if (!supabase) throw new Error("Supabase not configured.");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message || "Could not open that document.");
  return data.signedUrl;
}

/** Supersede rather than delete — see the migration header. */
export async function archivePolicy(id) {
  const { error } = await supabase.from("policies").update({ is_active: false }).eq("id", id);
  if (error) throw new Error(error.message || "Could not archive that policy.");
}

export async function restorePolicy(id) {
  const { error } = await supabase.from("policies").update({ is_active: true }).eq("id", id);
  if (error) throw new Error(error.message || "Could not restore that policy.");
}

/**
 * Permanent removal — row AND file. Only for a mistaken upload; a superseded
 * policy should be archived so the history survives.
 */
export async function deletePolicy(policy) {
  const { error } = await supabase.from("policies").delete().eq("id", policy.id);
  if (error) throw new Error(error.message || "Could not delete that policy.");
  // Best-effort: the row is already gone, so a failure here is an orphaned
  // file, not a broken listing.
  if (policy.file_path) {
    await supabase.storage.from(BUCKET).remove([policy.file_path]).catch(() => {});
  }
}
