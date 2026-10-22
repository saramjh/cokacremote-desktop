import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {dictionaries,languageOptions,resolveLocale,supported,translate} from '../ui/i18n.mjs';

const all=Object.keys(dictionaries.en);
const placeholders=(s)=>[...s.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g)].map(x=>x[1]).sort();
test('seven supported language packs have identical complete keys and interpolation parameters',()=>{
 assert.deepEqual(supported,['en','ko','ja','zh','es','fr','de']);
 assert.equal(all.length,135);
 for(const code of supported){
  assert.deepEqual(Object.keys(dictionaries[code]).sort(),[...all].sort(),code+' keys');
  for(const key of all){
   const value=dictionaries[code][key];
   assert.equal(typeof value,'string',code+' '+key);
   assert.ok(value.trim().length>0,code+' '+key+' empty');
   assert.deepEqual(placeholders(value),placeholders(dictionaries.en[key]),code+' '+key+' placeholders');
  }
 }
});
test('system locale detection, saved preferences and safe fallback',()=>{
 assert.equal(resolveLocale('ko','en-US'),'ko');
 assert.equal(resolveLocale(null,'ko-KR'),'ko');
 assert.equal(resolveLocale(null,'ja-JP'),'ja');
 assert.equal(resolveLocale(null,'zh-CN'),'zh');
 assert.equal(resolveLocale(null,'es-MX'),'es');
 assert.equal(resolveLocale(null,'fr-CA'),'fr');
 assert.equal(resolveLocale(null,'de-DE'),'de');
 assert.equal(resolveLocale('xx','en-GB'),'en');
 assert.equal(resolveLocale('not-a-locale','unknown'),'en');
 assert.equal(resolveLocale('zh_Hans_CN','en'),'zh');
});
test('visible strings interpolate and do not change technical identifiers',()=>{
 for(const code of supported){
  assert.match(translate(code,'status.lastChecked',{time:'10:45'}),/10:45/);
  assert.match(translate(code,'status.pid',{pid:4242}),/4242/);
  assert.match(translate(code,'notice.readError',{error:'HTTP_401'}),/HTTP_401/);
  assert.notEqual(translate(code,'decision.REUSE_BOTH.title'),'decision.REUSE_BOTH.title');
 }
});
test('every marked static UI string references an existing translation',()=>{
 const html=readFileSync(join(import.meta.dirname,'..','ui','index.html'),'utf8');
 const attrs=[...html.matchAll(/data-i18n(?:-aria|-title)?="([^"]+)"/g)].map(x=>x[1]);
 assert.ok(attrs.length>=45,'expected all static elements localized');
 for(const attr of attrs)assert.ok(all.includes(attr),'unknown key '+attr);
 for(const lang of languageOptions)assert.ok(html.includes('<option value="'+lang.code+'">'));
 assert.ok(html.includes('type="module" src="./app.js"'));
 assert.ok(html.includes('aria-labelledby="languageLabel"'));
});
test('decision paths are localized in every locale',()=>{
 const states=['REUSE_BOTH','ADOPT_EXISTING','RECOVER_SERVER_ONLY','RECOVER_TUNNEL_ONLY','RECOVER_TUNNEL_REBIND_SERVER','START_BOTH','WAIT_AND_RECHECK','BLOCK_UNVERIFIED_OWNER'];
 for(const code of supported)for(const state of states)for(const field of ['title','desc','action'])
  assert.ok(translate(code,'decision.'+state+'.'+field).length>0);
});
