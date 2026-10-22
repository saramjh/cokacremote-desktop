import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,openSync,closeSync,copyFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {getStatus} from './status.mjs';
import {decide} from '../../core/reconcile.mjs';
const home=homedir(),state=join(home,'.cokacremote'),repo=join(home,'MCPWorkspace','cokacremote');
const label='io.github.cokacremote.desktop';
const launchPath=join(home,'Library','LaunchAgents',label+'.plist');
const agentRoot=join(home,'.local','share','cokacremote-manager');
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
const createAgent=()=>{
 if(launched())return false;
 const node=sh('/usr/bin/which',['node']).trim();
 const root=resolve(import.meta.dirname,'..','..');
 mkdirSync(join(agentRoot,'core'),{recursive:true,mode:0o700});
 mkdirSync(join(agentRoot,'platform','mac'),{recursive:true,mode:0o700});
 for(const part of ['status.mjs','operate.mjs','supervisor.mjs'])
   copyFileSync(join(root,'platform','mac',part),join(agentRoot,'platform','mac',part));
 copyFileSync(join(root,'core','reconcile.mjs'),join(agentRoot,'core','reconcile.mjs'));
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
 if(existsSync(join(repo,'deploy','setup-oauth-quicktunnel.sh')))return;
 mkdirSync(join(home,'MCPWorkspace'),{recursive:true});
 if(existsSync(repo))throw Error('An unexpected existing cokacremote folder needs review.');
 sh('/usr/bin/git',['clone','--depth','1','https://github.com/kstost/cokacremote.git',repo],120000);
 sh('/usr/bin/env',['npm','ci','--no-fund'],120000,repo);
 sh('/usr/bin/env',['npm','run','build'],120000,repo);
}
const finish=async()=>getStatus(true);
export async function operate(action,{supervisor=false}={}){
 mkdirSync(state,{recursive:true,mode:0o700});
 const before=await getStatus(true);
 if((before.serverAlive&&!before.serverOwned)||(before.tunnelAlive&&!before.tunnelOwned)){
  throw Error('Unverified process owner; refusing to alter an existing server/tunnel.');
 }
 const policy=decide(before);
 if(action==='setup'){
  if(before.serverOwned&&before.tunnelOwned&&before.localHealth==='HEALTHY'&&before.urlValid){
   if(!supervisor)createAgent();
   return {result:'REUSED_EXISTING',operation:policy.operation,state:await finish()};
  }
  if(policy.operation==='WAIT_AND_RECHECK')return {result:'NO_MUTATION',reason:'Live owned components are partially healthy; avoid disruptive restart.',state:before};
  prerequisites();installCore();
  if(!before.serverAlive&&!before.tunnelAlive){
   // Existing upstream script owns initial issuer, state and tunnel generation.
   sh('/bin/bash',[join(repo,'deploy','setup-oauth-quicktunnel.sh')],120000);
  }else if(!before.serverAlive&&before.tunnelOwned){
   if(!existsSync(join(state,'start-cokacremote.sh')))throw Error('Existing authenticated launcher missing');
   const base=before.endpoint?before.endpoint.slice(0,-4):findUrl();
   if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(base))throw Error('Cannot verify existing Quick Tunnel hostname');
   const pid=detached('/bin/bash',[join(state,'start-cokacremote.sh'),base]);
   writeFileSync(join(state,'cokacremote.pid'),String(pid)+'\n',{mode:0o600});
  }else if(before.serverOwned&&!before.tunnelAlive){
   throw Error('Tunnel absent; avoid unattended issuer rotation. Use deliberate Restart after verifying ChatGPT connection impact.');
  }
  if(!supervisor)createAgent();
  return {result:'RECONCILED',state:await finish()};
 }
 if(supervisor)throw Error('Supervisor may only perform setup');
 if(action==='stop'||action==='restart'){
  if(action==='restart'&&(!before.serverOwned||!before.tunnelOwned))throw Error('Both existing process identities must be verified before force restart');
  if(launched())try{sh('/bin/launchctl',['bootout','gui/'+process.getuid(),launchPath]);}catch{}
  for(const [pid,owned] of [[before.serverPid,before.serverOwned],[before.tunnelPid,before.tunnelOwned]])if(pid&&owned){try{process.kill(pid,'SIGTERM')}catch{}}
  await sleep(1400);
  if(action==='stop')return {result:'STOPPED',state:await finish()};
  const next=await getStatus(false);
  if(next.serverAlive||next.tunnelAlive)throw Error('Stop incomplete; refuse duplicate restart');
  return operate('setup');
 }
 throw Error('Unsupported action');
}
if(import.meta.url==='file://'+process.argv[1]){
 try{const result=await operate(process.argv[2]||'setup');console.log(JSON.stringify({result:result.result,ready:result.state?.ready,code:result.reason||null}))}
 catch(e){console.error('OPERATION_FAILED '+e.message);process.exitCode=1}
}
