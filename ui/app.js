'use strict';
import {resolveLocale,translate,supported} from './i18n.mjs';
import {attachLogViewer} from './log-viewer.mjs';
import {withRemoteProof} from './monitor.mjs';
import {decide} from './reconcile.mjs';

const el=(id)=>document.getElementById(id);
const systemName=window.mcpManager.platform==='darwin'?'macOS':'Windows';
el('hostLabel').textContent=systemName+' host';
el('hostContext').textContent=systemName+' / Remote MCP';

let locale='en',latest=null,loading=false,busy=false,revealedTimer,autoTimer,logViewer;
let lastVerifiedRemote=null,lastVerifiedRemoteAt=0,backgroundPolls=0;
let lastNote={key:'status.footer',params:{},warning:false};
const t=(key,params={})=>translate(locale,key,params);
const policyClass=(operation)=>['REUSE_BOTH','ADOPT_EXISTING'].includes(operation)?'stable':
  operation==='BLOCK_UNVERIFIED_OWNER'?'block':'warn';
const policyKey=(operation)=>supported.length&&[
 'REUSE_BOTH','ADOPT_EXISTING','RECOVER_SERVER_ONLY','RECOVER_TUNNEL_ONLY',
 'RECOVER_TUNNEL_REBIND_SERVER','START_BOTH','WAIT_AND_RECHECK','BLOCK_UNVERIFIED_OWNER'
].includes(operation)?operation:'WAIT_AND_RECHECK';

function applyStatic(){
 document.documentElement.lang=locale==='zh'?'zh-CN':locale;
 document.title='cokacremote / '+t('status.controls');
 for(const node of document.querySelectorAll('[data-i18n]'))node.textContent=t(node.dataset.i18n);
 for(const node of document.querySelectorAll('[data-i18n-aria]'))node.setAttribute('aria-label',t(node.dataset.i18nAria));
 for(const node of document.querySelectorAll('[data-i18n-title]'))node.title=t(node.dataset.i18nTitle);
 el('languageSelect').value=locale;
 if(!latest){
  el('headline').textContent=t('status.checking');
  el('subline').textContent=t('status.checkingDesc');
  el('decisionTitle').textContent=t('status.checkingDecision');
  el('decisionText').textContent=t('status.checkingDecisionDesc');
  el('heartbeatLabel').textContent=t('status.assessing');
  el('endpoint').value=t('status.addressChecking');
 }
}
function setLanguage(code){
 locale=resolveLocale(code);
 applyStatic();
 if(latest)apply(latest);
 if(lastNote)showNotice(lastNote.key,lastNote.params,lastNote.warning);
 if(logViewer)logViewer.translate();
}
function fmtDate(value){
 if(!value)return '—';const d=new Date(value);
 return isNaN(d)?'—':new Intl.DateTimeFormat(locale==='zh'?'zh-CN':locale,{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(d);
}
function setDot(name,healthy){el(name).className='svc-indicator '+(healthy?'healthy':'unhealthy')}
function setTopology(name,key,healthy){
 const node=el(name);node.textContent=t(key);node.className='top-status '+(healthy?'healthy':'offline');
}
function showNotice(key,params={},warning=false){
 lastNote={key,params,warning};
 const node=el('notice');node.textContent=t(key,params);
 node.className='notice-bar'+(warning?' warning':'');
}
function heartbeat(key,healthy){
 el('heartbeatLabel').textContent=t(key);
 el('heartbeat').style.color=healthy?'#b6d8cc':'#e9b28a';
}
function hideKey(){
 clearTimeout(revealedTimer);
 const input=el('approvalKey');input.type='password';input.value=t('status.approvalMasked');
}
function apply(data){
 latest=data;
 const d=data.decision||{};
 const sandbox=String(data.detail||'').startsWith('ISOLATED_NATIVE_SANDBOX');
 const stageLabel=document.querySelector('.stage-mode-indicator');
 if(stageLabel)stageLabel.textContent=sandbox?'STAGING · ISOLATED TEST':'RELEASE CANDIDATE · LIVE CONTROL';
 if(sandbox&&data.localPort)document.querySelector('#mapServer small').textContent='127.0.0.1:'+data.localPort;
 const operation=policyKey(d.operation);
 const key='decision.'+operation;
 el('headline').textContent=t(key+'.title');
 el('subline').textContent=t(key+'.desc');
 el('decisionTitle').textContent=operation==='REUSE_BOTH'?t('status.restoreSafe'):t(key+'.title');
 el('decisionText').textContent=t(key+'.desc');
 el('decisionCode').textContent=d.operation||'ASSESSING';
 el('operationBanner').className='operation-banner '+(policyClass(operation)==='stable'?'':policyClass(operation));
 el('lastChecked').textContent=t('status.lastChecked',{time:fmtDate(data.checkedAt)});
 const mcp=data.local==='HEALTHY'&&data.serverOwned===true;
 const tunnel=data.public==='HEALTHY'&&data.tunnelOwned===true;
 const auth=data.oauth==='HEALTHY'&&data.authorization==='AUTH_REQUIRED';
 setDot('serverDot',mcp);setDot('tunnelDot',tunnel);setDot('authDot',auth);
 setTopology('mapServerState',mcp?'status.online':data.serverAlive?'status.needsReview':'status.offline',mcp);
 setTopology('mapTunnelState',tunnel?'status.verified':data.tunnelAlive?'status.needsReview':'status.offline',tunnel);
 setTopology('mapOAuthState',auth?'status.verified':'status.needsReview',auth);
 el('serverValue').textContent=mcp?t('status.online'):data.serverAlive?t('status.serverNeedsReview'):t('status.serverStopped');
 el('serverPid').textContent=t('status.pid',{pid:data.serverPid||'—'});
 el('tunnelValue').textContent=tunnel?t('status.publicOk'):data.tunnelAlive?t('status.running'):t('status.unavailable');
 el('tunnelPid').textContent=t('status.pid',{pid:data.tunnelPid||'—'});
 el('authValue').textContent=auth?t('status.authPassed'):data.oauth==='NOT_CHECKED'?t('status.authPending'):t('status.authReview');
 el('authSub').textContent=data.authorization==='AUTH_REQUIRED'?t('status.anonymousDenied'):t('status.authUnverified');
 el('endpoint').value=data.urlValid&&data.endpoint?data.endpoint:t('status.noUrl');
 el('copyUrl').disabled=!data.urlValid||sandbox;
 el('copyKey').disabled=!data.approvalKeyAvailable;
 if(data.dependencies){
  const deps=data.dependencies;
  el('dependencyPanel').hidden=false;
  el('dependencyStatus').textContent=deps.ready?t('deps.ready'):t('deps.missing',{items:deps.missing.join(', ')});
  const installerReady=systemName==='macOS'?Boolean(deps.brewPath):Boolean(deps.canInstall);
  if(!deps.ready&&!installerReady)el('dependencyStatus').textContent+=' · '+t(systemName==='macOS'?'deps.noBrew':'deps.noWinget');
  if(deps.ready&&!data.coreInstalled)el('dependencyStatus').textContent=t('deps.coreMissing');
  el('installDependencies').disabled=busy||deps.ready||!installerReady;
 }else el('dependencyPanel').hidden=true;
 el('revealKey').disabled=!data.approvalKeyAvailable;
 el('repair').disabled=busy||operation==='BLOCK_UNVERIFIED_OWNER'||Boolean(data.dependencies&&!data.dependencies.ready);
 el('repair').textContent=t(key+'.action');
 el('actionNote').textContent=d.requiresChatGPTReconnect?t('status.reconnectNeeded'):
   operation==='REUSE_BOTH'?t('status.restoreSafe'):t('status.recoverScript');
 heartbeat(d.effectiveReady?'status.ready':data.local==='HEALTHY'?'status.partial':'status.assessing',Boolean(d.effectiveReady));
 if(d.requiresChatGPTReconnect)showNotice('status.urlChanged',{},true);
}
async function refresh(remote=false){
 if(loading||busy)return;
 loading=true;el('verify').disabled=true;
 try{
  const latestObserved=await window.mcpManager.status(remote);
  const verified=Boolean(latestObserved.serverOwned&&latestObserved.tunnelOwned&&
   latestObserved.public==='HEALTHY'&&latestObserved.oauth==='HEALTHY'&&
   latestObserved.authorization==='AUTH_REQUIRED'&&latestObserved.urlValid);
  if(remote){
   if(verified){lastVerifiedRemote=latestObserved;lastVerifiedRemoteAt=Date.now();}
   else{lastVerifiedRemote=null;lastVerifiedRemoteAt=0;}
  }
  const data=remote?latestObserved:withRemoteProof(latestObserved,lastVerifiedRemote,lastVerifiedRemoteAt);
  data.decision=decide(data);
  apply(data);
  if(remote)showNotice(verified?'notice.verified':'notice.notVerified',{},!verified);
 }catch(e){
  heartbeat('status.assessing',false);
  showNotice('notice.readError',{error:String(e.message||e).slice(0,180)},true);
 }finally{loading=false;el('verify').disabled=false;}
}
function requestConfirmation(key,params={}){
 return new Promise(resolve=>{
  const dialog=el('actionConfirm');
  if(dialog.open){resolve(false);return;}
  const requiresConsent=key==='confirm.dependencies'||key==='confirm.firstInstall';
  const isDependency=key==='confirm.dependencies';
  const checkbox=el('dependencyConsent'),ok=el('confirmAccept'),install=el('dependencyInstall');
  checkbox.checked=false;el('confirmConsentLabel').hidden=!requiresConsent;
  install.hidden=!isDependency;ok.hidden=isDependency;
  ok.disabled=requiresConsent;install.disabled=true;
  el('confirmText').textContent=t(key,params);
  const controller=new AbortController();
  const settle=value=>{controller.abort();dialog.close();resolve(value)};
  checkbox.addEventListener('change',()=>{ok.disabled=requiresConsent&&!checkbox.checked;install.disabled=!checkbox.checked},{signal:controller.signal});
  el('confirmCancel').addEventListener('click',()=>settle(false),{signal:controller.signal});
  ok.addEventListener('click',()=>settle(!requiresConsent||checkbox.checked),{signal:controller.signal});
  install.addEventListener('click',()=>settle(checkbox.checked),{signal:controller.signal});
  dialog.addEventListener('cancel',event=>{event.preventDefault();settle(false)},{signal:controller.signal});
  dialog.showModal();
  if(requiresConsent)checkbox.focus();else el('confirmCancel').focus();
 });
}
const overlay=el('operationOverlay');
function setOperationProgress(key){el('operationOverlayText').textContent=t(key);el('operationOverlayHint').textContent=t('progress.wait');}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Setup can return START_REQUESTED before the real OAuth server / tunnel become ready.
// Never claim completion or show an invented percent until sensors confirm it.
async function settleAfterAction(action,{attempts=30,intervalMs=2000}={}){
 for(let i=0;i<attempts;i++){
  setOperationProgress('progress.verify');
  const remote=action!=='stop'&&(i%3===0||i===attempts-1);
  const data=await window.mcpManager.status(remote);
  data.decision=decide(data);
  apply(data);
  if(action==='stop'&&!data.serverAlive&&!data.tunnelAlive)return true;
  if(remote&&data.serverOwned&&data.tunnelOwned&&data.urlValid&&
     data.public==='HEALTHY'&&data.oauth==='HEALTHY'&&
     data.authorization==='AUTH_REQUIRED'&&data.ready)return true;
  if(i<attempts-1)await delay(intervalMs);
 }
 return false;
}
async function operate(name){
 if(busy)return;
 if(name==='repair'&&(!latest?.coreInstalled||latest?.dependencies?.coreBuilt===false)&&!(await requestConfirmation('confirm.firstInstall')))return;
 if(name==='restart'&&!(await requestConfirmation('confirm.restart')))return;
 if(name==='stop'&&!(await requestConfirmation('confirm.stop')))return;
 busy=true;overlay.hidden=false;setOperationProgress('progress.start');
 for(const id of ['repair','restart','stop','verify','installDependencies'])el(id).disabled=true;
 showNotice('notice.starting');
 let submitted=false;
 try{
  const action=name==='repair'?'setup':name;
  const result=await window.mcpManager.operate(action);
  submitted=true;
  if(result.result==='NO_MUTATION'){
    showNotice('notice.hold',{reason:result.reason||'REVIEW_REQUIRED'},true);
  }else{
    const ready=await settleAfterAction(action);
    if(ready)showNotice(result.result==='REUSED_EXISTING'?'notice.reused':'notice.completed');
    else {setOperationProgress('progress.timeout');showNotice('notice.notVerified',{},true);}
  }
 }catch(e){showNotice('notice.failed',{error:String(e.message||e).slice(0,180)},true);}
 finally{
  busy=false;overlay.hidden=true;
  for(const id of ['repair','restart','stop','verify'])el(id).disabled=false;
  // The final dashboard never remains a stale pre-operation snapshot.
  await refresh(true);
 }
}

async function copy(type){
 try{
  await window.mcpManager.copy(type);
  showNotice(type==='url'?'notice.urlCopied':'notice.keyCopied',{},type==='key');
 }catch(e){showNotice('notice.failed',{error:String(e.message||e).slice(0,180)},true);}
}
el('languageSelect').addEventListener('change',async(event)=>{
 const next=event.target.value;
 if(!supported.includes(next)){event.target.value=locale;return;}
 const previous=locale;setLanguage(next);
 try{await window.mcpManager.setLanguage(next);}
 catch(e){setLanguage(previous);showNotice('notice.failed',{error:String(e.message||e).slice(0,180)},true);}
});
el('installDependencies').addEventListener('click',async()=>{
 const deps=latest?.dependencies;
 if(busy||!deps||deps.ready||!(systemName==='macOS'?deps.brewPath:deps.canInstall))return;
 const approvedMissing=[...deps.missing];
 if(!(await requestConfirmation('confirm.dependencies',{items:approvedMissing.join(', ')})))return;
 busy=true;el('installDependencies').disabled=true;
 showNotice('deps.installing');
 try{
  await window.mcpManager.installDependencies(approvedMissing,true);
  showNotice('deps.installDone');
 }catch(e){showNotice('deps.installFailed',{error:String(e.message||e).slice(0,160)},true)}
 finally{busy=false;await refresh(true)}
});
el('repair').addEventListener('click',()=>{const d=latest?.decision;if(d?.operation==='WAIT_AND_RECHECK')refresh(true);else operate('repair')});
el('verify').addEventListener('click',()=>refresh(true));
el('restart').addEventListener('click',()=>operate('restart'));
el('stop').addEventListener('click',()=>operate('stop'));
el('copyUrl').addEventListener('click',()=>copy('url'));
el('copyKey').addEventListener('click',()=>copy('key'));
el('revealKey').addEventListener('click',async()=>{
 try{
  const value=await window.mcpManager.reveal();
  const input=el('approvalKey');input.type='text';input.value=value;
  clearTimeout(revealedTimer);revealedTimer=setTimeout(hideKey,15000);
  showNotice('notice.revealed',{},true);
 }catch(e){showNotice('notice.failed',{error:String(e.message||e).slice(0,180)},true);}
});
el('openChat').addEventListener('click',()=>window.mcpManager.openChatGPT());
el('minimize').addEventListener('click',()=>window.mcpManager.minimize());
el('close').addEventListener('click',()=>window.mcpManager.close());
window.mcpManager.onProgress((data)=>{
 if(data.phase==='error')showNotice('notice.progressError',{error:String(data.message||'').slice(0,150)},true);
 if(data.phase==='started')showNotice('notice.progressStart');
 if(data.phase==='complete')showNotice('notice.progressComplete');
});
window.addEventListener('blur',hideKey);
async function initialize(){
 try{
  const config=await window.mcpManager.language();
  setLanguage(resolveLocale(config.selected,config.system));
 }catch{
  setLanguage(resolveLocale(null,navigator.language));
 }
 await refresh(true);
 autoTimer=setInterval(()=>{if(!busy&&!loading)refresh((++backgroundPolls%4)===0)},8000);
}
logViewer=attachLogViewer({t,backend:source=>window.mcpManager.logs(source),onOverview:hideKey});
initialize();
