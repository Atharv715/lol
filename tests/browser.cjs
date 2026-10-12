// Development-only checks. No dependencies/build tools are required by the site.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const sdkURL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.js';
// Fetch the actual SDK through the supported TLS-verified proxy route.
// Browser tests intercept SDK delivery only; integrity remains verified.
const sdk=execFileSync('curl',['--fail','--silent','--show-error','--max-time','30',sdkURL]);
const integrity='sha384-'+createHash('sha384').update(sdk).digest('base64');
assert.ok(fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8').includes(integrity));
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const csp = fs.readFileSync(path.join(root,'netlify.toml'),'utf8').match(/Content-Security-Policy = "([^"]+)"/)[1];
const server = http.createServer((req,res) => {
  let name = decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/lol\//,'/');
  if(name.endsWith('/'))name += 'index.html';
  const file = path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Security-Policy':csp});res.end(data);});
});
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=','base64');
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  await context.route(sdkURL,route=>route.fulfill({contentType:'text/javascript',body:sdk}));
  const page=await context.newPage(), errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/');await page.locator('.meme-card').first().waitFor();assert.equal(await page.locator('.meme-card').count(),6);
  assert.equal(await page.locator('.meme-image').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)),true);
  await page.screenshot({path:'/tmp/ib-meme-desktop.png',fullPage:true});
  await page.locator('#search').fill('chair');assert.equal(await page.locator('.meme-card').count(),1);assert.match(await page.locator('.card-title').innerText(),/chair/);
  await page.locator('#search').fill('nothing-matches-this');await page.getByText('No memes found.',{exact:true}).waitFor();
  await page.locator('#search').fill('');await page.locator('[data-category="Math AA"]').click();assert.equal(await page.locator('.meme-card').count(),1);
  await page.locator('#category-select').selectOption('Biology');await page.getByText('No memes found.',{exact:true}).waitFor();
  await page.locator('[data-category=""]').click();
  const like=page.locator('.meme-card').first().locator('[data-action="like"]');const count=Number((await like.innerText()).replace(/[^\d]/g,''));await like.click();assert.equal(Number(await page.locator('.meme-card').first().locator('[data-action="like"]').innerText().then(x=>x.replace(/[^\d]/g,''))),count+1);
  assert.equal(await page.locator('.meme-card [data-action="like"][aria-pressed="true"]').count(),1);
  await page.reload();await page.locator('[data-action="like"][aria-pressed="true"]').waitFor();assert.equal(await page.locator('[data-action="like"][aria-pressed="true"]').isDisabled(),true);
  await page.locator('.meme-image-button').first().click();await page.locator('#meme-dialog').waitFor({state:'visible'});assert.match(page.url(),/meme=demo/);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#meme-dialog').isVisible(),false);
  await page.getByRole('button',{name:/Random Meme/}).click();await page.locator('#meme-dialog').waitFor({state:'visible'});await page.locator('#meme-dialog [data-close]').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('.meme-card [data-action="download"]').first().click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.svg$/);assert.equal(await download.failure(),null);
  await page.locator('.meme-card [data-action="report"]').first().click();await page.locator('#report-confirm').click();await page.getByText(/Thanks. The meme has been reported./).waitFor();assert.equal(await page.locator('.meme-card [data-action="report"]').first().isDisabled(),true);
  // Share through the clipboard fallback, including the stable meme ID.
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});});
  await page.locator('.meme-card [data-action="share"]').first().click();await page.getByText('Link copied!',{exact:true}).waitFor();assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/\?meme=demo-/);
  await page.locator('[data-upload]').first().click();await page.locator('#upload-image').setInputFiles({name:'meme.png',mimeType:'image/png',buffer:PNG});await page.locator('#upload-title-input').fill('A demo submission');await page.locator('#upload-category').selectOption('General IB');await page.locator('#upload-submit').click();assert.match(await page.locator('#upload-status').innerText(),/has not been submitted/);await page.keyboard.press('Escape');
  await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.locator('#theme-toggle').click();
  await page.setViewportSize({width:375,height:812});await page.locator('.meme-card').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#menu-toggle').click();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');await page.locator('#main-nav').getByRole('link',{name:'Newest',exact:true}).click();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');await page.screenshot({path:'/tmp/ib-meme-mobile.png',fullPage:true});
  await page.goto(base+'/lol/');await page.locator('.meme-card').first().waitFor();await page.locator('.meme-image').evaluateAll(async images=>{await Promise.all(images.map(img=>{img.loading='eager';return img.decode();}));});assert.equal(await page.locator('.meme-image').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)),true);
  console.log('PASS: demo feed, search, filters, likes, downloads, reports, share, upload guard, modal, theme, mobile and project subdirectory');

  const real=await context.newPage();real.on('pageerror',error=>errors.push(error.message));
  await real.route('**/js/config.js',route=>route.fulfill({contentType:'text/javascript',body:'window.IB_CONFIG={url:"https://test-project.supabase.co",key:"sb_publishable_test"};'}));
  let inserted, uploadPath, rpcCalls=[];
  const record={id:'11111111-1111-4111-8111-111111111111',title:'<img src=x onerror=alert(1)> Safe text',category:'TOK',tags:['<script>'],image_url:'https://test-project.supabase.co/storage/v1/object/public/memes/uploads/11111111-1111-4111-8111-111111111111.png',display_name:'<script>alert(1)</script>',likes:3,downloads:2,reports:0,status:'approved',created_at:new Date().toISOString()};
  await real.route('https://test-project.supabase.co/**',async route=>{
    const req=route.request(), url=new URL(req.url());
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS','content-type':'application/json'};
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    if(url.pathname==='/rest/v1/memes'&&req.method()==='GET'){assert.equal(url.searchParams.get('status'),'eq.approved');await route.fulfill({headers,body:JSON.stringify([record])});return;}
    if(url.pathname==='/rest/v1/memes'&&req.method()==='POST'){inserted=req.postDataJSON();await route.fulfill({status:201,headers,body:''});return;}
    if(url.pathname.includes('/rpc/')){rpcCalls.push({name:url.pathname.split('/').at(-1),body:req.postDataJSON()});await route.fulfill({headers,body:'4'});return;}
    if(url.pathname.startsWith('/storage/v1/object/public/')){await route.fulfill({contentType:'image/png',body:PNG});return;}
    if(url.pathname.startsWith('/storage/v1/object/memes/')&&req.method()==='POST'){uploadPath=url.pathname;assert.equal(req.headers()['x-upsert'],'false');await route.fulfill({status:200,headers,body:JSON.stringify({Key:'memes/'+url.pathname.split('/memes/')[1]})});return;}
    await route.fulfill({status:404,headers,body:'{}'});
  });
  await real.goto(base+'/');await real.locator('.meme-card').waitFor({timeout:10000}).catch(async error=>{console.log('Configured feed state:',await real.locator('#feed-state').innerText());console.log('Library:',await real.evaluate(()=>typeof window.supabase));throw error;});assert.equal(await real.locator('#demo-banner').isVisible(),false);assert.equal(await real.locator('.card-title img,.card-tags script').count(),0);assert.match(await real.locator('.card-title').innerText(),/<img/);
  await real.locator('[data-action="like"]').click();await real.locator('[data-action="like"][aria-pressed="true"]').waitFor();assert.equal(rpcCalls[0].name,'increment_meme_like');assert.equal(rpcCalls[0].body.meme_id,record.id);
  await real.locator('[data-upload]').first().click();await real.locator('#upload-image').setInputFiles({name:'evil.html',mimeType:'text/html',buffer:Buffer.from('<script>')});assert.match(await real.locator('#upload-status').innerText(),/JPG/);
  await real.locator('#upload-image').setInputFiles({name:'wrong.png',mimeType:'image/png',buffer:Buffer.from('not a png')});await real.locator('#upload-title-input').fill('title');await real.locator('#upload-category').selectOption('TOK');await real.locator('#upload-submit').click();await real.locator('#upload-status').filter({hasText:'do not match'}).waitFor();assert.match(await real.locator('#upload-status').innerText(),/do not match/);
  await real.locator('#upload-image').setInputFiles({name:'huge.png',mimeType:'image/png',buffer:Buffer.alloc(10*1024*1024+1)});assert.match(await real.locator('#upload-status').innerText(),/over 10 MB/);
  await real.locator('#upload-image').setInputFiles({name:'meme.png',mimeType:'image/png',buffer:PNG});await real.locator('#upload-title-input').fill('<b>IB survived</b>');await real.locator('#upload-category').selectOption('TOK');await real.locator('input[name="tags"]').fill('tok, funny, tok');await real.locator('#upload-submit').click();await real.getByText('Your meme has been submitted! 🎉 It will appear after approval.').waitFor();
  assert.match(uploadPath,/uploads\/[a-f0-9-]{36}\.png$/);assert.equal(inserted.status,undefined);assert.equal(inserted.likes,undefined);assert.equal(inserted.title,'bIB survived/b');assert.deepEqual(inserted.tags,['tok','funny']);assert.equal(inserted.display_name,'Anonymous IB Survivor');assert.equal(inserted.storage_path,uploadPath.split('/memes/')[1]);
  await real.keyboard.press('Escape');await real.locator('.meme-image-button').click();await real.locator('#meme-dialog').waitFor({state:'visible'});assert.equal(await real.locator('#meme-detail script,#meme-detail h2 img').count(),0);await real.keyboard.press('Escape');
  const realDownload=real.waitForEvent('download');await real.locator('.meme-card [data-action="download"]').click();assert.match((await realDownload).suggestedFilename(),/\.png$/);assert.equal(rpcCalls.at(-1).name,'increment_meme_download');
  await real.locator('.meme-card [data-action="report"]').click();await real.locator('#report-confirm').click();await real.getByText('Thanks. The meme has been reported.',{exact:true}).waitFor();assert.equal(rpcCalls.at(-1).name,'increment_meme_report');
  // Database error must show a retry state, not silently use demos.
  await real.route('https://test-project.supabase.co/rest/v1/memes*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Service unavailable'})}));await real.reload();await real.getByRole('button',{name:'Try again',exact:true}).waitFor();assert.equal(await real.locator('.meme-card').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: configured Supabase REST/RPC integration, upload validation/pending insert, safe user text, failure state; no JavaScript errors');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
