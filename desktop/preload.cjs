const{contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('mcpManager',Object.freeze({
 platform:process.platform,
 language:()=>ipcRenderer.invoke('language:get'),
 setLanguage:(code)=>ipcRenderer.invoke('language:set',String(code)),
 status:(remote=false)=>ipcRenderer.invoke('status',Boolean(remote)),
 logs:(source)=>ipcRenderer.invoke('logs:snapshot',String(source)),
 inspectDependencies:()=>ipcRenderer.invoke('dependencies:inspect'),
 installDependencies:(approved,consent=false)=>ipcRenderer.invoke('dependencies:install',approved,consent===true),
 operate:(action)=>ipcRenderer.invoke('operate',String(action)),
 copy:(type)=>ipcRenderer.invoke('copy',String(type)),
 reveal:()=>ipcRenderer.invoke('reveal-key'),
 openChatGPT:()=>ipcRenderer.invoke('open-chatgpt'),
 minimize:()=>ipcRenderer.invoke('window-minimize'),
 close:()=>ipcRenderer.invoke('window-close'),
 onProgress:(fn)=>{const listener=(_event,data)=>fn(data);ipcRenderer.on('operation-progress',listener);return()=>ipcRenderer.removeListener('operation-progress',listener);}
}));