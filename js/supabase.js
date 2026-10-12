const config = window.IB_CONFIG || {};
export const demoMode = !config.url || !config.key || config.url.includes('PASTE_') || config.key.includes('PASTE_');
let client;
export function getClient() {
  if (demoMode) throw new Error('Demo mode: connect Supabase in js/config.js to enable submissions.');
  if (!client) {
    const url = new URL(config.url);
    if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.');
    if (config.key.startsWith('sb_secret_')) throw new Error('A secret key cannot be used in the browser. Use a publishable key.');
    // Reject legacy service-role JWTs too; browser keys must be public.
    if (config.key.split('.').length === 3) {
      try { const body = config.key.split('.')[1]; const payload = JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(body.length/4)*4,'='))); if (payload.role === 'service_role') throw new Error('service_role keys must never be used in the browser.'); }
      catch (error) { if (error.message.includes('service_role')) throw error; }
    }
    if (!window.supabase?.createClient) throw new Error('The Supabase library could not load. Check your connection to cdn.jsdelivr.net and retry.');
    client = window.supabase.createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  return client;
}
export function safeImageURL(value, isDemo = false) {
  try {
    const url = new URL(value, location.href);
    if (isDemo) return url.origin === location.origin && url.pathname.endsWith('.svg') ? url.href : null;
    const expected = new URL(config.url);
    return url.protocol === 'https:' && url.origin === expected.origin && url.pathname.startsWith('/storage/v1/object/public/memes/') ? url.href : null;
  } catch { return null; }
}
export async function fetchMemes() {
  const rows = []; const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const {data, error} = await getClient().from('memes').select('id,title,image_url,category,tags,display_name,likes,downloads,reports,created_at,status').eq('status','approved').order('created_at', {ascending:false}).order('id', {ascending:true}).range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}
export async function increment(kind, id) {
  const names = {like:'increment_meme_like', download:'increment_meme_download', report:'increment_meme_report'};
  if (!names[kind]) throw new Error('Unknown action');
  const {data, error} = await getClient().rpc(names[kind], {meme_id:id});
  if (error) throw error;
  if (data === null) throw new Error('This meme is no longer available. Refresh the feed.');
  return Number(data);
}
if (demoMode) console.warn('IB Meme Hub is in demo mode. Set the Supabase Project URL and public publishable/anon key in js/config.js to load the community feed.');
