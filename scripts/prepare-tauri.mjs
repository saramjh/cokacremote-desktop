import {mkdirSync,copyFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
const resource='src-tauri/resources';
for(const file of ['platform/mac/status.mjs','platform/mac/operate.mjs','platform/mac/supervisor.mjs','core/reconcile.mjs','bootstrap/macos.sh']){
 const dst=join(resource,file);
 mkdirSync(dirname(dst),{recursive:true});
 copyFileSync(file,dst);
}
copyFileSync('core/reconcile.mjs','ui/reconcile.mjs');
console.log('Tauri resource snapshot prepared');
