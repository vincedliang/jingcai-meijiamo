import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true" || !supabaseUrl || !supabaseAnonKey;

export const supabase = isDemoMode ? null : createClient(supabaseUrl!, supabaseAnonKey!);
