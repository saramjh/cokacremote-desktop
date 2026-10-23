import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('connection remains default with independent on-demand Logs tab',()=>{
 const html=read('ui/index.html');
 assert.ok(html.includes('id="viewOverview" aria-controls="overviewPanel" aria-selected="true"'));
 assert.ok(html.includes('id="logsPanel" class="logs-panel" role="tabpanel" aria-labelledby="viewLogs" hidden'));
 for(const source of ['server','tunnel','manager'])assert.ok(html.includes('data-source="'+source+'"'));
 assert.ok(html.includes('id="logFollow"')&&html.includes('id="logRefresh"')&&html.includes('id="logFilter"'));
 assert.ok(html.includes('type="module" src="./app.js"'));
});
test('Tauri and Electron expose only allowlisted log snapshot IPC',()=>{
 assert.ok(read('ui/tauri-runtime.mjs').includes("invoke('manager_logs'"));
 assert.ok(read('desktop/preload.cjs').includes("invoke('logs:snapshot'"));
 assert.ok(read('desktop/main.cjs').includes("ipcMain.handle('logs:snapshot'"));
 assert.ok(read('src-tauri/src/lib.rs').includes('async fn manager_logs('));
 const src=read('ui/log-viewer.mjs');
 assert.ok(src.includes("if(!active||loading||document.hidden)return"));
 assert.ok(src.includes('clearInterval(timer)'));
 assert.ok(src.includes('consoleEl.textContent='));
 assert.ok(!src.includes('innerHTML'));
});
