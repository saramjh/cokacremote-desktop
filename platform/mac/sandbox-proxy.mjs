// Local-only stand-in for cloudflared's forwarding, never exposes a public endpoint.
import http from 'node:http';
const [listenText,targetText]=process.argv.slice(2);
const listenPort=Number(listenText),targetPort=Number(targetText);
if(![listenPort,targetPort].every(n=>Number.isInteger(n)&&n>=1024&&n<=65535)||listenPort===targetPort)throw Error('invalid sandbox ports');
const server=http.createServer((incoming,outgoing)=>{
 const req=http.request({hostname:'127.0.0.1',port:targetPort,path:incoming.url,method:incoming.method,headers:{...incoming.headers,host:`127.0.0.1:${targetPort}`}},res=>{
  outgoing.writeHead(res.statusCode||502,res.headers);res.pipe(outgoing);
 });
 req.on('error',()=>{if(!outgoing.headersSent)outgoing.writeHead(502);outgoing.end()});
 incoming.pipe(req);
});
server.listen(listenPort,'127.0.0.1');
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
