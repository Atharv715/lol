import {el, $, icon as makeIcon, toast, openDialog, closeDialog, readLocal, writeLocal, friendlyError} from './ui.js';
import {safeImageURL, increment} from './supabase.js';
export const CATEGORIES = ['General IB','Math AA','Math AI','Economics','Business Management','ESS','Biology','Chemistry','Physics','Computer Science','English','Spanish','Psychology','History','Geography','TOK','Extended Essay','Internal Assessments','CAS','Mocks','Final Exams','Predicted Grades','University Applications','IB Teachers','Group Projects','Procrastination'];
export const DEMO_MEMES = [
  ['ee-summer','“I’ll start my EE over the summer”','Extended Essay',['ee','procrastination'],148,32,'ee'],
  ['tok-chair','TOK students trying to prove a chair exists','TOK',['tok','existential crisis'],126,26,'tok'],
  ['math-aa','The calculator has more confidence than me','Math AA',['math','exam season'],98,21,'math'],
  ['cas-sleep','Can I count sleeping as a CAS activity?','CAS',['cas','self-care'],117,18,'cas'],
  ['predicted-grade','My predicted grade vs. my actual knowledge','Predicted Grades',['grades','expectations'],86,14,'grades'],
  ['ia-tabs','One IA. Forty-seven tabs. Zero words.','Internal Assessments',['ia','research'],103,22,'ia']
].map(([id,title,category,tags,likes,downloads,asset],i) => ({id:`demo-${id}`,title,category,tags,likes,downloads,reports:0,display_name:'Anonymous IB Survivor',created_at:new Date(Date.now()-(i+1)*86400000).toISOString(),image_url:`./assets/meme-${asset}.svg`,status:'approved',demo:true}));
const likedRaw = readLocal('ib-liked', []), reportedRaw = readLocal('ib-reported', []);
const liked = new Set(Array.isArray(likedRaw) ? likedRaw : []), reported = new Set(Array.isArray(reportedRaw) ? reportedRaw : []);
const busy = new Set();
let onChange = () => {}, reportTarget = null;
export function setOnChange(callback) { onChange = callback; }
export function trendingScore(meme) { const age = Math.max(0,(Date.now()-new Date(meme.created_at).getTime())/3600000); return (Number(meme.likes)*2 + Number(meme.downloads)*3 + 5)/Math.pow(age+4,.65); }
export function shuffle(items) { const result = [...items]; for (let i=result.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; } return result; }
function dateLabel(meme) { return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(meme.created_at)); }
function image(meme, detail=false) {
  const img=el('img',detail?'detail-image':'meme-image'); const url=safeImageURL(meme.image_url,meme.demo); img.alt=meme.title; img.loading=detail?'eager':'lazy'; img.decoding='async'; img.width=600; img.height=450;
  img.addEventListener('error',()=>{img.classList.add('image-failed');img.alt=`Image unavailable: ${meme.title}`;}, {once:true});
  if(url) img.src=url; else {img.classList.add('image-failed');img.alt='Image unavailable: invalid storage URL';}
  return img;
}
function tags(meme) { const node=el('div','card-tags'); (Array.isArray(meme.tags)?meme.tags:[]).forEach(tag=>node.append(el('span','',`#${tag}`))); return node; }
function actions(meme) {
  const node=el('div','card-actions');
  const options=[['like',liked.has(meme.id)?'♥':'♡',String(meme.likes),'Like meme'],['download','↓','Save','Download meme'],['share','↗','','Share meme'],['report','⚑','','Report meme']];
  options.forEach(([kind,icon,text,label])=>{
    const b=el('button',`action-button ${kind==='like'?'like':''} ${kind==='like'&&liked.has(meme.id)?'liked':''}`); b.type='button'; b.dataset.action=kind; b.dataset.memeId=meme.id; b.setAttribute('aria-label',label); const symbol=el('span','action-icon');symbol.append(makeIcon(kind,kind==='like'&&liked.has(meme.id)));b.append(symbol); if(text)b.append(el('span','action-label',text));
    if(kind==='like') {b.setAttribute('aria-pressed',String(liked.has(meme.id)));b.disabled=liked.has(meme.id)||busy.has(`like:${meme.id}`);}
    if(kind==='report')b.disabled=reported.has(meme.id);
    b.addEventListener('click',()=>handleAction(kind,meme,b)); node.append(b);
  });return node;
}
export function card(meme) {
  const node=el('article','meme-card'); const button=el('button','meme-image-button'); button.type='button'; button.setAttribute('aria-label',`View ${meme.title}`); button.append(image(meme)); if(meme.demo)button.append(el('span','demo-badge','DEMO MEME')); button.addEventListener('click',()=>openMeme(meme));
  const content=el('div','card-content'); const meta=el('div','card-meta');meta.append(el('span','category-badge',meme.category),el('time','',dateLabel(meme)));meta.lastChild.dateTime=meme.created_at;
  content.append(meta,el('h3','card-title',meme.title),tags(meme),actions(meme));node.append(button,content);return node;
}
export function openMeme(meme,updateURL=true) {
  const layout=el('div','detail-layout'), copy=el('div','detail-copy'); const title=el('h2','',meme.title);title.id='meme-detail-title';
  copy.append(el('span','category-badge',meme.category),title,tags(meme),el('p','detail-byline',`By ${meme.display_name || 'Anonymous IB Survivor'} · ${dateLabel(meme)}`),el('p','detail-counts',`${meme.likes} likes · ${meme.downloads} downloads${meme.demo?' · Demo content':''}`),actions(meme));
  layout.append(image(meme,true),copy);$('#meme-detail').replaceChildren(layout);$('#meme-dialog').dataset.memeId=meme.id;openDialog($('#meme-dialog'));
  if(updateURL){const url=new URL(location.href);url.searchParams.set('meme',meme.id);history.replaceState(null,'',url);}
}
export function initMemeActions() {
  $('#meme-dialog').addEventListener('close',()=>{const url=new URL(location.href);url.searchParams.delete('meme');history.replaceState(null,'',url);});
  $('#report-cancel').addEventListener('click',()=>closeDialog($('#report-dialog')));
  $('#report-confirm').addEventListener('click',async()=>{const meme=reportTarget;if(!meme)return;const b=$('#report-confirm');b.disabled=true;try{await record('report',meme);reported.add(meme.id);writeLocal('ib-reported',[...reported]);closeDialog($('#report-dialog'));toast('Thanks. The meme has been reported.'+(meme.demo?' (Demo only.)':''));refresh(meme);}catch(error){toast(friendlyError(error));}finally{b.disabled=false;}});
}
function refresh(meme) { onChange();if($('#meme-dialog').open&&$('#meme-dialog').dataset.memeId===meme.id)openMeme(meme,false); }
async function record(kind,meme) {const field={like:'likes',download:'downloads',report:'reports'}[kind];const count=meme.demo?Number(meme[field])+1:await increment(kind,meme.id);meme[field]=count;}
async function handleAction(kind,meme,button) {
  const key=`${kind}:${meme.id}`;if(busy.has(key))return;
  if(kind==='report'){if(reported.has(meme.id))return;reportTarget=meme;openDialog($('#report-dialog'));return;}
  if(kind==='like'&&liked.has(meme.id))return;
  busy.add(key);button.disabled=true;
  try {
    if(kind==='like'){await record('like',meme);liked.add(meme.id);writeLocal('ib-liked',[...liked]);refresh(meme);document.querySelectorAll('[data-action="like"]').forEach(b=>{if(b.dataset.memeId===meme.id)b.classList.add('like-pop');});if(meme.demo)toast('Demo like saved in this browser.');}
    if(kind==='download'){
      const url=safeImageURL(meme.image_url,meme.demo);if(!url)throw new Error('This image URL is not available.');
      let countError;try{await record('download',meme);}catch(error){countError=error;}
      let objectURL;
      try{const response=await fetch(url);if(!response.ok)throw new Error('Image unavailable');const blob=await response.blob();if(!/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(blob.type))throw new Error('Unsupported image response');objectURL=URL.createObjectURL(blob);const a=el('a');a.href=objectURL;const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'}[blob.type];a.download=(meme.title.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'ib-meme')+'.'+ext;document.body.append(a);a.click();a.remove();toast(countError?'Image downloaded; the download count could not be updated.':'Meme saved. Your group chat thanks you.');}
      catch{const a=el('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open image to save';const state=$('#toast');state.replaceChildren(document.createTextNode('Download unavailable. '),a);state.hidden=false;setTimeout(()=>{state.hidden=true;},8000);}
      finally{if(objectURL)setTimeout(()=>URL.revokeObjectURL(objectURL),1000);}
      refresh(meme);
    }
    if(kind==='share'){
      const url=new URL(location.href);url.hash='';url.searchParams.set('meme',meme.id);
      if(navigator.share){try{await navigator.share({title:meme.title,text:'From IB Meme Hub',url:url.href});return;}catch(error){if(error.name==='AbortError')return;}}
      try{await navigator.clipboard.writeText(url.href);toast('Link copied!');}catch{const input=el('input');input.value=url.href;input.setAttribute('aria-label','Meme share link');$('#toast').replaceChildren(document.createTextNode('Copy this link: '),input);$('#toast').hidden=false;input.focus();input.select();}
    }
  }catch(error){toast(friendlyError(error));}finally{busy.delete(key);button.disabled=false;if(kind==='like'&&liked.has(meme.id))button.disabled=true;}
}
