'use strict';
const {execFileSync}=require('node:child_process');
const {existsSync}=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const REQUIRED=Object.freeze(['node','npm.cmd','git','cloudflared']);
const PACKAGE_IDS=Object.freeze({node:'OpenJS.NodeJS.LTS','npm.cmd':'OpenJS.NodeJS.LTS',git:'Git.Git',cloudflared:'Cloudflare.cloudflared'});
function locate(command){
 try{return execFileSync('where.exe',[command],{encoding:'utf8',windowsHide:true,timeout:3500}).trim().split(/\r?\n/)[0]||null}
 catch{
  // A just-installed winget package may be on registry PATH but not on the
  // already-running Electron process PATH. Re-probe machine+user PATH read-only.
  if(process.platform!=='win32'||!/^(?:node|npm\.cmd|git|cloudflared|winget)$/.test(command))return null;
  try{
   const ps=path.join(process.env.WINDIR||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
   const code='$env:Path=[Environment]::GetEnvironmentVariable("Path","Machine")+";"+[Environment]::GetEnvironmentVariable("Path","User");(Get-Command '+command+' -ErrorAction Stop).Source';
   return execFileSync(ps,['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8',windowsHide:true,timeout:3500}).trim()||null;
  }catch{return null}
 }
}
function diagnose({which=locate,exists=existsSync,home=os.homedir()}={}){
 const paths=Object.fromEntries([...REQUIRED,'winget'].map(name=>[name,which(name)||null]));
 const missing=REQUIRED.filter(name=>!paths[name]);
 const packages=[...new Set(missing.map(name=>PACKAGE_IDS[name]))];
 const core=path.join(home,'MCPWorkspace','cokacremote');
 const coreInstalled=exists(path.join(core,'package.json'))&&exists(path.join(core,'deploy','windows','cokacremote.ps1'));
 const coreBuilt=exists(path.join(core,'dist','src','server.js'))&&exists(path.join(core,'deploy','windows','cokacremote.ps1'));
 return Object.freeze({
  ready:missing.length===0, missing,packages,paths,installer:paths.winget?'winget':null,
  requiresConsent:missing.length>0,coreInstalled,coreBuilt,
  needsCore:!coreInstalled,canInstall:!!paths.winget,
  installMode:coreInstalled?'existing-core':'bootstrap-required'
 });
}
function assertExactApproval(approved,before){
 if(!Array.isArray(approved)||approved.some(v=>!REQUIRED.includes(v))||new Set(approved).size!==approved.length)throw Error('Invalid dependency approval');
 if(JSON.stringify(approved)!==JSON.stringify(before.missing))throw Error('Dependency state changed; review again');
 if(!before.canInstall&&approved.length)throw Error('winget is unavailable; install Windows App Installer from Microsoft');
 return [...before.packages];
}
module.exports={REQUIRED,PACKAGE_IDS,diagnose,assertExactApproval};
