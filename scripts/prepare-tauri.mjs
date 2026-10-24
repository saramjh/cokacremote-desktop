import{mkdirSync,copyFileSync,writeFileSync}from'node:fs';
import{join}from'node:path';
const stage='src-tauri/resources';
for(const file of ['platform/mac/status.mjs','platform/mac/operate.mjs','platform/mac/supervisor.mjs','platform/mac/boot-worker.mjs','platform/mac/dependencies.mjs','platform/mac/install-deps.mjs','platform/mac/native-sandbox.mjs','platform/mac/sandbox-worker.mjs','platform/mac/sandbox-proxy.mjs','platform/mac/sandbox-cli.mjs','core/reconcile.mjs','core/mac-setup-controller.mjs','core/mac-agent-policy.mjs']){
  const target=join(stage,file);
  mkdirSync(target.substring(0,target.lastIndexOf('/')),{recursive:true});
  copyFileSync(file,target);
}
copyFileSync('core/reconcile.mjs','ui/reconcile.mjs');
// Candidate binaries from this self-hosted project are observation-only by default.
// Release promotion is a distinct, intentionally not-yet-enabled build operation.
writeFileSync(join(stage,'manager-build-mode.json'),JSON.stringify({mode:'release-candidate',reason:'explicit manual live-Mac user trial; side-by-side bundle'})+'\n');
console.log('TAURI_RESOURCE_SYNC_OK');
