import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const {snapshot,scrub}=require('../core/log-reader.cjs');
test('allowlisted read and unavailable log are non-destructive',()=>{
 const dir=mkdtempSync(join(tmpdir(),'coka-logs-'));
 try{
  assert.deepEqual(snapshot('server',dir),{source:'server',available:false,text:'',truncated:false,lineCount:0});
  assert.throws(()=>snapshot('../oauth-approval-key',dir),/Unknown log source/);
  writeFileSync(join(dir,'cokacremote.log'),'ok\n');
  assert.equal(snapshot('server',dir).text,'ok');
  assert.equal(snapshot('server',dir).lineCount,1);
  try{symlinkSync(join(dir,'cokacremote.log'),join(dir,'cloudflared.log'));assert.throws(()=>snapshot('tunnel',dir),/regular file/)}
  catch(error){if(error.code!=='EPERM')throw error;assert.match(String(snapshot),/Unknown log source|snapshot/)}
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('bounded tails redact keys, bearer and private tunnel URLs',()=>{
 const dir=mkdtempSync(join(tmpdir(),'coka-logs-'));
 try{
  const key='VERY-PRIVATE-APPROVAL-KEY-'+'Z'.repeat(48);
  writeFileSync(join(dir,'oauth-approval-key'),key);
  writeFileSync(join(dir,'manager-worker.log'),
    Array.from({length:1000},(_,i)=>i===999?'SECRET '+key+' Authorization: Bearer abc.def.ghi access_token="abc_XYZ_543" https://sensitive.trycloudflare.com/mcp':'line '+i).join('\n'));
  const out=snapshot('manager',dir,'darwin');
  assert.ok(out.truncated);
  assert.ok(out.lineCount<=180);
  assert.ok(out.text.includes('REDACTED KEY'));
  assert.ok(!out.text.includes(key));
  assert.ok(!out.text.includes('abc.def.ghi'));
  assert.ok(!out.text.includes('sensitive.trycloudflare.com'));
  assert.ok(!out.text.includes('abc_XYZ_543'));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('secret scrubbing treats empty key safely',()=>{
 assert.equal(scrub('hello world'),'hello world');
 assert.ok(scrub('bearer ABCDEFG').includes('[REDACTED]'));
});

test('Windows manager tab uses actual supervisor.log',()=>{
 const dir=mkdtempSync(join(tmpdir(),'coka-logs-'));
 try{
  writeFileSync(join(dir,'supervisor.log'),'win32 supervisor ready\n');
  assert.equal(snapshot('manager',dir,'win32').text,'win32 supervisor ready');
  assert.equal(snapshot('manager',dir,'darwin').available,false);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
