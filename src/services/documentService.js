import { supabase } from "../supabaseClient.js";

export const DOC_TYPES = [
  { id: "aadhaar",              label: "Aadhaar Card",              mandatory: true },
  { id: "pan",                  label: "PAN Card",                  mandatory: true },
  { id: "salary_slip_1",        label: "Salary Slip (Month 1)",     mandatory: true },
  { id: "salary_slip_2",        label: "Salary Slip (Month 2)",     mandatory: false },
  { id: "salary_slip_3",        label: "Salary Slip (Month 3)",     mandatory: false },
  { id: "previous_offer_letter",label: "Previous Offer Letter",     mandatory: false },
  { id: "experience_letter",    label: "Experience Letter",         mandatory: false },
  { id: "education_10th",       label: "10th Certificate",          mandatory: true },
  { id: "education_12th",       label: "12th Certificate",          mandatory: false },
  { id: "education_graduation", label: "Graduation Certificate",    mandatory: false },
  { id: "education_postgrad",   label: "Post Grad Certificate",     mandatory: false },
  { id: "bank_passbook",        label: "Bank Passbook / Cancelled Cheque", mandatory: true },
  { id: "cancelled_cheque",     label: "Cancelled Cheque",          mandatory: false },
  { id: "photo",                label: "Passport Size Photo",       mandatory: true },
  { id: "passport",             label: "Passport",                  mandatory: false },
];

export async function fetchDocuments(joiningId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("joining_id", joiningId);
  return data || [];
}

export async function initDocuments(joiningId) {
  const rows = DOC_TYPES.map((d) => ({ joining_id: joiningId, doc_type: d.id, status: "pending" }));
  const { data, error } = await supabase.from("documents").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDocument(id, fields) {
  const { data, error } = await supabase
    .from("documents")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function countPendingDocuments(joiningId) {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("joining_id", joiningId)
    .eq("status", "pending");
  return count || 0;
}
