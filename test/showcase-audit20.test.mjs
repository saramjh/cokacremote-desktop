import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const file=p=>readFileSync(join(root,p),'utf8');
const home=file('showcase/index.html');
const base='https://saramjh.github.io/cokacremote-desktop/';
test('all published pages have unique metadata and correct canonical',()=>{
 const paths=['showcase/index.html','showcase/use-cases/index.html','showcase/privacy/index.html','showcase/contact/index.html'];
 const titles=new Set();
 for(const path of paths){
  const html=file(path),slug=path==='showcase/index.html'?'':path.split('/')[1]+'/';
  const title=html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title&&title.length>18,path);
  assert.ok(!titles.has(title),path);titles.add(title);
  assert.ok(html.includes('name="description"'),path);
  assert.ok(html.includes('rel="canonical" href="'+base+slug+'"'),path);
  assert.ok(html.includes('aria-label="Breadcrumb"'),path);
  assert.ok(html.includes('property="og:image"'),path);
 }
});
test('real support submission, response target and public privacy disclaimer',()=>{
 const contact=file('showcase/contact/index.html');
 const issue=file('.github/ISSUE_TEMPLATE/support.yml');
 assert.ok(contact.includes('issues/new?template=support.yml'));
 assert.ok(contact.includes('3–5 business days') && contact.includes('not a guaranteed'));
 assert.ok(contact.includes('actual submission confirmation'));
 assert.ok(issue.includes('required: true')&&issue.includes('public GitHub issue'));
 const privacy=file('showcase/privacy/index.html');
 assert.ok(privacy.includes('G-4DYFKSNFBG')&&privacy.includes('opt-in only'));
 assert.ok(privacy.includes('shared host origin'));
});
test('above-fold, mobile, real cases, FAQ, useful error and no-privacy-bypass',()=>{
 assert.ok(home.includes('data-track="hero_download"')&&home.includes('href="#downloads"'));
 assert.ok(home.includes('class="mobile-action"')&&home.includes('href="#downloads"'));
 assert.equal((home.match(/<details class="faq-item">/g)||[]).length,6);
 assert.equal((home.match(/class="cases-grid"/g)||[]).length,1);
 assert.ok(file('showcase/404.html').includes('noindex,follow'));
 assert.ok(file('showcase/404.html').includes('This page could not be found'));
 const site=file('showcase/site.js');
 assert.ok(site.includes('G-4DYFKSNFBG'));
 assert.ok(site.includes("if(value==='allowed')activate()"));
 assert.ok(site.includes("if(consent==='allowed'){activate()}"));
 assert.ok(!site.includes('document.cookie='));
 assert.ok(existsSync(join(root,'showcase/social-preview.png')));
});
