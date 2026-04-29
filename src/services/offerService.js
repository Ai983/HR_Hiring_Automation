import { supabase } from "../supabaseClient.js";

export function computeCtcBreakup(grossAnnual) {
  const basic = grossAnnual * 0.40;
  const hra = grossAnnual * 0.20;
  const special_allowance = grossAnnual * 0.30;
  const pf_employee = basic * 0.12;
  const pf_employer = basic * 0.12;
  const gratuity = grossAnnual * 0.0481;
  const take_home_monthly = Math.round((grossAnnual - pf_employee - pf_employer) / 12);
  return { basic, hra, special_allowance, pf_employee, pf_employer, gratuity, take_home_monthly };
}

export async function fetchOffers() {
  if (!supabase) return [];
  const { data } = await supabase
    .from("offers")
    .select("*, applicants(full_name, email, phone, job_id, jobs(title))")
    .order("created_at", { ascending: false });
  return data || [];
}

export async function fetchOfferForApplicant(applicantId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from("offers")
    .select("*")
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data || null;
}

export async function createOffer(fields) {
  const breakup = computeCtcBreakup(fields.ctc_gross_annual);
  const { data, error } = await supabase
    .from("offers")
    .insert({ ...fields, ctc_breakup: breakup })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateOffer(id, fields) {
  const { data, error } = await supabase
    .from("offers")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
