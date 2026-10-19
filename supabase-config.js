/* Public browser configuration only. Never put a Supabase service_role key here.
   Create a Supabase project, enable Email auth, run supabase/collection_items.sql,
   then replace these placeholders with the Project URL and anon/public key. */
window.SHAQS_SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_PROJECT_URL",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};
window.shaqsSupabaseReady = function () {
  const c = window.SHAQS_SUPABASE_CONFIG || {};
  return !!(window.supabase && c.url && c.anonKey &&
    /^https:\/\//.test(c.url) &&
    !c.url.includes("YOUR_SUPABASE") &&
    !c.anonKey.includes("YOUR_SUPABASE"));
};
window.shaqsCreateSupabaseClient = function () {
  if (!window.shaqsSupabaseReady()) return null;
  if (!window.__shaqsSupabaseClient) {
    window.__shaqsSupabaseClient = window.supabase.createClient(
      window.SHAQS_SUPABASE_CONFIG.url,
      window.SHAQS_SUPABASE_CONFIG.anonKey,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
  }
  return window.__shaqsSupabaseClient;
};
