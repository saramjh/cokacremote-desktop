// Pure launchd policy: file presence and loaded state must never be conflated.
export function decideAgentReconcile({fileExists,loaded}){
 if(fileExists&&loaded)return 'REUSE';
 if(fileExists&&!loaded)return 'BOOTSTRAP';
 if(!fileExists&&loaded)return 'BLOCK';
 return 'INSTALL';
}
