import { createClient } from "@supabase/supabase-js";

// Use Vite's env (from .env) – Vite injects these at dev/build time so they always load
const supabaseUrl = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || "";
const supabaseAnon = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || "";

export const supabase = supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;
export { supabaseUrl, supabaseAnon };
