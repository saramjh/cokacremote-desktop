import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const upstream=process.argv[2];
if(!upstream){throw Error('Usage: node patch-upstream-win32.mjs <upstream-path>')}
const file=resolve(upstream,'src','exec-tools.ts');
const text=readFileSync(file,'utf8');
const before='args: [login ? "-lc" : "-c", cmd],';
const after=[
  'args: process.platform === "win32" &&',
  '            /(?:^|[\\\\/])(?:powershell|pwsh)(?:\\.exe)?$/i.test(executable)',
  '            ? ["-NoProfile", "-NonInteractive", "-Command", cmd]',
  '            : [login ? "-lc" : "-c", cmd],'
].join('\n');
if(text.split(before).length!==2){throw Error('Pinned upstream exec-tools.ts drifted; refusing to apply Windows compatibility patch')}
writeFileSync(file,text.replace(before,after),'utf8');
console.log('Windows PowerShell command invocation compatibility patch applied');
