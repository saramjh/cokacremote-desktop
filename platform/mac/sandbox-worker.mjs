// Native Mac isolated-lifecycle fixture: real upstream MCP server, LOCAL fake tunnel.
// No launchd, no Cloudflare connection, no production state or port 3000.
import {spawn} from 'node:child_process';
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const [root,upstream,pText,qText]=process.argv.slice(2);
const port=Number(pText),tunnelPort=Number(qText);
if(!root||!upstream||!Number.isInteger(port)||!Number.isInteger(tunnelPort)||port===3000||tunnelPort===3000)throw Error('missing isolated sandbox configuration');
const base=`http://127.0.0.1:${tunnelPort}`;
const key=readFileSync(join(root,'approval-key'),'utf8').trim();
let shuttingDown=false;
const env={...process.env,MCP_HOST:'127.0.0.1',MCP_PORT:String(port),MCP_DEFAULT_CWD:root,MCP_DEFAULT_SHELL:'/bin/sh',MCP_AUTH_TOKEN:'',MCP_ALLOW_NO_AUTH:'false',MCP_OAUTH_ENABLED:'true',MCP_OAUTH_APPROVAL_KEY:key,MCP_PUBLIC_URL:base,MCP_ALLOWED_HOSTS:'127.0.0.1,localhost',MCP_TRUST_PROXY_HOPS:'0',MCP_OAUTH_ISSUER:base,MCP_OAUTH_RESOURCE:base+'/mcp',MCP_OAUTH_STATE_FILE:join(root,'oauth-test-state.json'),MCP_ENABLE_BROWSER_TOOLS:'false'};
const server=spawn(process.execPath,[join(upstream,'dist','src','server.js')],{cwd:root,env,stdio:'ignore'});
const proxy=spawn(process.execPath,[join(import.meta.dirname,'sandbox-proxy.mjs'),String(tunnelPort),String(port)],{cwd:root,env:{...process.env},stdio:'ignore'});
writeFileSync(join(root,'server.pid'),String(server.pid)+'\n',{mode:0o600});
writeFileSync(join(root,'tunnel.pid'),String(proxy.pid)+'\n',{mode:0o600});
function finish(){if(shuttingDown)return;shuttingDown=true;
 for(const child of [server,proxy]){if(child.exitCode===null)try{child.kill('SIGTERM')}catch{}}
 setTimeout(()=>process.exit(0),450).unref();
}
server.on('error',finish);proxy.on('error',finish);
server.on('exit',finish);proxy.on('exit',finish);
process.on('SIGTERM',finish);process.on('SIGINT',finish);
