export const $ = (selector, root = document) => root.querySelector(selector);
const ICON_PATHS = {
  arrow:'M7 17 17 7M7 7h10v10',
  search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  random:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01',
  sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1',
  moon:'M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11',
  like:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',
  share:'M7 17 17 7M7 7h10v10',
  download:'M12 3v12M7 10l5 5 5-5M5 17v4h14v-4',
  upload:'M12 21V5M7 10l5-5 5 5',
  report:'M5 21V3M5 3h14l-3 5 3 5H5',
  menu:'M4 6h16M4 12h16M4 18h16',
  plus:'M12 5v14M5 12h14',
  close:'m6 6 12 12M18 6 6 18'
};
export function icon(name, filled=false) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','vector-icon');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',ICON_PATHS[name]||ICON_PATHS.arrow);path.setAttribute('fill',filled?'currentColor':'none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.append(path);return svg;
}
function replaceStaticIcons() {
  const map={'↗':'arrow','⚄':'random','⌕':'search','↝':'random','☰':'menu','＋':'plus','×':'close'};
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];
  while(walker.nextNode())if(/[↗⚄⌕↝☰＋×]/.test(walker.currentNode.textContent)&&!['SCRIPT','STYLE'].includes(walker.currentNode.parentElement.tagName))nodes.push(walker.currentNode);
  nodes.forEach(node=>{const fragment=document.createDocumentFragment();node.textContent.split(/([↗⚄⌕↝☰＋×])/).forEach(part=>fragment.append(map[part]?icon(map[part]):document.createTextNode(part)));node.replaceWith(fragment);});
}
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  // User content is always text, never interpolated into HTML.
  if (text !== undefined) node.textContent = text;
  return node;
}
let toastTimer;
export function toast(message) {
  const node = $('#toast'); node.textContent = message; node.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 4500);
}
export function readLocal(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; }
}
export function writeLocal(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Session state still works if storage is blocked. */ } }
export function openDialog(dialog) { if (!dialog.open) dialog.showModal(); syncScroll(); }
export function closeDialog(dialog) { dialog.close(); syncScroll(); }
function syncScroll() { document.body.classList.toggle('modal-open', !!$('dialog[open]')); }
export function initUI() {
  replaceStaticIcons();
  $('#year').textContent = new Date().getFullYear();
  const storedTheme = readLocal('ib-theme', 'dark');
  document.documentElement.dataset.theme = storedTheme === 'light' ? 'light' : 'dark';
  const themeButton = $('#theme-toggle');
  const syncTheme = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeButton.replaceChildren(icon(dark?'sun':'moon')); themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  };
  syncTheme();
  themeButton.addEventListener('click', () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; writeLocal('ib-theme', document.documentElement.dataset.theme); syncTheme(); });
  $('#menu-toggle').addEventListener('click', () => { const open = $('#main-nav').classList.toggle('open'); $('#menu-toggle').setAttribute('aria-expanded', String(open)); });
  $('#main-nav').addEventListener('click', (event) => { if (event.target.closest('a,button')) { $('#main-nav').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded', 'false'); } });
  $('#search-focus').addEventListener('click', () => { $('#feed').scrollIntoView(); $('#search').focus({preventScroll: true}); });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('dialog[open]')) { event.preventDefault(); $('#feed').scrollIntoView(); $('#search').focus({preventScroll: true}); }
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(dialog); } });
    dialog.addEventListener('close', syncScroll);
    dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(dialog)));
  });
}
export function friendlyError(error) {
  const message = String(error?.message || 'Unexpected error');
  if (/fetch|network|load failed/i.test(message)) return 'Could not connect. Check your internet connection and try again.';
  if (/row.level|permission|policy|unauthorized/i.test(message)) return 'The upload policy is not ready. The site owner needs to check the Supabase setup.';
  if (/bucket/i.test(message)) return 'Image storage is not ready. The site owner needs to create the memes bucket.';
  return message.length > 180 ? 'Something went wrong. Please try again.' : message;
}
