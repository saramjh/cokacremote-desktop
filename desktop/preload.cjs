const{contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('mcpManager',Object.freeze({
 status:(remote=false)=>ipcRenderer.invoke('status',Boolean(remote)),
 operate:(action)=>ipcRenderer.invoke('operate',String(action)),
 copy:(type)=>ipcRenderer.invoke('copy',String(type)),
 reveal:()=>ipcRenderer.invoke('reveal-key'),
 openChatGPT:()=>ipcRenderer.invoke('open-chatgpt'),
 minimize:()=>ipcRenderer.invoke('window-minimize'),
 close:()=>ipcRenderer.invoke('window-close'),
 onProgress:(fn)=>{const listener=(_event,data)=>fn(data);ipcRenderer.on('operation-progress',listener);return()=>ipcRenderer.removeListener('operation-progress',listener);}
}));