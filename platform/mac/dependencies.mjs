// Diagnostic and consent-gated Homebrew plan. Never installs without a caller-provided runner
// and explicit consent. Useful in a disconnected, testable Manager UI workflow.
import {execFileSync} from 'node:child_process';
const required=Object.freeze(['node','npm','git','cloudflared']);
const installPackage=Object.freeze({node:'node',npm:'node',git:'git',cloudflared:'cloudflared'});
function defaultWhich(name){
 try{return execFileSync('/usr/bin/which',[name],{
  encoding:'utf8',timeout:2500,
  env:{...process.env,PATH:['/opt/homebrew/bin','/usr/local/bin',process.env.PATH||'/usr/bin:/bin'].join(':')}
 }).trim()||null}catch{return null}
}
export function diagnoseMacDependencies({which=defaultWhich}={}){
 const paths=Object.fromEntries(required.map(name=>[name,which(name)||null]));
 const missing=required.filter(name=>!paths[name]);
 const brewPath=which('brew')||null;
 return Object.freeze({ready:missing.length===0,paths,missing,brewPath,requiresConsent:missing.length>0});
}
export function createInstallPlan(report){
 if(!report||!Array.isArray(report.missing))throw Error('Missing diagnostic report');
 const names=report.missing;
 if(names.some(name=>!required.includes(name)))throw Error('Unrecognized dependency: refuse arbitrary package install');
 const packages=[...new Set(names.map(name=>installPackage[name]))];
 return Object.freeze({packages,missing:[...names],installer:report.brewPath||null,requiresConsent:packages.length>0});
}
export async function runApprovedInstall({plan,approved=false,run,verify=diagnoseMacDependencies}={}){
 if(!plan||!Array.isArray(plan.packages))throw Error('Install proposal missing');
 if(!approved)throw Error('Explicit user consent is required before installing dependencies');
 if(plan.packages.some(name=>!['node','git','cloudflared'].includes(name)))throw Error('Unexpected package: refused');
 if(!plan.installer && plan.packages.length)throw Error('Homebrew unavailable: user must approve a separate Homebrew bootstrap');
 if(plan.packages.length){
  if(typeof run!=='function')throw Error('No authorized package installer has been provided');
  await run(plan.installer,['install',...plan.packages]);
 }
 const result=await verify();
 if(!result.ready)throw Error('Dependency verification failed after installation: '+result.missing.join(','));
 return result;
}
