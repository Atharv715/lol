import { $, toast, openDialog, friendlyError } from './ui.js';
import { demoMode, getClient } from './supabase.js';
import { CATEGORIES } from './memes.js';
const TYPES = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
const MAX_SIZE = 10 * 1024 * 1024;
let previewURL, selectedFile, uploading=false;
export function cleanText(value,limit) {return String(value||'').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').replace(/[<>]/g,'').trim().slice(0,limit);}
export function validateFile(file) {if(!file)throw new Error('Choose a meme image first.');if(!TYPES[file.type])throw new Error('Choose a JPG, PNG, WEBP, or GIF image.');if(file.size===0)throw new Error('This file is empty. Choose another image.');if(file.size>MAX_SIZE)throw new Error('That image is over 10 MB. Try a smaller one.');}
async function validateSignature(file){const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');const ascii=String.fromCharCode(...bytes);const valid={'image/jpeg':hex.startsWith('ffd8ff'),'image/png':hex.startsWith('89504e470d0a1a0a'),'image/gif':ascii.startsWith('GIF87a')||ascii.startsWith('GIF89a'),'image/webp':ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP'};if(!valid[file.type])throw new Error('The file contents do not match its image type. Choose a valid image.');}
function status(message,error=false){$('#upload-status').textContent=message;$('#upload-status').classList.toggle('error',error);}
function selectFile(file){try{validateFile(file);selectedFile=file;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(file);$('#upload-preview').src=previewURL;$('#upload-preview').hidden=false;$('.dropzone-copy').hidden=true;status('Image selected. You can click the preview to choose another.');}catch(error){selectedFile=null;$('#upload-image').value='';if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}$('#upload-preview').removeAttribute('src');$('#upload-preview').hidden=true;$('.dropzone-copy').hidden=false;status(error.message,true);}}
export function initUpload(){
  CATEGORIES.forEach(category=>{const option=document.createElement('option');option.value=category;option.textContent=category;$('#upload-category').append(option);});
  document.querySelectorAll('[data-upload]').forEach(button=>button.addEventListener('click',()=>{openDialog($('#upload-dialog'));if(demoMode)status('Demo mode: add your Supabase Project URL and public key to js/config.js to enable real submissions.');}));
  $('#upload-image').addEventListener('change',event=>selectFile(event.target.files[0]));
  const drop=$('#dropzone');['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();if(!uploading)drop.classList.add('dragging');}));drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));
  drop.addEventListener('drop',event=>{event.preventDefault();drop.classList.remove('dragging');if(uploading)return;const file=event.dataTransfer.files[0];if(file){const transfer=new DataTransfer();transfer.items.add(file);$('#upload-image').files=transfer.files;selectFile(file);}});
  $('#upload-form').addEventListener('submit',async event=>{
    event.preventDefault();if(uploading)return;
    if(demoMode){status('This is a demo. Connect Supabase in js/config.js before uploading. Your image has not been submitted.',true);return;}
    const form=event.currentTarget;const data=new FormData(form);const title=cleanText(data.get('title'),140),category=data.get('category');
    const file=selectedFile;
    try{validateFile(file);if(!title)throw new Error('Give your meme a title.');if(!CATEGORIES.includes(category))throw new Error('Choose a valid category.');}catch(error){status(error.message,true);return;}
    const tags=[...new Set(cleanText(data.get('tags'),250).split(',').map(x=>x.trim().replace(/^#+/,'').slice(0,30)).filter(Boolean))].slice(0,8);
    const displayName=cleanText(data.get('display_name'),60)||'Anonymous IB Survivor';
    uploading=true;form.querySelectorAll('input,select,button').forEach(node=>node.disabled=true);$('#upload-submit').textContent='Uploading image…';status('Uploading your image. Please keep this window open.');
    let uploaded=false;
    try{
      await validateSignature(file);
      const client=getClient();const path=`uploads/${crypto.randomUUID()}.${TYPES[file.type]}`;
      const {error:uploadError}=await client.storage.from('memes').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});if(uploadError)throw uploadError;uploaded=true;
      $('#upload-submit').textContent='Submitting for review…';status('Image uploaded. Sending your submission for moderation…');
      const {data:publicData}=client.storage.from('memes').getPublicUrl(path);
      // Never request returning rows: pending submissions are intentionally not readable by anon.
      // Status and counters are database defaults; column grants prevent users from setting them.
      const {error:insertError}=await client.from('memes').insert({title,image_url:publicData.publicUrl,storage_path:path,category,tags,display_name:displayName});if(insertError)throw insertError;
      form.reset();selectedFile=null;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;$('#upload-preview').removeAttribute('src');$('#upload-preview').hidden=true;$('.dropzone-copy').hidden=false;
      status('Your meme has been submitted! 🎉 It will appear after approval.');toast('Submitted! Your meme is waiting for approval.');
    }catch(error){status(friendlyError(error)+(uploaded?' The image uploaded but its record could not be saved. The owner can remove the orphan file in Storage.':''),true);}
    finally{uploading=false;form.querySelectorAll('input,select,button').forEach(node=>node.disabled=false);$('#upload-submit').textContent='Submit for approval ↗';}
  });
}
