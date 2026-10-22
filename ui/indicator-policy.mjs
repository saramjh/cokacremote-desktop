// One presentation-level verification policy for both Windows and macOS.
// It consumes evidence from platform adapters but never infers OAuth success from MCP uptime.
const BAD_AUTH=(value)=>typeof value==='string' && (value==='MISMATCH'||value==='INVALID'||value.startsWith('UNEXPECTED_')||value==='AUTH_FAILED');
const state=(level,key,detail)=>Object.freeze({level,key,detail});
export function indicators(status){
  const s=status||{};
  const local=s.localHealth??s.local;
  const remote=s.remoteHealth??s.public;
  const serverAlive=s.serverAlive===true;
  const tunnelAlive=s.tunnelAlive===true;
  const server=local==='HEALTHY'&&s.serverOwned===true?
    state('verified','status.online','LOCAL_HEALTH_AND_OWNER'):
    serverAlive&&s.serverOwned===false?
    state('blocked','status.ownerUnverified','PROCESS_OWNERSHIP_UNKNOWN'):
    local==='OFFLINE'&&serverAlive===false?
    state('offline','status.serverStopped','LOCAL_SERVER_OFFLINE'):
    state('unverified','status.proofPending','LOCAL_HEALTH_OR_OWNER_UNVERIFIED');
  const tunnel=remote==='HEALTHY'&&s.tunnelOwned===true&&s.urlValid===true?
    state('verified','status.publicOk','PUBLIC_HEALTH_AND_OWNER'):
    tunnelAlive&&s.tunnelOwned===false?
    state('blocked','status.ownerUnverified','TUNNEL_OWNERSHIP_UNKNOWN'):
    remote==='OFFLINE'&&tunnelAlive===false?
    state('offline','status.unavailable','PUBLIC_TUNNEL_OFFLINE'):
    remote==='OFFLINE'&&tunnelAlive?
    state('attention','status.remoteUnreachable','PUBLIC_CHECK_FAILED'):
    state('unverified','status.proofPending','PUBLIC_HEALTH_OR_OWNER_UNVERIFIED');
  const issuerGood=s.oauthAligned===true||s.oauth==='HEALTHY';
  const protectedGood=s.anonymous401===true||s.authorization==='AUTH_REQUIRED';
  const explicitMismatch=s.oauth==='MISMATCH'||BAD_AUTH(s.authorization)||
     (s.oauthAligned===false && s.oauth==='MISMATCH');
  const oauth=issuerGood&&protectedGood?
    state('verified','status.authPassed','OAUTH_ISSUER_RESOURCE_AND_401'):
    explicitMismatch?
    state('attention','status.oauthMismatch','OAUTH_ISSUER_OR_AUTHENTICATION_MISMATCH'):
    state('unverified','status.authPending','OAUTH_PUBLIC_EVIDENCE_INCOMPLETE');
  return Object.freeze({server,tunnel,oauth});
}
export function allVerified(items){
  return Object.values(items).every(item=>item.level==='verified');
}
