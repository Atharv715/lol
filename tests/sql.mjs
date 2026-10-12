// Optional development validation against a real embedded PostgreSQL engine.
// Install outside the site: npm install --prefix /tmp/ib-sql-validation @electric-sql/pglite@0.3.14
// Run: node tests/sql.mjs
// Supabase Storage API size/MIME enforcement still requires a real project.
import { PGlite } from '/tmp/ib-sql-validation/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text, unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to anon,authenticated;`);
const sql=await readFile(new URL('../supabase-setup.sql',import.meta.url),'utf8');
await db.exec(sql);await db.exec(sql); // Verify repeatability.
const path='uploads/11111111-1111-4111-8111-111111111111.png';
const url='https://project.supabase.co/storage/v1/object/public/memes/'+path;
await db.exec('set role anon');
await db.query('insert into storage.objects(bucket_id,name) values ($1,$2)',['memes',path]);
await db.query('insert into public.memes(title,image_url,storage_path,category) values ($1,$2,$3,$4)',['A valid meme',url,path,'TOK']);
assert.equal((await db.query('select * from public.memes')).rows.length,0,'Pending rows must be hidden');
let rejected=0;
async function deny(statement,params=[]){try{await db.query(statement,params);assert.fail('Unexpectedly allowed: '+statement);}catch(error){if(error.code==='ERR_ASSERTION')throw error;rejected++;}}
await deny('insert into public.memes(title,image_url,storage_path,category,status) values ($1,$2,$3,$4,$5)',['Bad',url,path,'TOK','approved']);
await deny('insert into public.memes(title,image_url,storage_path,category,likes) values ($1,$2,$3,$4,$5)',['Bad',url,path,'TOK',900]);
await deny('insert into public.memes(title,image_url,storage_path,category,created_at) values ($1,$2,$3,$4,now())',['Bad',url,path,'TOK']);
await deny("update public.memes set status='approved'");await deny('delete from public.memes');
await deny('insert into storage.objects(bucket_id,name) values ($1,$2)',['memes','evil.svg']);
await deny('insert into storage.objects(bucket_id,name) values ($1,$2)',['other',path]);
assert.equal((await db.query('update storage.objects set name=$1 returning *',['overwritten.png'])).rows.length,0);
assert.equal((await db.query('delete from storage.objects returning *')).rows.length,0);
await db.exec('reset role');
const pending=(await db.query('select * from public.memes')).rows[0];assert.equal(pending.status,'pending');assert.equal(pending.likes,0);assert.equal(pending.downloads,0);assert.equal(pending.reports,0);
await db.exec('set role anon');
for(const name of ['like','download','report'])assert.equal((await db.query(`select public.increment_meme_${name}($1) as count`,[pending.id])).rows[0].count,null,'RPC must not change pending meme');
await db.exec('reset role');await db.query("update public.memes set status='approved' where id=$1",[pending.id]);
await db.exec('set role anon');assert.equal((await db.query('select * from public.memes')).rows.length,1);
for(const name of ['like','download','report'])assert.equal((await db.query(`select public.increment_meme_${name}($1) as count`,[pending.id])).rows[0].count,1);
await db.exec('reset role');
const approved=(await db.query('select * from public.memes')).rows[0];assert.equal(approved.status,'approved');assert.equal(approved.likes,1);assert.equal(approved.downloads,1);assert.equal(approved.reports,1);
// Reject mismatched/arbitrary image URLs with a fresh path.
await db.exec('set role anon');await deny('insert into public.memes(title,image_url,storage_path,category) values ($1,$2,$3,$4)',['Bad','https://evil.example/image.png','uploads/22222222-2222-4222-8222-222222222222.png','TOK']);
await db.exec('reset role');
console.log(`PASS: repeatable schema; pending/approved RLS; ${rejected} forbidden operations rejected; immutable Storage; safe RPC counters`);
await db.close();
