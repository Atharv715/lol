// Only a public publishable/anon key belongs here. NEVER use a service_role key.
const SUPABASE_URL = "PASTE_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_SUPABASE_ANON_KEY_HERE";
window.IB_CONFIG = Object.freeze({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY });
