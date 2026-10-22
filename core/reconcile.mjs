// Pure reconciliation policy. No external side effects, no credentials and no process termination.
export const STATES=Object.freeze({
  REUSE:'REUSE_BOTH',ADOPT:'ADOPT_EXISTING',START:'START_BOTH',
  SERVER:'RECOVER_SERVER_ONLY',TUNNEL:'RECOVER_TUNNEL_ONLY',
  REBIND:'RECOVER_TUNNEL_REBIND_SERVER',WAIT:'WAIT_AND_RECHECK',
  BLOCK:'BLOCK_UNVERIFIED_OWNER',RECONNECT:'CHATGPT_RECONNECT_REQUIRED'
});
export function decide(s){
  const alive=Boolean(s.serverAlive),tunnel=Boolean(s.tunnelAlive);
  const serverTrusted=alive&&s.serverOwned===true;
  const tunnelTrusted=tunnel&&s.tunnelOwned===true;
  const task=s.taskState||'UNKNOWN';
  const addr=Boolean(s.url) && s.urlValid===true;
  const local=s.localHealth==='HEALTHY';
  const remote=s.remoteHealth==='HEALTHY';
  const aligned=s.oauthAligned===true;
  const anonymous=s.anonymous401===true;
  const allReady=local&&addr&&remote&&aligned&&anonymous;
  let operation=STATES.WAIT,reason='Observation incomplete; do not disrupt healthy components';
  if((alive&&!serverTrusted)||(tunnel&&!tunnelTrusted)){
    operation=STATES.BLOCK;reason='Port or tunnel is not a verified owned process; do not terminate';
  }else if(alive&&tunnel&&allReady){
    operation=task==='Running'?STATES.REUSE:STATES.ADOPT;
    reason='Existing server and public tunnel authenticated; preserve URL and both PIDs';
  }else if(alive&&tunnel&&local&&addr){
    operation=STATES.WAIT;reason='Transport components alive; public health/auth incomplete: retry observation with backoff';
  }else if(!alive&&tunnel&&addr&&remote===false){
    operation=STATES.SERVER;reason='Retain verified healthy tunnel and its URL; start only OAuth server with matching issuer';
  }else if(alive&&!tunnel&&local){
    operation=STATES.REBIND;reason='New tunnel hostname changes OAuth issuer; restart owned server only after new tunnel is verified';
  }else if(!alive&&!tunnel){
    operation=STATES.START;reason='No owned server or tunnel running';
  }else if(!alive&&tunnel&&!addr){
    operation=STATES.WAIT;reason='Tunnel exists but hostname is not yet verified; do not create a duplicate';
  }else if(alive&&tunnel&&!local){
    operation=STATES.WAIT;reason='Both components run; check server health before replacing a process';
  }
  const urlChanged=Boolean(s.previousUrl&&s.url&&s.previousUrl!==s.url);
  return Object.freeze({
    operation,reason,serverReusable:serverTrusted&&local,
    tunnelReusable:tunnelTrusted&&addr,urlChanged,
    requiresChatGPTReconnect:urlChanged,
    effectiveReady:allReady&&serverTrusted&&tunnelTrusted&&task==='Running',
    safeToMutate:operation!==STATES.BLOCK&&operation!==STATES.WAIT,
    checkedAt:s.checkedAt||null
  });
}
