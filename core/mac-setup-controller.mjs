// Injectable setup orchestration. No direct OS operations here; isolated tests can
// exercise all service transitions without touching the live development bridge.
import {decide} from './reconcile.mjs';
export async function reconcileMacSetup({getStatus,ensureEnvironment,startBoth,recoverServerOnly,createAgent},{supervisor=false}={}){
 const before=await getStatus(true);
 if((before.serverAlive&&!before.serverOwned)||(before.tunnelAlive&&!before.tunnelOwned)){
  throw Error('Unverified process owner; refusing to alter an existing server/tunnel.');
 }
 const policy=decide(before);
 const finish=()=>getStatus(false);
 if(before.serverOwned&&before.tunnelOwned&&before.localHealth==='HEALTHY'&&before.urlValid){
  if(!supervisor)createAgent();
  return {result:'REUSED_EXISTING',operation:policy.operation,state:await finish()};
 }
 if(policy.operation==='WAIT_AND_RECHECK'){
  return {result:'NO_MUTATION',reason:'Live owned components are partially healthy; avoid disruptive restart.',state:before};
 }
 ensureEnvironment();
 if(!before.serverAlive&&!before.tunnelAlive){
  const started=startBoth();
  if(!supervisor)createAgent();
  return {result:started.result,state:await finish()};
 }
 if(!before.serverAlive&&before.tunnelOwned){
  recoverServerOnly(before);
 }else if(before.serverOwned&&!before.tunnelAlive){
  throw Error('Tunnel absent; avoid unattended issuer rotation. Use deliberate Restart after verifying ChatGPT connection impact.');
 }else{
  throw Error('No safe recovery transition for observed process state.');
 }
 if(!supervisor)createAgent();
 return {result:'RECONCILED',state:await finish()};
}
