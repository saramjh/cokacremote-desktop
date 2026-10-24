'use strict';
const{app,BrowserWindow,ipcMain,clipboard,shell,dialog}=require('electron');
const{join,resolve}=require('node:path');
const{spawn}=require('node:child_process');
const{readFileSync,existsSync,mkdirSync,writeFileSync,renameSync}=require('node:fs');
const path=require('node:path');
const {snapshot:readLogSnapshot}=require('../core/log-reader.cjs');
const {diagnose,assertExactApproval}=require('../core/windows-environment.cjs');
const {setTimeout:delay}=require('node:timers/promises');

const scripts=resolve(__dirname,'..');
const isMac=process.platform==='darwin';
const macStatus=()=>import('../platform/mac/status.mjs');
const macExecutor=()=>import('../platform/mac/operate.mjs');
const controller=join(process.env.USERPROFILE||process.env.HOME||'', 'MCPWorkspace','cokacremote','deploy','windows','cokacremote.ps1');
const probe=join(scripts,'platform','windows','status.ps1');
const bootstrapWindows=join(scripts,'bootstrap','windows.ps1');
const dependencyInstaller=join(scripts,'platform','windows','install-deps.ps1');
const keyfile=join(process.env.USERPROFILE||process.env.HOME||'', '.cokacremote','oauth-approval-key');
const powershell=join(process.env.WINDIR||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
const allowed=new Set(['setup','restart','stop']);
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
if(qa)app.setPath('userData',join(__dirname,'.qa-test-userdata'));
// QA uses a separate Electron single-instance lock and isolated preferences.


let win,operating=false,latest=null,latestAt=0,pending=null,lastRemoteProof=null,lastRemoteProofAt=0;
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
 if(pending){const shared=await pending;if(!remote||shared.remoteChecked)return shared;}
 pending=(async()=>{
  const dependencies=isMac?null:diagnose();
  let json;
  if(isMac)json=await (await macStatus()).getStatus(remote);
  else if(!existsSync(probe))json={checkedAt:new Date().toISOString(),task:'NOT_INSTALLED',local:'OFFLINE',public:'NOT_CHECKED',oauth:'NOT_CHECKED',authorization:'NOT_CHECKED',serverAlive:false,tunnelAlive:false,serverOwned:false,tunnelOwned:false,localHealth:'OFFLINE',remoteHealth:'NOT_CHECKED',oauthAligned:false,anonymous401:false,urlValid:false,endpoint:'',approvalKeyAvailable:false,ready:false};
  else json=JSON.parse((await runPS(probe,remote?['-VerifyRemote']:[],60000)).trim());
  if(dependencies){json.coreInstalled=dependencies.coreInstalled;json.dependencies=dependencies;}
  if(remote){
   const complete=json.public==='HEALTHY'&&json.oauth==='HEALTHY'&&json.authorization==='AUTH_REQUIRED'&&json.serverOwned===true&&json.tunnelOwned===true;
   if(complete){lastRemoteProof=json;lastRemoteProofAt=Date.now();}
   else{lastRemoteProof=null;lastRemoteProofAt=0;}
  }else{
   const {withRemoteProof}=await import('../ui/monitor.mjs');
   json=withRemoteProof(json,lastRemoteProof,lastRemoteProofAt);
  }
  const plan=policy.decide(json);
  const actuallyReady=Boolean(json.serverOwned&&json.tunnelOwned&&json.local==='HEALTHY'&&json.urlValid&&json.public==='HEALTHY'&&json.oauth==='HEALTHY'&&json.authorization==='AUTH_REQUIRED');
  const report={...json,ready:actuallyReady,remoteChecked:remote,remoteVerifiedAt:lastRemoteProofAt?new Date(lastRemoteProofAt).toISOString():null,decision:plan,chatgptRegistration:'USER_VERIFICATION_REQUIRED',actionInProgress:operating};
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
 if(!isMac && name==='setup' && !before.dependencies.ready)throw Error('Install the missing prerequisites first.');
 if(!isMac && name!=='setup'&&!before.coreInstalled)throw Error('MCP core has not been initialized.');
 if(!isMac && name==='setup' && (!before.coreInstalled||!before.dependencies.coreBuilt) && !existsSync(bootstrapWindows))throw Error('Core installation package missing; use the complete Windows distribution.');
 if(name==='setup'){
  if(before.decision.operation==='REUSE_BOTH'||before.decision.operation==='ADOPT_EXISTING'){send({phase:'complete',message:'Both components healthy. Reused existing endpoint without restarting.'});return {result:'REUSED_EXISTING',status:before}}
  if(before.decision.operation==='BLOCK_UNVERIFIED_OWNER'||before.decision.operation==='WAIT_AND_RECHECK'){
    return {result:'NO_MUTATION',reason:before.decision.reason,status:before};
  }
 }
 operating=true;send({phase:'started',action:name});
 try{
  if(isMac)await (await macExecutor()).operate(name);
  else if(name==='setup'&&!before.coreInstalled){
   // The GUI already required explicit first-install consent. Bootstrap only
   // the user-approved upstream source, then use the EXISTING Windows supervisor.
   await runPS(bootstrapWindows,['-Action','Install','-Component','cokacremote','-Approved'],600000,send);
   await runPS(controller,['-Action','setup','-HideApprovalKey'],300000,send);
  } else if(name==='setup'&&!before.dependencies.coreBuilt){
   throw Error('An incomplete existing core directory requires manual review; no overwrite performed.');
  }
  else await runPS(controller,['-Action',name,'-HideApprovalKey'],300000,send);
  latest=null;const after=await query(true);
  send({phase:'complete',action:name,operation:after.decision.operation});
  return {result:'EXECUTED',state:after,output:'Existing controller completed. Check updated endpoint and OAuth results.'};
 }catch(e){
  latest=null;send({phase:'error',action:name,message:e.message});
  throw Error('Existing controller reported a failure. Review supervisor logs and verify before retrying.');
 }finally{operating=false}
}
async function installDependencies(approvedMissing,consent){
 if(consent!==true)throw Error('Explicit user approval required');
 if(isMac)throw Error('Windows-only bootstrap');
 if(operating)throw Error('Another operation is already active');
 const before=diagnose();
 const packages=assertExactApproval(approvedMissing,before);
 if(!packages.length)return {result:'REUSED',dependencies:before};
 if(!existsSync(dependencyInstaller))throw Error('Packaged dependency installer missing');
 operating=true;send({phase:'started',action:'dependencies'});
 try{
  await runPS(dependencyInstaller,['-Consent','-ApprovedMissingCsv',approvedMissing.join(',')],600000,send);
  const after=diagnose();
  if(!after.ready)throw Error('Dependency check is still incomplete');
  latest=null;return {result:'VERIFIED',dependencies:after};
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
 ipcMain.handle('status',async(_e,remote)=>query(remote));
 ipcMain.handle('logs:snapshot',(_e,source)=>readLogSnapshot(String(source)));
 ipcMain.handle('dependencies:inspect',()=>diagnose());
 ipcMain.handle('dependencies:install',(_e,approved,consent)=>installDependencies(approved,consent));
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
    await delay(3200);    const output=resolve(qa.slice('--qa-screenshot='.length));
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
