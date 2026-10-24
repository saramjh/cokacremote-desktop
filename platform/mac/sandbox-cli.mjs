// Native GUI bridge for isolated functional testing only. Cannot address live port 3000.
import {readFileSync,realpathSync} from 'node:fs';
import {join,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {createNativeSandboxManager} from './native-sandbox.mjs';
export async function command(action,providedRoot){
 if(!['status','setup','stop','restart'].includes(action))throw Error('Unsupported sandbox operation');
 if(!providedRoot)throw Error('Missing sandbox root');
 const root=realpathSync(providedRoot),tmp=realpathSync(tmpdir());
 if(!root.startsWith(tmp+'/')||!basename(root).startsWith('cokac-manager-native-e2e-'))throw Error('Refuse non-sandbox root');
 const profile=JSON.parse(readFileSync(join(root,'profile.json'),'utf8'));
 if(profile.mode!=='isolated-native-test'||profile.serverPort===3000||profile.tunnelPort===3000)throw Error('Invalid isolated test profile');
 const manager=createNativeSandboxManager({root,upstream:profile.upstream,serverPort:profile.serverPort,tunnelPort:profile.tunnelPort});
 const result=action==='status'?await manager.status():await manager.operate(action);
 // Sandbox credentials must never enter the user-facing Manager UI.
 if(action==='status')return {...result,approvalKeyAvailable:false,localPort:profile.serverPort,detail:'ISOLATED_NATIVE_SANDBOX; local-only proxy, not real Cloudflare'};
 return result;
}
if(process.argv[1]?.endsWith('sandbox-cli.mjs')){
 command(process.argv[2],process.argv[3]).then(result=>console.log(JSON.stringify(result))).catch(e=>{console.error('SANDBOX_OPERATION_FAILED '+e.message);process.exitCode=1});
}
