// Background launcher for upstream's intentionally long-running Quick Tunnel bootstrap.
// Never run the upstream script synchronously: it waits on a live log stream by design.
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,openSync,closeSync,unlinkSync,statSync} from 'node:fs';
import {join} from 'node:path';

const workerFile = stateDir => join(stateDir,'manager-bootstrap.pid');
const maybeAlive=pid=>{
  if(!Number.isSafeInteger(pid)||pid<2)return false;
  try{process.kill(pid,0);return true}
  catch(e){return e?.code==='EPERM'}
};
const guardFile = stateDir => join(stateDir,'manager-bootstrap.guard');

function ownedWorker(pid,script){
  if(!Number.isSafeInteger(pid)||pid<2)return false;
  try{
    const uid=Number(execFileSync('/bin/ps',['-p',String(pid),'-o','uid='],{encoding:'utf8',timeout:2500}).trim());
    const command=execFileSync('/bin/ps',['-p',String(pid),'-o','command='],{encoding:'utf8',timeout:2500}).trim();
    return uid===process.getuid() && command.includes(script);
  }catch{return false}
}

export function launchBootstrap({script,stateDir,cwd,spawnFn=spawn,isOwned=ownedWorker,isAlive=maybeAlive,clock=Date.now}){
  const pidFile=workerFile(stateDir),guard=guardFile(stateDir);
  try{if(!statSync(script).isFile())throw Error('Not a regular bootstrap script')}
  catch{throw Error('Bootstrap script is missing or invalid: '+script)}
  let previous=0;
  try{previous=Number(readFileSync(pidFile,'utf8').trim())}catch{}
  if(isOwned(previous,script))return {result:'ALREADY_STARTING',pid:previous};

  // Atomic guard also covers the short interval between fork and PID publication.
  let guardFd;
  try{guardFd=openSync(guard,'wx',0o600)}catch(e){
    if(e.code!=='EEXIST')throw e;
    // The CLI parent exits while the bootstrap shell stays detached; therefore its
    // 'exit' callback is not guaranteed to clear the guard. If *both* records name
    // the same verified-dead worker, release that guard immediately, even when new.
    try{previous=Number(readFileSync(pidFile,'utf8').trim())}catch{previous=0}
    let guardOwner=0;
    try{guardOwner=Number(readFileSync(guard,'utf8').trim())}catch{}
    if(isOwned(previous,script))return {result:'ALREADY_STARTING',pid:previous};
    // A missing `ps`, permission denial, or parser mismatch is NOT proof of exit.
    // If PID is still alive but ownership cannot be proven, fail closed.
    if(isAlive(previous)||isAlive(guardOwner))return {result:'STARTUP_IN_PROGRESS'};
    const verifiedExited=previous>1&&guardOwner===previous;
    if(!verifiedExited && clock()-statSync(guard).mtimeMs<300000)return {result:'STARTUP_IN_PROGRESS'};
    unlinkSync(guard);
    try{guardFd=openSync(guard,'wx',0o600)}catch(e2){
      if(e2.code==='EEXIST')return {result:'STARTUP_IN_PROGRESS'};
      throw e2;
    }
  }
  closeSync(guardFd);
  let errorFd;
  try{
    // Upstream prints an OAuth approval key on stdout; never persist that stream.
    errorFd=openSync(join(stateDir,'manager-bootstrap-error.log'),'a',0o600);
    const child=spawnFn('/bin/bash',[script],{cwd,detached:true,stdio:['ignore','ignore',errorFd]});
    // Node can report a failed spawn on a later 'error' event, not synchronously.
    // Attach handlers before checking the PID to avoid an uncaught event.
    const childPid=child.pid;
    const cleanup=()=>{
      // A different/newer worker must never lose its lock due to an old exit event.
      try{if(Number(readFileSync(pidFile,'utf8').trim())===childPid)unlinkSync(pidFile)}catch{}
      try{if(Number(readFileSync(guard,'utf8').trim())===childPid)unlinkSync(guard)}catch{}
    };
    child.once?.('error',cleanup);
    child.once?.('exit',cleanup);
    if(!Number.isSafeInteger(childPid)||childPid<2)throw Error('Bootstrap process did not start');
    writeFileSync(guard,String(childPid)+'\n',{mode:0o600});
    writeFileSync(pidFile,String(childPid)+'\n',{mode:0o600});
    child.unref();
    return {result:'START_REQUESTED',pid:child.pid};
  }catch(e){
    try{unlinkSync(guard)}catch{}
    throw e;
  }finally{if(errorFd!==undefined)closeSync(errorFd)}
}


// Stops only a bootstrap process whose UID and exact launch script are verified.
// Never kill a reused PID or manually launched unrelated shell.
export function stopVerifiedBootstrap({stateDir,script,isOwned=ownedWorker,signalFn=process.kill}){
 let pid=0;
 try{pid=Number(readFileSync(workerFile(stateDir),'utf8').trim())}catch{}
 if(!Number.isSafeInteger(pid)||pid<2)return {result:'NOT_RUNNING'};
 if(!isOwned(pid,script))return {result:'UNVERIFIED_OWNER',pid};
 signalFn(pid,'SIGTERM');
 return {result:'STOP_REQUESTED',pid};
}

export async function waitForBootstrapExit({stateDir,script,isOwned=ownedWorker,sleep=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=15000}){
 let pid=0;
 try{pid=Number(readFileSync(workerFile(stateDir),'utf8').trim())}catch{}
 if(!Number.isSafeInteger(pid)||pid<2)return true;
 const until=Date.now()+timeoutMs;
 while(isOwned(pid,script)&&Date.now()<until)await sleep(100);
 if(isOwned(pid,script))return false;
 const pidFile=workerFile(stateDir),guard=guardFile(stateDir);
 try{if(Number(readFileSync(pidFile,'utf8').trim())===pid)unlinkSync(pidFile)}catch{}
 try{if(Number(readFileSync(guard,'utf8').trim())===pid)unlinkSync(guard)}catch{}
 return true;
}
