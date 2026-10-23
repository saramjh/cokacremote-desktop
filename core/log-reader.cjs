'use strict';
// Read-only source allowlist, fixed 64 KiB tail and 180 rendered lines.
const fs=require('node:fs'),path=require('node:path');
const LOG_FILES=Object.freeze({server:'cokacremote.log',tunnel:'cloudflared.log',manager:'manager-worker.log'});
function scrub(value,secret=''){
 let text=String(value);
 if(secret&&secret.length>=16)text=text.split(secret).join('[REDACTED KEY]');
 return text
  .replace(/https:\/\/[a-z0-9-]+\.trycloudflare\.com(?:\/[^\s"'<>]*)?/ig,'[REDACTED TUNNEL URL]')
  .replace(/(bearer\s+)[a-z0-9._~+/-]+=*/ig,'$1[REDACTED]')
  .replace(/((?:access_token|refresh_token|client_secret|id_token|oauth[-_ ]?approval[-_ ]?key|authorization|cookie)\s*[:=]\s*["']?)[^\s&"',;}]+/ig,'$1[REDACTED]');
}
function snapshot(source,base=path.join(require('node:os').homedir(),'.cokacremote'),platform=process.platform){
 if(!Object.hasOwn(LOG_FILES,source))throw new Error('Unknown log source');
 const filename=source==='manager'&&platform==='win32'?'supervisor.log':LOG_FILES[source];
 const file=path.join(base,filename);
 let meta;
 try{meta=fs.lstatSync(file)}catch(e){if(e.code==='ENOENT')return {source,available:false,text:'',truncated:false,lineCount:0};throw Error('Unable to inspect log file')}
 if(!meta.isFile()||meta.isSymbolicLink())throw Error('Log path is not a regular file');
 const byteLimit=65536,lineLimit=180;
 const count=Math.min(meta.size,byteLimit),buffer=Buffer.alloc(count),fd=fs.openSync(file,'r');
 try{fs.readSync(fd,buffer,0,count,Math.max(0,meta.size-count))}
 finally{fs.closeSync(fd)}
 const lines=buffer.toString('utf8').split(/\r?\n/);
 if(meta.size>byteLimit)lines.shift();
 if(lines.at(-1)==='')lines.pop();
 const limited=lines.slice(-lineLimit);
 let secret='';try{secret=fs.readFileSync(path.join(base,'oauth-approval-key'),'utf8').trim()}catch{}
 return {source,available:true,text:scrub(limited.join('\n'),secret),truncated:meta.size>byteLimit||lines.length>lineLimit,lineCount:limited.length};
}
module.exports={snapshot,scrub,LOG_FILES};
