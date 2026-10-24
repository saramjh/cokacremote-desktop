// This is deliberately a separate, explicit GUI-consent operation.
// Running an install is prohibited in a local source-only staging tree.
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {diagnoseMacDependencies,createInstallPlan,runApprovedInstall} from './dependencies.mjs';
const stageRoot=resolve(import.meta.dirname,'../..');
export async function executeInstallCli(args=process.argv.slice(2)){
 if(existsSync(resolve(stageRoot,'.selfhost-safety-fence')))throw Error('STAGING_ONLY: dependency installation is disabled in the development copy');
 if(!existsSync(join(homedir(),'.local','share','cokacremote-manager-rc-trial','trial-ready')))throw Error('RC_TRIAL_NOT_ARMED: dependency installation blocked outside explicit trial');
 if(args[0]!=='--consent')throw Error('Explicit GUI consent is required');
 const approvedMissing=args.slice(1);
 const before=diagnoseMacDependencies();
 // Require exact revalidation of the UI-reviewed list. No surprise extra packages.
 if(JSON.stringify(approvedMissing)!==JSON.stringify(before.missing))throw Error('Dependency plan has changed; review the new proposal first');
 const plan=createInstallPlan(before);
 const result=await runApprovedInstall({plan,approved:true,
  run:(bin,argv)=>execFileSync(bin,argv,{encoding:'utf8',timeout:300000,stdio:['ignore','pipe','pipe']}),
  verify:diagnoseMacDependencies});
 return {ready:result.ready,missing:result.missing};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 executeInstallCli().then(r=>process.stdout.write(JSON.stringify(r)+'\n')).catch(e=>{console.error('DEPENDENCY_INSTALL_FAILED '+e.message);process.exitCode=1});
}
