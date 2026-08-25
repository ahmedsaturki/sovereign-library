import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileContent, readFileChunks, FileContentReaderError } from '../src/index.js';

async function fixture(content='hello\r\nworld') {
  const root = await mkdtemp(join(tmpdir(), 'sovereign-reader-'));
  const file = join(root, 'file.txt'); await writeFile(file, content, 'utf8'); return { root, file };
}
async function expectRejectCode(fn, code) { await assert.rejects(fn, e => e instanceof FileContentReaderError && e.code === code); }

function capsFor(bytes, opts={}) {
  let closed=0, opened=0;
  const handle={bytes, close:async()=>{closed++;}};
  return {
    state:()=>({opened,closed}),
    open:async()=>{opened++;return handle;},
    read:async(h,b,o,l,p)=>{const n=Math.max(0,Math.min(l,h.bytes.length-p));for(let i=0;i<n;i++)b[o+i]=h.bytes[p+i];return {bytesRead:n};},
    close:async h=>h.close(),
    lstat:async()=>opts.lstat ?? { isSymbolicLink:()=>false },
    stat:async()=>opts.stat ?? {size:bytes.length,mtimeMs:1,ino:1,dev:1},
    realpath:async p=>p,
    contain:async()=>true,
    now:()=>opts.now?.() ?? 1000,
  };
}

test('binary read returns exact bytes and bounds output', async()=>{
  const {root,file}=await fixture('abcdef');
  try{const out=await readFileContent(file,{mode:'binary',length:3});assert.deepEqual([...out.data],[97,98,99]);assert.equal(out.actualBytes,3);assert.equal(out.eof,false);}finally{await rm(root,{recursive:true,force:true)}}
});

test('offset and EOF semantics are deterministic', async()=>{
  const {root,file}=await fixture('abcdef');
  try{const a=await readFileContent(file,{mode:'binary',offset:4,length:10});assert.deepEqual([...a.data],[101,102]);assert.equal(a.eof,true);const b=await readFileContent(file,{mode:'binary',offset:99});assert.equal(b.actualBytes,0);assert.equal(b.eof,true);}finally{await rm(root,{recursive:true,force:true)}}
});

test('length zero does not open the file', async()=>{
  const c=capsFor(new TextEncoder().encode('abc')); const out=await readFileContent('/x',{length:0},c);assert.equal(out.actualBytes,0);assert.equal(c.state().opened,0);
});

test('valid UTF-8 text and LF normalization', async()=>{
  const {root,file}=await fixture('a\r\nb\rc');
  try{const out=await readFileContent(file,{mode:'text',newline:'lf'});assert.equal(out.text,'a\nb\nc');}finally{await rm(root,{recursive:true,force:true)}}
});

test('invalid UTF-8 fails closed', async()=>{
  const c=capsFor(new Uint8Array([0xff,0xff])); await expectRejectCode(()=>readFileContent('/x',{mode:'text'},c),'DECODE_ERROR');
});

test('BOM policies are explicit', async()=>{
  const bytes=new Uint8Array([0xEF,0xBB,0xBF,97]);
  assert.equal((await readFileContent('/x',{mode:'text',bom:'strip'},capsFor(bytes))).text,'a');
  assert.equal((await readFileContent('/x',{mode:'text',bom:'preserve'},capsFor(bytes))).text,'\uFEFFa');
  await expectRejectCode(()=>readFileContent('/x',{mode:'text',bom:'reject'},capsFor(bytes)),'DECODE_ERROR');
});

test('chunked mode is ordered and bounded', async()=>{
  const c=capsFor(new TextEncoder().encode('abcdefgh')); const chunks=[]; for await(const item of readFileChunks('/x',{chunkSize:2},c)) chunks.push(new TextDecoder().decode(item.data)); assert.deepEqual(chunks,['ab','cd','ef','gh']); assert.equal(c.state().closed,1);
});

test('stream consumer cancellation closes owned handle', async()=>{
  const controller=new AbortController(); const c=capsFor(new Uint8Array(16).fill(97)); let seen=0; try{for await(const _ of readFileChunks('/x',{chunkSize:2,signal:controller.signal},c)){seen++;controller.abort();}}catch(e){assert.equal(e.code,'ABORTED')} assert.equal(c.state().closed,1); assert.ok(seen>=1);
});

test('work budget is enforced', async()=>{await expectRejectCode(()=>readFileContent('/x',{maxWorkUnits:1},capsFor(new Uint8Array(8))),'WORK_BUDGET_EXCEEDED');});

test('deadline is enforced', async()=>{let t=0;const c=capsFor(new Uint8Array(8),{now:()=>{t+=100;return t}});await expectRejectCode(()=>readFileContent('/x',{deadlineMs:50},c),'DEADLINE_EXCEEDED');});

test('pre-aborted signal fails before open', async()=>{const controller=new AbortController();controller.abort();const c=capsFor(new Uint8Array(4));await expectRejectCode(()=>readFileContent('/x',{signal:controller.signal},c),'ABORTED');assert.equal(c.state().opened,0)});

test('symlink reject and report policies are explicit', async()=>{const root=await mkdtemp(join(tmpdir(),'sovereign-link-'));const target=join(root,'target');const link=join(root,'link');try{await writeFile(target,'x');await symlink(target,link);await expectRejectCode(()=>readFileContent(link), 'SYMLINK_REJECTED');const rep=await readFileContent(link,{symlinkPolicy:'report'});assert.equal(rep.kind,'symlink')}finally{await rm(root,{recursive:true,force:true})}});

test('follow-contained accepts only contained targets', async()=>{const c=capsFor(new Uint8Array([97]));c.lstat=async()=>({isSymbolicLink:()=>true});c.realpath=async()=>'/root/file';c.contain=async(t,r)=>t.startsWith(r);c.open=async()=>({bytes:new Uint8Array([97]),close:async()=>{}});const ok=await readFileContent('/root/link',{root:'/root',symlinkPolicy:'follow-contained'},c);assert.equal(ok.actualBytes,1);c.contain=async()=>false;await expectRejectCode(()=>readFileContent('/root/link',{root:'/root',symlinkPolicy:'follow-contained'},c),'ROOT_ESCAPE');});

test('relative path requires root', async()=>{await expectRejectCode(()=>readFileContent('./file'), 'INVALID_PATH');});

test('root anchoring prevents escape', async()=>{await expectRejectCode(()=>readFileContent('../file',{root:'/root'}),'ROOT_ESCAPE');});

test('accessor options and capabilities are rejected before getter execution', async()=>{let hit=false;const options={};Object.defineProperty(options,'maxBytes',{get(){hit=true;throw new Error('getter')}});await expectRejectCode(()=>readFileContent('/x',options,capsFor(new Uint8Array(1))),'ACCESSOR_INPUT');assert.equal(hit,false);const c=capsFor(new Uint8Array(1));Object.defineProperty(c,'stat',{get(){hit=true;throw new Error('getter')}});await expectRejectCode(()=>readFileContent('/x',{},c),'ACCESSOR_INPUT');assert.equal(hit,false)});

test('strict consistency detects file mutation when metadata changes', async()=>{let n=0;const c=capsFor(new Uint8Array([97,98]),{stat:async()=>{n++;return {size:n===1?2:3,mtimeMs:n,ino:1,dev:1}}});await expectRejectCode(()=>readFileContent('/x',{},c),'CHANGED_DURING_READ');});

test('results are immutable and inputs are preserved', async()=>{const options={mode:'binary',length:2};const before=JSON.stringify(options);const out=await readFileContent('/x',options,capsFor(new Uint8Array([1,2])));assert.equal(Object.isFrozen(out),true);assert.equal(JSON.stringify(options),before);assert.equal(Object.isFrozen(out.data),false)});

test('diagnostics never include content bytes', async()=>{const c=capsFor(new Uint8Array([65,66,67]));c.open=async()=>{const e=new Error('secret-file-content-ABC');throw e};const out=await readFileContent('/x',{partial:'return'},c);assert.equal(out.ok,false);assert.equal(out.error.message.includes('ABC'),false)});

test('capability read rejects invalid bytesRead', async()=>{const c=capsFor(new Uint8Array([1]));c.read=async()=>({bytesRead:-1});await expectRejectCode(()=>readFileContent('/x',{},c),'CAPABILITY_FAILURE');assert.equal(c.state().closed,1)});
