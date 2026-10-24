import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {diagnose,assertExactApproval}=require('../core/windows-environment.cjs');
const read=x=>readFileSync(join(import.meta.dirname,'..',x),'utf8');
const fake=(found=[],paths={})=>diagnose({which:name=>found.includes(name)?'C:\\Mock\\'+name:null,exists:p=>!!paths[p] ,home:'C:\\NEW_USER'});
test('totally clean Windows environment is not marked ready and no core exists',()=>{
 const d=fake([]);
 assert.equal(d.ready,false); assert.equal(d.coreInstalled,false);assert.equal(d.canInstall,false);
 assert.deepEqual(d.missing,['node','npm.cmd','git','cloudflared']);
 assert.deepEqual(d.packages,['OpenJS.NodeJS.LTS','Git.Git','Cloudflare.cloudflared']);
 assert.throws(()=>assertExactApproval(d.missing,d),/winget/);
});
test('winget is the sole prerequisite for the explicitly agreed installer',()=>{
 const d=fake(['winget']);
 assert.equal(d.canInstall,true);
 assert.deepEqual(assertExactApproval(d.missing,d),d.packages);
 assert.throws(()=>assertExactApproval(['node'],d),/changed/);
 assert.throws(()=>assertExactApproval(['shell','powershell'],d),/Invalid/);
 assert.throws(()=>assertExactApproval(['node','node'],d),/Invalid/);
});
test('installed tooling without core asks to initialize, not to reinstall all packages',()=>{
 const d=fake(['winget','node','npm.cmd','git','cloudflared']);
 assert.equal(d.ready,true);
 assert.equal(d.coreInstalled,false);
 assert.equal(d.installMode,'bootstrap-required');
 assert.deepEqual(assertExactApproval([],d),[]);
});
test('first-run bootstrap has explicit consent, secure package allowlist, verification',()=>{
 const ps=read('platform/windows/install-deps.ps1');
 assert.match(ps,/Consent/);assert.match(ps,/DEPENDENCY_PLAN_CHANGED/);assert.match(ps,/OpenJS.NodeJS.LTS/);
 assert.doesNotMatch(ps,/VisualStudio|BuildTools|cargo|rustup/);
 assert.match(ps,/DEPENDENCIES_STILL_MISSING/);
});
test('first-run GUI disables service controls when dependencies are missing',()=>{
 const app=read('ui/app.js'),html=read('ui/index.html');
 assert.match(app,/data\.dependencies&&!data\.dependencies\.ready/);
 assert.match(app,/confirm\.dependencies/);
 assert.match(app,/confirm\.firstInstall/);
 assert.match(app,/installDependencies\(approvedMissing,true\)/);
 for(const id of ['dependencyPanel','dependencyStatus','installDependencies'])assert.ok(html.includes('id="'+id+'"'));
});
test('existing healthy process survives first-run check with no restart',()=>{
 const main=read('desktop/main.cjs');
 assert.match(main,/before.decision.operation==='REUSE_BOTH'\|\|before.decision.operation==='ADOPT_EXISTING'/);
 assert.match(main,/await query\(true\)/);
 assert.match(main,/!before.coreInstalled/);
 assert.match(main,/Missing|missing|prerequisite/i);
});
test('only packed install source is allowed to create first core; no arbitrary shell',()=>{
 const main=read('desktop/main.cjs');
 assert.match(main,/existsSync\(bootstrapWindows\)/);
 assert.match(main,/runPS\(bootstrapWindows,\['-Action','Install','-Component','cokacremote','-Approved'\]/);
 assert.match(main,/runPS\(dependencyInstaller,\['-Consent'/);
 assert.match(main,/assertExactApproval/);
});
