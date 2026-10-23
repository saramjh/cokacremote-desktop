import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','showcase');
const read=(name)=>readFileSync(join(root,name),'utf8');
const url='https://saramjh.github.io/cokacremote-desktop/';
const html=read('index.html');
const match=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
const graph=match?JSON.parse(match[1])['@graph']:null;

test('showcase is self-canonical, indexable and has consistent social preview',()=>{
  assert.ok(html.includes('rel="canonical" href="'+url+'"'));
  assert.ok(html.includes('name="robots" content="index,follow'));
  assert.ok(html.includes('property="og:url" content="'+url+'"'));
  assert.ok(html.includes('property="og:type" content="website"'));
  assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(html.includes('social-preview.png'));
  assert.ok(html.includes('rel="icon" type="image/svg+xml"'));
  assert.ok(!/noindex|nofollow|robots="none"/i.test(html));
  const png=readFileSync(join(root,'social-preview.png'));
  assert.equal(png.readUInt32BE(16),1200);
  assert.equal(png.readUInt32BE(20),630);
});
test('schema graph reflects text users can actually read, not fabricated claims',()=>{
  assert.ok(Array.isArray(graph));
  for(const kind of ['WebSite','WebPage','SoftwareApplication','FAQPage'])
    assert.ok(graph.some(node=>node['@type']===kind),kind);
  const page=graph.find(node=>node['@type']==='WebPage');
  const app=graph.find(node=>node['@type']==='SoftwareApplication');
  const faq=graph.find(node=>node['@type']==='FAQPage');
  assert.equal(page.url,url);
  assert.equal(page.dateModified,'2026-10-23');
  assert.ok(app.operatingSystem.includes('Windows')&&app.operatingSystem.includes('macOS'));
  assert.equal(app.offers.price,'0');
  assert.equal(app.isAccessibleForFree,true);
  assert.ok(!('aggregateRating' in app)&&!('review' in app),'no fake reviews');
  assert.equal(faq.mainEntity.length,6);
  for(const row of faq.mainEntity){
    assert.ok(html.includes('<summary>'+row.name+'</summary>'),row.name);
    const escaped=row.acceptedAnswer.text.replaceAll('&','&amp;').replaceAll("'",'&#x27;').replaceAll('"','&quot;');
    assert.ok(html.includes('<p>'+escaped+'</p>'),row.name);
  }
});
test('sitemap and machine summary use only canonical URL and real release links',()=>{
  const xml=read('sitemap.xml');
  assert.ok(xml.includes('<loc>'+url+'</loc>'));
  assert.equal((xml.match(/<loc>/g)||[]).length,1);
  assert.ok(!xml.includes('changefreq')&&!xml.includes('priority'));
  const llms=read('llms.txt');
  for(const term of [url,'v0.3.0','v0.4.0-rc.2','UNNOTARIZED','GETTING_STARTED.ko.md'])
    assert.ok(llms.includes(term),term);
  assert.ok(existsSync(join(root,'favicon.svg')));
  assert.ok(!/sk-[A-Za-z0-9]{15,}|ghp_[A-Za-z0-9]{15,}/.test(html+llms));
});
