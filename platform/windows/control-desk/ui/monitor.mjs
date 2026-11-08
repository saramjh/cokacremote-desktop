export const PROOF_TTL_MS=75_000;
// Remote OAuth results are meaningful only for the same owned local processes and URL.
export function withRemoteProof(fresh,previous,verifiedAt,now=Date.now()){
 const live=Boolean(fresh?.serverOwned&&fresh?.tunnelOwned&&fresh?.urlValid&&fresh?.local==='HEALTHY');
 const same=Boolean(previous&&fresh?.endpoint&&previous.endpoint===fresh.endpoint&&
   previous.serverPid===fresh.serverPid&&previous.tunnelPid===fresh.tunnelPid);
 const valid=Boolean(previous?.public==='HEALTHY'&&previous?.oauth==='HEALTHY'&&
   previous?.authorization==='AUTH_REQUIRED'&&previous?.remoteHealth==='HEALTHY');
 if(!live||!same||!valid||!verifiedAt||now-verifiedAt<0||now-verifiedAt>PROOF_TTL_MS)return fresh;
 return {...fresh,public:previous.public,oauth:previous.oauth,authorization:previous.authorization,
  remoteHealth:previous.remoteHealth,oauthAligned:true,anonymous401:true,
  ready:true,remoteProofCached:true};
}
export function isVerifiedReady(data){
 return Boolean(data?.ready&&data?.serverOwned&&data?.tunnelOwned&&data?.urlValid&&
 data?.remoteHealth==='HEALTHY'&&data?.oauthAligned===true&&data?.anonymous401===true);
}
export function operationSettled(action,data){
 return action==='stop'? Boolean(data&&!data.serverAlive&&!data.tunnelAlive):
 isVerifiedReady(data);
}
