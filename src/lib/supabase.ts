import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// supabase-js wants the project's base URL; tolerate a pasted REST endpoint (…/rest/v1/) too.
const url = import.meta.env.SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const anonKey = import.meta.env.SUPABASE_ANON_KEY?.trim();

/** False when SUPABASE_URL / SUPABASE_ANON_KEY are missing, so the app can say so instead of crashing. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  return supabase;
}

/** Turns a Supabase/PostgREST error (or anything thrown) into one readable sentence. */
export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [e.message, e.details, e.hint].filter((p): p is string => typeof p === 'string' && p.length > 0);
    if (parts.length > 0) return parts.join(' — ');
  }
  if (typeof err === 'string') return err;
  return 'Something went wrong. Check your connection and try again.';
}
