'use strict';
const{app,BrowserWindow,ipcMain,clipboard,shell,dialog}=require('electron');
const{join,resolve}=require('node:path');
const{spawn}=require('node:child_process');
const{readFileSync,existsSync,mkdirSync,writeFileSync,renameSync}=require('node:fs');
const path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');

const scripts=resolve(__dirname,'..');
const isMac=process.platform==='darwin';
const macStatus=()=>import('../platform/mac/status.mjs');
const macExecutor=()=>import('../platform/mac/operate.mjs');
const controller=join(scripts,'platform','windows','cokacremote.ps1');
const probe=join(scripts,'platform','windows','status.ps1');
const keyfile=join(process.env.USERPROFILE||process.env.HOME||'', '.cokacremote','oauth-approval-key');
const powershell=join(process.env.WINDIR||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
const allowed=new Set(['setup','restart','stop']);
const {snapshot:readLogSnapshot}=require('../core/log-reader.cjs');
const dependencyIds=new Set(['node','git','cloudflared','cokacremote']);
const bootstrapWindows=join(scripts,'bootstrap','windows.ps1');
const bootstrapMac=join(scripts,'bootstrap','macos.sh');
const readMacScript=(args=[],timeout=180000)=>{
 return new Promise((resolve,reject)=>{
  if(!existsSync(bootstrapMac))return reject(Error('macOS dependency helper was not packaged'));
  const child=spawn('/bin/bash',[bootstrapMac,...args],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PATH:'/opt/homebrew/bin:/usr/local/bin:'+(process.env.PATH||'/usr/bin:/bin')}});
  let out='',error='';
  child.stdout.on('data',b=>{out=(out+b.toString('utf8')).slice(-8000)});
  child.stderr.on('data',b=>{error=(error+b.toString('utf8')).slice(-2500)});
  const timer=setTimeout(()=>child.kill(),timeout);
  child.once('error',e=>{clearTimeout(timer);reject(e)});
  child.once('exit',(code,signal)=>{clearTimeout(timer);if(code!==0||signal)reject(Error(error||'Dependency operation failed'));else resolve(out)});
 });
};
async function inspectDependencies(){
 const data=isMac?await readMacScript(['--probe'],20000):await runPS(bootstrapWindows,['-Action','Probe'],20000);
 return JSON.parse(data.trim());
}
async function installDependency(name,consent){
 if(!dependencyIds.has(name))throw Error('Dependency not allowlisted');
 if(consent!==true)throw Error('User approval was not given');
 if(operating)throw Error('Another operation is in progress');
 operating=true;
 try{
  const before=await inspectDependencies();
  if(before.components.some(x=>x.name===name&&x.installed))return {result:'REUSED',component:name};
  const output=isMac?
   await readMacScript(['--install',name,'--approved'],240000):
   await runPS(bootstrapWindows,['-Action','Install','-Component',name,'-Approved'],240000);
  latest=null;
  const data=JSON.parse(output.trim().split(/\r?\n/).filter(Boolean).at(-1));
  return {result:data.result,component:name,requiresReprobe:true};
 }finally{operating=false}
}
const languageCodes=new Set(['en','ko','ja','zh','es','fr','de']);
function preferencesFile(){return join(app.getPath('userData'),'ui-preferences.json')}
function savedLanguage(){try{const code=JSON.parse(readFileSync(preferencesFile(),'utf8')).language;return languageCodes.has(code)?code:null}catch{return null}}
function saveLanguage(code){
 if(!languageCodes.has(code))throw Error('Unsupported language');
 const file=preferencesFile();mkdirSync(path.dirname(file),{recursive:true});
 const temporary=file+'.'+process.pid+'.tmp';writeFileSync(temporary,JSON.stringify({schema:1,language:code})+'\n',{mode:0o600});renameSync(temporary,file);return {language:code};
}
const qa=process.argv.find(x=>x.startsWith('--qa-screenshot='));
const qaLanguage=process.argv.find(x=>x.startsWith('--qa-language='))?.split('=')[1];
const isQaLanguage=languageCodes.has(qaLanguage);
let win,operating=false,latest=null,latestAt=0,pending=null;
let policy;
const runPS=(file,args=[],timeout=40000,onUpdate)=>{
 return new Promise((ok,no)=>{
  if(!existsSync(file))return no(Error('Required existing script missing: '+path.basename(file)));
  const child=spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',ended=false;
  const max=180000;
  const collect=(kind,part)=>{
   const txt=part.toString('utf8');if(kind==='out')stdout=(stdout+txt).slice(-max);else stderr=(stderr+txt).slice(-max);
   if(onUpdate)onUpdate({phase:'running',line:txt.replace(/[a-f0-9]{48,}/gi,'[redacted]').slice(-300)});
  };
  child.stdout.on('data',p=>collect('out',p));child.stderr.on('data',p=>collect('err',p));
  const timer=setTimeout(()=>{child.kill();},timeout);
  child.once('error',err=>{clearTimeout(timer);no(err)});
  child.once('exit',(code,signal)=>{clearTimeout(timer);if(signal||code!==0)no(Error((stderr||stdout).slice(-1500)||'Task ended unexpectedly'));else ok(stdout)});
 });
};
async function query(remote=false){
 if(!policy)policy=await import('../core/reconcile.mjs');
 const age=Date.now()-latestAt;
 if(!remote&&latest&&age<2500)return latest;
 if(pending)return pending;
 pending=(async()=>{
  const json=isMac?await (await macStatus()).getStatus(remote):JSON.parse((await runPS(probe,remote?['-VerifyRemote']:[],60000)).trim());
  const plan=policy.decide(json);
  const report={...json,decision:plan,chatgptRegistration:'USER_VERIFICATION_REQUIRED',actionInProgress:operating};
  latest=report;latestAt=Date.now();
  return report;
 })().finally(()=>pending=null);
 return pending;
}
const send=data=>{if(win&&!win.isDestroyed())win.webContents.send('operation-progress',data)};
async function action(name){
 if(!allowed.has(name))throw Error('Operation not allowed');
 if(operating)throw Error('Another operation is in progress');
 const before=await query(true);
 if(name==='setup'){
  if(before.decision.operation==='REUSE_BOTH'){send({phase:'complete',message:'Both components healthy. Reused existing endpoint without restarting.'});return {result:'REUSED_EXISTING',status:before}}
  if(before.decision.operation==='BLOCK_UNVERIFIED_OWNER'||before.decision.operation==='WAIT_AND_RECHECK'){
    return {result:'NO_MUTATION',reason:before.decision.reason,status:before};
  }
 }
 operating=true;send({phase:'started',action:name});
 try{
  if(isMac)await (await macExecutor()).operate(name);
  else await runPS(controller,['-Action',name,'-HideApprovalKey'],300000,send);
  latest=null;const after=await query(true);
  send({phase:'complete',action:name,operation:after.decision.operation});
  return {result:'EXECUTED',state:after,output:'Existing controller completed. Check updated endpoint and OAuth results.'};
 }catch(e){
  latest=null;send({phase:'error',action:name,message:e.message});
  throw Error('Existing controller reported a failure. Review supervisor logs and verify before retrying.');
 }finally{operating=false}
}
function secureString(filename){
 if(!existsSync(filename))throw Error('Approval key is not available. Start the service first.');
 const value=readFileSync(filename,'utf8').trim();
 if(!/^[a-z0-9_-]{32,256}$/i.test(value))throw Error('Approval key has an unexpected format');
 return value;
}
function setupHandlers(){
 ipcMain.handle('language:get',()=>({selected:isQaLanguage?qaLanguage:savedLanguage(),system:app.getLocale()}));
 ipcMain.handle('language:set',(_event,code)=>isQaLanguage?({language:code}):saveLanguage(code));
 ipcMain.handle('dependencies:inspect',()=>inspectDependencies());
 ipcMain.handle('dependencies:install',(_e,name,consent)=>installDependency(String(name),consent===true));
 ipcMain.handle('status',async(_e,remote)=>query(remote));
 ipcMain.handle('logs:snapshot',(_e,source)=>readLogSnapshot(String(source)));
 ipcMain.handle('operate',async(_e,name)=>action(name));
 ipcMain.handle('copy',async(_e,type)=>{
  if(type==='url'){
   const status=await query(false);if(!status.endpoint||!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/mcp$/.test(status.endpoint))throw Error('Valid active tunnel address not available');
   clipboard.writeText(status.endpoint);return {ok:true};
  }
  if(type==='key'){clipboard.writeText(secureString(keyfile));return{ok:true}}
  throw Error('Unknown copy target');
 });
 ipcMain.handle('reveal-key',()=>secureString(keyfile));
 ipcMain.handle('open-chatgpt',()=>shell.openExternal('https://chatgpt.com/'));
 ipcMain.handle('window-minimize',()=>{if(win&&!win.isDestroyed())win.minimize()});
 ipcMain.handle('window-close',()=>{if(win&&!win.isDestroyed())win.close()});
}
function createWindow(){
 win=new BrowserWindow({
  width:1160,height:785,minWidth:960,minHeight:680,backgroundColor:'#e9eeed',show:false,
  icon:join(scripts,'assets','app-icon.png'),
  title:'cokacremote / Connection Manager',autoHideMenuBar:true,
  webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}
 });
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('file://'))event.preventDefault()});
 win.loadFile(join(scripts,'ui','index.html'));
 win.once('ready-to-show',()=>win.show());
 if(qa){
  win.webContents.once('did-finish-load',async()=>{
    await delay(3200);
    const output=resolve(qa.slice('--qa-screenshot='.length));
    const qaStatus=await win.webContents.executeJavaScript("({locale:document.documentElement.lang,language:document.getElementById('languageSelect')?.value,notice:document.getElementById('notice')?.textContent,head:document.getElementById('headline')?.textContent,bridge:typeof window.mcpManager,htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth})");
    process.stdout.write('QA_STATUS '+JSON.stringify(qaStatus)+'\n');
    const screenshot=await win.webContents.capturePage();
    writeFileSync(output,screenshot.toPNG());
    process.stdout.write('DESKTOP_QA_CAPTURED\n');app.quit();
  });
 }
}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
 app.whenReady().then(()=>{app.setAppUserModelId('cokacremote.desktop.manager');setupHandlers();createWindow()});
 app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
}
