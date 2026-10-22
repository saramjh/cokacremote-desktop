'use strict';
import {resolveLocale,translate,supported} from './i18n.mjs';

const el=(id)=>document.getElementById(id);
const systemName=window.mcpManager.platform==='darwin'?'macOS':'Windows';
el('hostLabel').textContent=systemName+' host';
el('hostContext').textContent=systemName+' / Remote MCP';

let locale='en',latest=null,loading=false,busy=false,revealedTimer,autoTimer;
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
 el('copyUrl').disabled=!data.urlValid;
 el('copyKey').disabled=!data.approvalKeyAvailable;
 el('revealKey').disabled=!data.approvalKeyAvailable;
 el('repair').disabled=busy||operation==='BLOCK_UNVERIFIED_OWNER';
 el('repair').textContent=t(key+'.action');
 el('actionNote').textContent=d.requiresChatGPTReconnect?t('status.reconnectNeeded'):
   operation==='REUSE_BOTH'?t('status.restoreSafe'):t('status.recoverScript');
 heartbeat(d.effectiveReady?'status.ready':data.local==='HEALTHY'?'status.partial':'status.assessing',Boolean(d.effectiveReady));
 if(d.requiresChatGPTReconnect)showNotice('status.urlChanged',{},true);
}
async function refresh(remote=false){
 if(loading)return;
 loading=true;el('verify').disabled=true;
 try{
  const data=await window.mcpManager.status(remote);
  apply(data);
  if(remote)showNotice(data.ready?'notice.verified':'notice.notVerified',{},!data.ready);
 }catch(e){
  heartbeat('status.assessing',false);
  showNotice('notice.readError',{error:String(e.message||e).slice(0,180)},true);
 }finally{loading=false;el('verify').disabled=false;}
}
async function operate(name){
 if(busy)return;
 if(name==='restart'&&!confirm(t('confirm.restart')))return;
 if(name==='stop'&&!confirm(t('confirm.stop')))return;
 busy=true;for(const id of ['repair','restart','stop','verify'])el(id).disabled=true;
 showNotice('notice.starting');
 try{
  const result=await window.mcpManager.operate(name==='repair'?'setup':name);
  if(result.result==='REUSED_EXISTING')showNotice('notice.reused');
  else if(result.result==='NO_MUTATION')showNotice('notice.hold',{reason:result.reason||'REVIEW_REQUIRED'},true);
  else showNotice('notice.completed');
 }catch(e){showNotice('notice.failed',{error:String(e.message||e).slice(0,180)},true);}
 finally{
  busy=false;for(const id of ['repair','restart','stop','verify'])el(id).disabled=false;
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
 autoTimer=setInterval(()=>{if(!busy&&!loading)refresh(true)},45000);
}
initialize();
