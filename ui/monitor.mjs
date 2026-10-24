// Bounded reuse of external proof, only for the exact previously verified processes.
export function withRemoteProof(current,prior,verifiedAt,now=Date.now()){
 if(!prior||!verifiedAt||now-verifiedAt>75000||now<verifiedAt)return current;
 if(!current.serverOwned||!current.tunnelOwned||current.local!=='HEALTHY'||!current.urlValid)return current;
 if(current.endpoint!==prior.endpoint||current.serverPid!==prior.serverPid||current.tunnelPid!==prior.tunnelPid)return current;
 if(prior.public!=='HEALTHY'||prior.oauth!=='HEALTHY'||prior.authorization!=='AUTH_REQUIRED')return current;
 return {...current,public:prior.public,oauth:prior.oauth,authorization:prior.authorization,
  remoteHealth:'HEALTHY',oauthAligned:true,anonymous401:true,remoteProofCached:true};
}
