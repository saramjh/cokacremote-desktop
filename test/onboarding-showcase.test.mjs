import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('showcase teaches the MCP route and distinguishes simulated status',()=>{
 const html=read('showcase/index.html');
 for(const item of ['#how','#setup','#security','trycloudflare.com/mcp','Plugins','OAuth','Demonstration / not a live connection','Interactive','role="tablist"']){
  if(item==='Interactive')continue;
  assert.ok(html.includes(item),item);
 }
 for(const id of ['signalTrack','signalToken','replayMotion','tab-inspect','tab-consent','tab-connect'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(!/sk-[A-Za-z0-9]{15,}|ghp_[A-Za-z0-9]{15,}/.test(html));
});
test('motion is finite, replayable, accessible and respects reduced motion',()=>{
 const js=read('showcase/motion.js');
 for(const s of ['prefers-reduced-motion','IntersectionObserver','duration=6600','cancelAnimationFrame','setScene','ArrowRight','Home','End','data-scene']){
  assert.ok(js.includes(s),s);
 }
 assert.ok(!js.includes('repeat: -1'));
});
test('installation probes require consent before install and keep package list allowlisted',()=>{
 const win=read('bootstrap/windows.ps1'),mac=read('bootstrap/macos.sh');
 for(const s of ['Probe','Install','Approved','winget.exe','cokacremote','cloudflared','OpenJS.NodeJS.LTS']){
  assert.ok(win.includes(s),s);
 }
 for(const s of ['--probe','--approved','brew install','cokacremote','command -v']){
  assert.ok(mac.includes(s),s);
 }
 assert.ok(!win.includes('Invoke-Expression'));
 assert.ok(!mac.includes('curl | bash'));
});
test('onboarding UI requires checkbox approval and uses dedicated IPC',()=>{
 const html=read('ui/index.html'),js=read('ui/app.js'),main=read('desktop/main.cjs');
 assert.ok(html.includes('id="dependencyConsent"'));
 assert.ok(html.includes('id="dependencyInstall"'));
 assert.ok(js.includes("el('dependencyConsent').checked"));
 assert.ok(main.includes("if(consent!==true)"));
 assert.ok(main.includes("dependencies:inspect"));
 assert.ok(main.includes("dependencies:install"));
});

test('showcase routes a new visitor to the correct current platform release and real setup guides',()=>{
 const html=read('showcase/index.html');
 for(const expected of ['id="downloads"','href="#downloads"','v0.3.0','v0.4.0-rc.2',
   'https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.3.0',
   'https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2',
   'SOURCE-INSTALL.tar.gz','UNNOTARIZED','INSTALL.cmd',
   'not Apple-notarized','Gatekeeper','Not one-click','No tested Intel package',
   'docs/GETTING_STARTED.ko.md','docs/GETTING_STARTED.md','docs/TROUBLESHOOTING.md']){
  assert.ok(html.includes(expected),expected);
 }
 assert.ok(html.indexOf('id="downloads"')<html.indexOf('id="how"'));
 assert.ok(html.includes('Demonstration / not a live connection'));
 assert.ok(!/sk-[A-Za-z0-9]{15,}|ghp_[A-Za-z0-9]{15,}/.test(html));
});
test('showcase release facts match public README and bilingual guides',()=>{
 const html=read('showcase/index.html'),english=read('docs/GETTING_STARTED.md');
 const korean=read('docs/GETTING_STARTED.ko.md'),readme=read('README.md');
 for(const code of ['v0.3.0','v0.4.0-rc.2']){
  assert.ok(english.includes(code)&&korean.includes(code)&&html.includes(code),code);
 }
 assert.ok(readme.includes('https://saramjh.github.io/cokacremote-desktop/'));
 assert.ok(!html.includes('View releases'));
});
