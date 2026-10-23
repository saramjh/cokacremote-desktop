// Renderer sees a narrow, testable interface; privilege stays in the Tauri Rust host.
import {decide} from './reconcile.mjs';
import {bindTitlebarDrag} from './window-drag.mjs';
const api=window.__TAURI__;
if(!window.mcpManager && api?.core?.invoke){
 const invoke=(command,args={})=>api.core.invoke(command,args);
 window.mcpManager=Object.freeze({
  platform:'darwin',
  status:async(remote=false)=>{
   const result=await invoke('manager_status',{remote:Boolean(remote)});
   return {...result,decision:decide(result)};
  },
  operate:action=>invoke('manager_operate',{action:String(action)}),
  dependencies:()=>invoke('manager_dependencies'),
  logs:source=>invoke('manager_logs',{source:String(source)}),
  installDependency:(name,consent)=>invoke('manager_install_dependency',{name:String(name),consent:consent===true}),
  copy:kind=>invoke('manager_copy',{kind:String(kind)}),
  reveal:()=>invoke('manager_reveal'),
  openChatGPT:()=>invoke('manager_open_chat'),
  startDragging:()=>invoke('manager_start_dragging'),
  minimize:()=>invoke('manager_minimize'),
  close:()=>invoke('manager_close'),
  language:()=>invoke('manager_language'),
  setLanguage:code=>invoke('manager_set_language',{code:String(code)}),
  onProgress:()=>()=>{}
 });
 bindTitlebarDrag(document.querySelector('.chrome'), window.mcpManager.startDragging);
}
