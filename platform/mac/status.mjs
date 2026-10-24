import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {diagnoseMacDependencies} from './dependencies.mjs';
const home=homedir(),state=join(home,'.cokacremote');
const run=(cmd,args)=>{try{return execFileSync(cmd,args,{encoding:'utf8',timeout:2500,stdio:['ignore','pipe','ignore']}).trim()}catch{return ''}};
const owned=(pid,part)=>{
 if(!Number.isInteger(pid)||pid<=1)return false;
 const uid=run('/bin/ps',['-p',String(pid),'-o','uid=']);
 const command=run('/bin/ps',['-p',String(pid),'-o','command=']);
 return Number(uid)===process.getuid() && command.includes(part);
};
const filepid=name=>{try{return Number(readFileSync(join(state,name),'utf8').trim())}catch{return 0}};
const firstPID=s=>Number((s||'').split(/\s+/)[0])||0;
export const processState=()=>{
 const portPid=firstPID(run('/usr/sbin/lsof',['-nP','-tiTCP:3000','-sTCP:LISTEN']));
 const tunnelPid=filepid('cloudflared.pid');
 const serverOwned=owned(portPid,'dist/src/server.js');
 const tunnelOwned=owned(tunnelPid,'cloudflared tunnel --url');
 const tunnelAlive=Boolean(run('/bin/ps',['-p',String(tunnelPid),'-o','pid=']));
 const label='io.github.cokacremote.desktop.rc';
 const loaded=run('/bin/launchctl',['list']).includes(label);
 return {portPid,tunnelPid,serverAlive:portPid>0,serverOwned,tunnelAlive,tunnelOwned,taskState:loaded?'Running':'Ready'};
};
const fetchJSON=async(path,timeout=3500)=>{
 const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),timeout);
 try{const response=await fetch(path,{signal:ctl.signal});if(!response.ok)throw Error('HTTP_'+response.status);return await response.json()}
 finally{clearTimeout(t)}
};
export const publicCheck=async(base)=>{
 const [health,a,p,unauthorized]=await Promise.allSettled([
  fetchJSON(base+'/health',6000),fetchJSON(base+'/.well-known/oauth-authorization-server',6000),
  fetchJSON(base+'/.well-known/oauth-protected-resource/mcp',6000),
  fetch(base+'/mcp',{signal:AbortSignal.timeout(6000)})
 ]);
 const healthy=health.status==='fulfilled'&&health.value?.status==='ok'&&health.value?.service==='cokacremote'&&health.value?.oauthEnabled===true;
 const found=a.status==='fulfilled'&&p.status==='fulfilled';
 const oauthAligned=found&&String(a.value?.issuer||'').replace(/\/$/,'')===base&&p.value?.resource===base+'/mcp';
 const anonymous401=unauthorized.status==='fulfilled'&&unauthorized.value?.status===401;
 const authorizationState=unauthorized.status==='fulfilled'?(anonymous401?'AUTH_REQUIRED':'UNEXPECTED_'+unauthorized.value?.status):'NOT_CHECKED';
 return {remoteHealth:healthy?'HEALTHY':'OFFLINE',oauthAligned,anonymous401,
  oauthState:found?(oauthAligned?'HEALTHY':'MISMATCH'):'NOT_CHECKED',authorizationState};
};
export async function getStatus(remote=false){
 const p=processState();
 let localHealth='OFFLINE',url='',oauthAligned=false,anonymous401=false,remoteHealth='NOT_CHECKED';
 try{
  const health=await fetchJSON('http://127.0.0.1:3000/health');
  if(health?.status==='ok'&&health?.service==='cokacremote'&&health?.oauthEnabled===true)localHealth='HEALTHY';
  const a=await fetchJSON('http://127.0.0.1:3000/.well-known/oauth-authorization-server');
  const issuer=String(a?.issuer||'');
  if(/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(issuer))url=issuer+'/mcp';
 }catch{}
 if(!url && p.tunnelOwned){
  try{const log=readFileSync(join(state,'cloudflared.log'),'utf8');
   const found=[...log.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)].map(m=>m[0]);
   if(found.length)url=found.at(-1)+'/mcp'
  }catch{}
 }
 if(remote&&url){
  const check=await publicCheck(url.slice(0,-4));
  ({remoteHealth,oauthAligned,anonymous401}=check);
 }
 const approvalKeyAvailable=existsSync(join(state,'oauth-approval-key'));
 return {
  checkedAt:new Date().toISOString(),task:p.taskState,taskState:p.taskState,
  local:localHealth,localHealth,public:remoteHealth,remoteHealth,
  oauth:oauthAligned?'HEALTHY':'NOT_CHECKED',authorization:anonymous401?'AUTH_REQUIRED':'NOT_CHECKED',
  serverAlive:p.serverAlive,serverOwned:p.serverOwned,serverPid:p.portPid||null,
  tunnelAlive:p.tunnelAlive,tunnelOwned:p.tunnelOwned,tunnelPid:p.tunnelPid||null,
  url,urlValid:Boolean(url),endpoint:url,approvalKeyAvailable,coreInstalled:existsSync(join(home,'MCPWorkspace','cokacremote','dist','src','server.js')),
  oauthAligned,anonymous401,
  ready:p.serverOwned&&p.tunnelOwned&&localHealth==='HEALTHY'&&Boolean(url)&&approvalKeyAvailable&&(remote?remoteHealth==='HEALTHY'&&oauthAligned&&anonymous401:true),
  dependencies:diagnoseMacDependencies(),
  detail:'macOS sensor; ChatGPT plugin registration must be checked in ChatGPT'
 };
}
if(process.argv[1] && realpathSync(fileURLToPath(import.meta.url))===realpathSync(process.argv[1]))console.log(JSON.stringify(await getStatus(process.argv.includes('--remote'))));
