import { $, el, initUI, toast, friendlyError } from './ui.js';
import { demoMode, fetchMemes } from './supabase.js';
import { CATEGORIES, DEMO_MEMES, card, shuffle, trendingScore, openMeme, setOnChange, initMemeActions } from './memes.js';
import { initUpload } from './upload.js';
let memes=[],sort='trending',category='',query='',visible=12,randomOrder=[];
initUI();initMemeActions();initUpload();
const popular=['','General IB','TOK','Extended Essay','Math AA','CAS','Internal Assessments'];
popular.forEach(value=>{const button=el('button',`chip ${value===''?'active':''}`,value||'All memes');button.dataset.category=value;button.setAttribute('aria-pressed',String(value===''));button.addEventListener('click',()=>setCategory(value));$('#category-chips').append(button);});
CATEGORIES.forEach(value=>{const option=el('option','',value);option.value=value;$('#category-select').append(option);});
function setCategory(value){category=value;visible=12;$('#category-select').value=value;document.querySelectorAll('[data-category]').forEach(button=>{const active=button.dataset.category===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});render();}
$('#category-select').addEventListener('change',event=>setCategory(event.target.value));
$('#search').addEventListener('input',event=>{query=event.target.value.toLocaleLowerCase().trim();visible=12;render();});
document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{
  sort=button.dataset.sort;visible=12;if(sort==='random')randomOrder=shuffle(memes);
  document.querySelectorAll('.sort-tab').forEach(node=>{const active=node.dataset.sort===sort;node.classList.toggle('active',active);node.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('#main-nav [data-sort]').forEach(node=>node.classList.toggle('active',node===button));render();
}));
function filtered(){let rows=(sort==='random'?randomOrder:memes).filter(m=> (!category||m.category===category)&&(!query||[m.title,m.category,...(Array.isArray(m.tags)?m.tags:[])].join(' ').toLocaleLowerCase().includes(query)));if(sort==='trending')rows.sort((a,b)=>trendingScore(b)-trendingScore(a));if(sort==='newest')rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));return rows;}
function state(title,message,retry){const node=$('#feed-state');node.replaceChildren(el('h3','',title),el('p','',message));if(retry){const button=el('button','button button-outline','Try again');button.addEventListener('click',load);node.append(button);}node.hidden=false;}
function render(){const rows=filtered();$('#result-count').textContent=`${rows.length} ${rows.length===1?'meme':'memes'}${category?' · '+category:''}${demoMode?' · Demo feed':''}`;$('#meme-grid').replaceChildren(...rows.slice(0,visible).map(card));$('#load-more').hidden=rows.length<=visible;$('#feed-state').hidden=true;if(!rows.length)state(memes.length?'No memes found.':'No memes yet.',memes.length?'Even TOK has more answers than this. Try another search or category.':'Be the first to give this community something to laugh about. Approved memes will appear here.');}
setOnChange(render);
$('#load-more').addEventListener('click',()=>{visible+=12;render();});
document.querySelectorAll('[data-random]').forEach(button=>button.addEventListener('click',()=>{const rows=filtered();if(!rows.length){toast('No memes in this selection yet. Try another filter.');return;}openMeme(rows[Math.floor(Math.random()*rows.length)]);}));
async function load(){
  $('#feed-state').hidden=true;$('#load-more').hidden=true;$('#result-count').textContent='Loading the good stuff…';$('#meme-grid').replaceChildren(...Array.from({length:6},()=>{const n=el('div','skeleton');n.setAttribute('aria-hidden','true');n.append(el('div','skeleton-image'),el('div','skeleton-line'),el('div','skeleton-line'));return n;}));
  try{memes=demoMode?DEMO_MEMES:await fetchMemes();randomOrder=shuffle(memes);$('#demo-banner').hidden=!demoMode;render();const id=new URL(location.href).searchParams.get('meme');if(id){const meme=memes.find(m=>m.id===id);if(meme)openMeme(meme,false);else toast('That meme is unavailable or still awaiting approval.');}}
  catch(error){memes=[];randomOrder=[];$('#meme-grid').replaceChildren();$('#result-count').textContent='Feed unavailable';state('The feed needs a little recovery time.',friendlyError(error),true);}
}
load();
