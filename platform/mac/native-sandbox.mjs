// Opt-in isolated Mac functional Manager lane. Uses a real upstream OAuth server
// on an alternate loopback port and a local proxy fixture instead of Cloudflare.
// No operation here reads or writes ~/.cokacremote, launchd or port 3000.
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync,existsSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {reconcileMacSetup} from '../../core/mac-setup-controller.mjs';
function macProcess(pid,marker){
 if(!Number.isSafeInteger(pid)||pid<2)return false;
 try{
  const command=execFileSync('/bin/ps',['-p',String(pid),'-o','command='],{encoding:'utf8',timeout:2500}).trim();
  const uid=Number(execFileSync('/bin/ps',['-p',String(pid),'-o','uid='],{encoding:'utf8',timeout:2500}).trim());
  return uid===process.getuid()&&command.includes(marker);
 }catch{return false}
}
function getPid(path){try{return Number(readFileSync(path,'utf8').trim())}catch{return 0}}
function listeningPid(port){try{return Number(execFileSync('/usr/sbin/lsof',['-nP','-tiTCP:'+port,'-sTCP:LISTEN'],{encoding:'utf8',timeout:2500}).trim().split(/\s+/)[0])}catch{return 0}}
async function probe(url){try{const c=new AbortController();const t=setTimeout(()=>c.abort(),1800);try{const r=await fetch(url,{signal:c.signal});return r}finally{clearTimeout(t)}}catch{return null}}
export function createNativeSandboxManager({root,upstream,serverPort,tunnelPort}){
 if(process.platform!=='darwin')throw Error('Native sandbox requires macOS');
 if(!root||!upstream||[serverPort,tunnelPort].some(v=>!Number.isInteger(v)||v<1024||v>65535||v===3000)||serverPort===tunnelPort)throw Error('Invalid isolated ports');
 const canonical=realpathSync(root);
 if(!canonical.startsWith(realpathSync(tmpdir())+'/')&&!canonical.startsWith('/private/tmp/'))throw Error('Sandbox state must reside under system temporary directory');
 const workerScript=resolve(import.meta.dirname,'sandbox-worker.mjs');
 const upstreamSource=join(realpathSync(upstream),'dist','src','server.js');
 if(!existsSync(upstreamSource))throw Error('Upstream compiled OAuth server missing');
 const base=`http://127.0.0.1:${tunnelPort}`,url=base+'/mcp';
 const wrapper=()=>getPid(join(canonical,'manager.pid'));
 const ownsWrapper=()=>macProcess(wrapper(),workerScript+' '+canonical);
 const ownsServer=()=>{const pid=getPid(join(canonical,'server.pid'));return pid===listeningPid(serverPort)&&macProcess(pid,'dist/src/server.js')};
 const ownsTunnel=()=>{const pid=getPid(join(canonical,'tunnel.pid'));return pid===listeningPid(tunnelPort)&&macProcess(pid,'sandbox-proxy.mjs')};
 async function status(){
  const serverOwned=ownsServer(),tunnelOwned=ownsTunnel();
  const serverPid=serverOwned?getPid(join(canonical,'server.pid')):null;
  const tunnelPid=tunnelOwned?getPid(join(canonical,'tunnel.pid')):null;
  const response=await probe(`http://127.0.0.1:${serverPort}/health`);
  let health;try{health=response?.ok?await response.json():null}catch{}
  const localHealth=serverOwned&&health?.service==='cokacremote'&&health?.oauthEnabled?'HEALTHY':'OFFLINE';
  const publicHealth=await probe(base+'/health');
  const auth=await probe(base+'/.well-known/oauth-authorization-server');
  const protectedResponse=await probe(base+'/.well-known/oauth-protected-resource/mcp');
  const unauthorized=await probe(url);
  let issuer=null,resource=null;
  try{issuer=(await auth?.json())?.issuer;resource=(await protectedResponse?.json())?.resource}catch{}
  const oauthAligned=(issuer===base||issuer===base+'/')&&resource===url;
  const anonymous401=unauthorized?.status===401;
  const remoteHealth=publicHealth?.ok?'HEALTHY':'OFFLINE';
  const approvalKeyAvailable=existsSync(join(canonical,'approval-key'));
  return {checkedAt:new Date().toISOString(),taskState:ownsWrapper()?'Running':'Ready',serverAlive:serverOwned,tunnelAlive:tunnelOwned,serverOwned,tunnelOwned,serverPid,tunnelPid,localHealth,remoteHealth,oauthAligned,anonymous401,url,urlValid:true,endpoint:url,approvalKeyAvailable,ready:serverOwned&&tunnelOwned&&localHealth==='HEALTHY'&&remoteHealth==='HEALTHY'&&oauthAligned&&anonymous401,local:localHealth,public:remoteHealth,oauth:oauthAligned?'HEALTHY':'NOT_CHECKED',authorization:anonymous401?'AUTH_REQUIRED':'NOT_CHECKED',dependencies:{ready:true,missing:[]},detail:'ISOLATED_NATIVE_SANDBOX; no real Cloudflare network'};
 }
 function startBoth(){
  if(ownsWrapper())return {result:'ALREADY_STARTING'};
  if(listeningPid(serverPort)||listeningPid(tunnelPort))throw Error('Sandbox ports occupied; refusing to displace process');
  if(!existsSync(join(canonical,'approval-key')))writeFileSync(join(canonical,'approval-key'),randomBytes(24).toString('base64url')+'\n',{mode:0o600});
  const log=openSync(join(canonical,'sandbox-worker.log'),'a',0o600);
  const child=spawn(process.execPath,[workerScript,canonical,realpathSync(upstream),String(serverPort),String(tunnelPort)],{cwd:canonical,detached:true,stdio:['ignore',log,log]});
  closeSync(log);
  if(!Number.isSafeInteger(child.pid)||child.pid<2)throw Error('Sandbox worker spawn failed');
  child.on('error',()=>{});child.unref();
  writeFileSync(join(canonical,'manager.pid'),String(child.pid)+'\n',{mode:0o600});
  return {result:'START_REQUESTED'};
 }
 async function stop(){
  if(!ownsWrapper()){
   const s=await status();
   if(s.serverAlive||s.tunnelAlive)throw Error('Unverified orphan processes; refusing stop');
   return {result:'STOPPED',state:s};
  }
  process.kill(wrapper(),'SIGTERM');
  const end=Date.now()+8000;
  while(Date.now()<end){const s=await status();if(!s.serverAlive&&!s.tunnelAlive&&!ownsWrapper())return {result:'STOPPED',state:s};await new Promise(r=>setTimeout(r,110))}
  throw Error('Sandbox services did not stop cleanly');
 }
 async function operate(action){
  if(action==='setup')return reconcileMacSetup({getStatus:status,ensureEnvironment:()=>{},startBoth,recoverServerOnly:()=>{throw Error('Sandbox partial recovery disabled pending standalone test')},createAgent:()=>{} });
  if(action==='stop')return stop();
  if(action==='restart'){await stop();return operate('setup')}
  throw Error('Unsupported sandbox action');
 }
 return {status,operate,dispose:stop,root:canonical};
}
