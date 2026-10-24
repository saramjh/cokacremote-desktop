import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,openSync,closeSync,copyFileSync,renameSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {getStatus} from './status.mjs';
import {reconcileMacSetup} from '../../core/mac-setup-controller.mjs';
import {decideAgentReconcile} from '../../core/mac-agent-policy.mjs';
import {launchBootstrap,stopVerifiedBootstrap,waitForBootstrapExit} from './boot-worker.mjs';
const home=homedir(),state=join(home,'.cokacremote'),repo=join(home,'MCPWorkspace','cokacremote');
// Finder does not inherit Homebrew's shell PATH.
process.env.PATH=['/opt/homebrew/bin','/usr/local/bin',process.env.PATH||'/usr/bin:/bin:/usr/sbin:/sbin'].join(':');
const label='io.github.cokacremote.desktop.rc';
const legacyLabel='io.github.cokacremote.desktop';
const trialReady=join(home,'.local','share','cokacremote-manager-rc-trial','trial-ready');
const launchPath=join(home,'Library','LaunchAgents',label+'.plist');
const agentRoot=join(home,'.local','share','cokacremote-manager-rc');
const q=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const sh=(cmd,args,timeout=90000,cwd=home)=>execFileSync(cmd,args,{encoding:'utf8',timeout,cwd,stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const detached=(command,args,env={})=>{
 const out=openSync(join(state,'manager-worker.log'),'a',0o600);
 try{const proc=spawn(command,args,{cwd:repo,env:{...process.env,...env},detached:true,stdio:['ignore',out,out]});proc.unref();return proc.pid}finally{closeSync(out)}
};
const findUrl=()=>{
 const log=readFileSync(join(state,'cloudflared.log'),'utf8');
 const matches=[...log.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)].map(x=>x[0]);
 return matches.at(-1)||'';
};
const launched=()=>existsSync(launchPath);
const loaded=()=>{try{sh('/bin/launchctl',['print','gui/'+process.getuid()+'/'+label],8000);return true}catch{return false}};
const legacyLoaded=()=>{try{sh('/bin/launchctl',['print','gui/'+process.getuid()+'/'+legacyLabel],8000);return true}catch{return false}};
const createAgent=()=>{
 const action=decideAgentReconcile({fileExists:launched(),loaded:loaded()});
 if(action==='REUSE')return false;
 if(action==='BLOCK')throw Error('launchd agent is loaded but its plist is missing; refusing replacement');
 if(action==='BOOTSTRAP'){
  sh('/bin/launchctl',['bootstrap','gui/'+process.getuid(),launchPath]);
  return true;
 }

 const node=sh('/usr/bin/which',['node']).trim();
 const root=resolve(import.meta.dirname,'..','..');
 mkdirSync(join(agentRoot,'core'),{recursive:true,mode:0o700});
 mkdirSync(join(agentRoot,'platform','mac'),{recursive:true,mode:0o700});
 for(const part of ['status.mjs','operate.mjs','supervisor.mjs','boot-worker.mjs'])
   copyFileSync(join(root,'platform','mac',part),join(agentRoot,'platform','mac',part));
 for(const part of ['reconcile.mjs','mac-setup-controller.mjs','mac-agent-policy.mjs'])
   copyFileSync(join(root,'core',part),join(agentRoot,'core',part));
 const runner=join(agentRoot,'platform','mac','supervisor.mjs');
 const content='<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>'+label+'</string><key>ProgramArguments</key><array><string>'+q(node)+'</string><string>'+q(runner)+'</string></array><key>RunAtLoad</key><true/><key>StartInterval</key><integer>120</integer><key>StandardOutPath</key><string>'+q(join(state,'manager-launchd.log'))+'</string><key>StandardErrorPath</key><string>'+q(join(state,'manager-launchd-error.log'))+'</string></dict></plist>\n';
 mkdirSync(join(home,'Library','LaunchAgents'),{recursive:true});
 writeFileSync(launchPath,content,{flag:'wx',mode:0o600});
 try{sh('/bin/launchctl',['bootstrap','gui/'+process.getuid(),launchPath]);}catch(e){throw Error('launchd bootstrap failed; agent file is preserved for review')}
 return true;
};
function prerequisites(){
 for(const t of ['node','npm','git','cloudflared']){
  try{sh('/usr/bin/which',[t])}catch{throw Error('Missing prerequisite: '+t+'. Install Node.js, Git and cloudflared first.')}
 }
}
function installCore(){
 // Do not modify an existing user checkout. If compiled server is missing, hold
 // instead of running npm against an unfamiliar/possibly dirty development tree.
 if(existsSync(join(repo,'deploy','setup-oauth-quicktunnel.sh'))){
  if(!existsSync(join(repo,'dist','src','server.js')))throw Error('Existing cokacremote checkout lacks compiled dist; build or review it before proceeding');
  return;
 }
 mkdirSync(join(home,'MCPWorkspace'),{recursive:true});
 if(existsSync(repo))throw Error('An unexpected existing cokacremote folder needs review.');
 // Install the exact bundled upstream version from the tested source snapshot;
 // never silently substitute a potentially older GitHub version.
 const archive=join(resolve(import.meta.dirname,'..','..'),'embedded-core.tgz');
 if(!existsSync(archive))throw Error('Packaged MCP core bundle not found; refusing network clone');
 const pending=repo+'-rc-install-'+process.pid;
 try{
  mkdirSync(pending,{recursive:false,mode:0o700});
  sh('/usr/bin/tar',['-xzf',archive,'-C',pending],25000);
  sh('/usr/bin/env',['npm','ci','--no-audit','--no-fund'],180000,pending);
  sh('/usr/bin/env',['npm','run','build'],180000,pending);
  if(!existsSync(join(pending,'dist','src','server.js')))throw Error('MCP core build output missing');
  renameSync(pending,repo);
 }catch(e){try{rmSync(pending,{recursive:true,force:true})}catch{}throw e}

}
const finish=async()=>getStatus(true);
export async function operate(action,{supervisor=false}={}){
 // Fail closed in a source-only self-hosting stage; never operate on the live control channel.
 if(existsSync(resolve(import.meta.dirname,'..','..','.selfhost-safety-fence')))
  throw Error('STAGING_ONLY: live MCP services cannot be mutated from this development copy');
 if(!existsSync(trialReady))throw Error('RC_TRIAL_NOT_ARMED: complete rc-trial-begin.sh before using live controls');
 if(legacyLoaded())throw Error('Legacy Manager LaunchAgent still loaded; refusing dual ownership');
 mkdirSync(state,{recursive:true,mode:0o700});
 if(action==='setup')return reconcileMacSetup({
  getStatus,
  ensureEnvironment:()=>{prerequisites();installCore()},
  startBoth:()=>launchBootstrap({script:join(repo,'deploy','setup-oauth-quicktunnel.sh'),stateDir:state,cwd:repo}),
  recoverServerOnly:before=>{
   if(!existsSync(join(state,'start-cokacremote.sh')))throw Error('Existing authenticated launcher missing');
   const base=before.endpoint?before.endpoint.slice(0,-4):findUrl();
   if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(base))throw Error('Cannot verify existing Quick Tunnel hostname');
   const pid=detached('/bin/bash',[join(state,'start-cokacremote.sh'),base]);
   writeFileSync(join(state,'cokacremote.pid'),String(pid)+'\n',{mode:0o600});
  },
  createAgent
 },{supervisor});
 const before=await getStatus(true);
 if((before.serverAlive&&!before.serverOwned)||(before.tunnelAlive&&!before.tunnelOwned)){
  throw Error('Unverified process owner; refusing to alter an existing server/tunnel.');
 }
 if(supervisor)throw Error('Supervisor may only perform setup');
 if(action==='stop'||action==='restart'){
  if(action==='restart'&&(!before.serverOwned||!before.tunnelOwned))throw Error('Both existing process identities must be verified before force restart');
  if(launched())try{sh('/bin/launchctl',['bootout','gui/'+process.getuid(),launchPath]);}catch{}
  const wrapper=stopVerifiedBootstrap({stateDir:state,script:join(repo,'deploy','setup-oauth-quicktunnel.sh')});
  if(wrapper.result==='STOP_REQUESTED' &&
     !(await waitForBootstrapExit({stateDir:state,script:join(repo,'deploy','setup-oauth-quicktunnel.sh')})))
    throw Error('Bootstrap wrapper has not stopped. Refusing to restart while it owns child processes.');
  for(const [pid,owned] of [[before.serverPid,before.serverOwned],[before.tunnelPid,before.tunnelOwned]])if(pid&&owned){try{process.kill(pid,'SIGTERM')}catch{}}
  await sleep(1400);
  if(action==='stop')return {result:'STOPPED',state:await finish()};
  const next=await getStatus(false);
  if(next.serverAlive||next.tunnelAlive)throw Error('Stop incomplete; refuse duplicate restart');
  return operate('setup');
 }
 throw Error('Unsupported action');
}
if(process.argv[1] && realpathSync(fileURLToPath(import.meta.url))===realpathSync(process.argv[1])){
 try{const result=await operate(process.argv[2]||'setup');console.log(JSON.stringify({result:result.result,ready:result.state?.ready,code:result.reason||null}))}
 catch(e){console.error('OPERATION_FAILED '+e.message);process.exitCode=1}
}
