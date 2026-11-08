'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(app,p),'utf8');
test('release UI boots the real Control Desk from the packaged resource path',()=>{
  const main=file('main.cjs');
  assert.match(main,/app\.isPackaged\s*\?\s*join\(process\.resourcesPath,'payload','deploy','windows'\)/);
  assert.match(main,/control-desk-state/);
  assert.match(main,/new BrowserWindow/);
  assert.match(main,/ui','index\.html'/);
});
test('service scripts derive app location and never rely on developer workspace',()=>{
  for(const rel of ['service/start-cokacremote.ps1','service/manual-control.ps1','service/gui/status.ps1','service/component-recovery.ps1']){
    const script=file(rel);
    assert.doesNotMatch(script,/(?:NodeSecurityRuntimes|Join-Path\s+\$HOME\s+'MCPWorkspace|C:\\Users\\saram)/);
  }
  assert.match(file('service/start-cokacremote.ps1'),/runtime\\bin\\node\.exe/);
  assert.match(file('service/start-cokacremote.ps1'),/control-desk-state/);
  assert.match(file('service/manual-control.ps1'),/function LegacyTask \{return \$null\}/);
});
test('packaging requires a self-contained runtime with NSIS',()=>{
  const config=file('electron-builder.yml');
  assert.match(config,/target:\s*nsis/);
  assert.match(config,/from: payload/);
  assert.match(config,/createDesktopShortcut: always/);
  assert.match(file('prepare.ps1'),/STANDALONE_PAYLOAD_READY/);
});
test('no login task or automatic tunnel activation in installer',()=>{
  const policy=file('service/request-disable-autostart.ps1');
  assert.match(policy,/no login task/);
  const main=file('main.cjs');
  assert.match(main,/allowed=new Set\(\['setup','restart','stop'\]\)/);
  assert.doesNotMatch(main,/Start-Process.*cloudflared/);
});
