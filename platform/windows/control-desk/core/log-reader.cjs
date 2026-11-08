'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const LOG_FILES=Object.freeze({server:'cokacremote.log',tunnel:'cloudflared.log',manager:'supervisor.log'});
function scrub(value,secret=''){
 let text=String(value);
 if(secret&&secret.length>=16)text=text.split(secret).join('[REDACTED KEY]');
 return text
  .replace(/https:\/\/[a-z0-9-]+\.trycloudflare\.com(?:\/[^\s"'<>]*)?/ig,'[REDACTED TUNNEL URL]')
  .replace(/(bearer\s+)[a-z0-9._~+/-]+=*/ig,'$1[REDACTED]')
  .replace(/((?:access_token|refresh_token|client_secret|id_token|oauth[-_ ]?approval[-_ ]?key|authorization|cookie)\s*[:=]\s*["']?)[^\s&"',;}]+/ig,'$1[REDACTED]');
}
function snapshot(source,base=path.join(process.env.LOCALAPPDATA||os.tmpdir(),'cokacremote','control-desk-state')){
 if(!Object.hasOwn(LOG_FILES,source))throw Error('Unknown log source');
 const file=path.join(base,LOG_FILES[source]);
 let stat;
 try{stat=fs.lstatSync(file)}
 catch(e){if(e.code==='ENOENT')return {source,available:false,text:'',truncated:false,lineCount:0};throw Error('Unable to read selected service log')}
 if(!stat.isFile()||stat.isSymbolicLink())throw Error('Log file is not regular');
 const byteLimit=65536,lineLimit=180,size=Math.min(stat.size,byteLimit),b=Buffer.alloc(size);
 const fd=fs.openSync(file,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW||0));
 try{fs.readSync(fd,b,0,size,Math.max(0,stat.size-size))}
 finally{fs.closeSync(fd)}
 const lines=b.toString('utf8').split(/\r?\n/);
 if(stat.size>byteLimit)lines.shift();
 if(lines.at(-1)==='')lines.pop();
 const displayed=lines.slice(-lineLimit);
 let secret='';
 try{secret=fs.readFileSync(path.join(base,'oauth-approval-key'),'utf8').trim()}catch{}
 return {source,available:true,text:scrub(displayed.join('\n'),secret),truncated:stat.size>byteLimit||lines.length>lineLimit,lineCount:displayed.length};
}
module.exports={snapshot,scrub,LOG_FILES};
