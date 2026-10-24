// Bridge only; all privileged operations stay in the Tauri Rust backend.
import {decide} from './reconcile.mjs';

const t=window.__TAURI__;
if(!window.mcpManager && t?.core?.invoke){
 const invoke=(name,args={})=>t.core.invoke(name,args);
 const platform=/Macintosh|Mac OS X/i.test(navigator.userAgent)?'darwin':'win32';
 window.mcpManager=Object.freeze({
  platform,
  status:async(remote=false)=>{
    const result=await invoke('manager_status',{remote: Boolean(remote)});
    return {...result,decision:decide(result)};
  },
  operate:(name)=>invoke('manager_operate',{action:String(name)}),
  logs:(source)=>invoke('manager_logs',{source:String(source)}),
  installDependencies:(approvedMissing)=>invoke('manager_install_dependencies',{consent:true,approvedMissing}),
  copy:(type)=>invoke('manager_copy',{kind:String(type)}),
  reveal:()=>invoke('manager_reveal'),
  openChatGPT:()=>invoke('manager_open_chat'),
  minimize:()=>invoke('manager_minimize'),
  close:()=>invoke('manager_close'),
  language:()=>invoke('manager_language'),
  setLanguage:(code)=>invoke('manager_set_language',{code:String(code)}),
  onProgress:()=>()=>{}
 });
}
