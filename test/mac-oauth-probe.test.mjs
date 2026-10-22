import test from 'node:test';
import assert from 'node:assert/strict';
import {publicCheck} from '../platform/mac/status.mjs';

function mockFetch({issuer='https://example.trycloudflare.com/',resource='https://example.trycloudflare.com/mcp',allowAnonymous=false,metadataAvailable=true}={}){
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  const uri=String(url);
  if(uri.endsWith('/health'))return {ok:true,status:200,json:async()=>({status:'ok',service:'cokacremote',oauthEnabled:true})};
  if(uri.endsWith('/oauth-authorization-server')){
   if(!metadataAvailable)throw Error('timeout');
   return {ok:true,status:200,json:async()=>({issuer})};
  }
  if(uri.endsWith('/oauth-protected-resource/mcp')){
   if(!metadataAvailable)throw Error('timeout');
   return {ok:true,status:200,json:async()=>({resource})};
  }
  if(uri.endsWith('/mcp'))return {ok:allowAnonymous,status:allowAnonymous?200:401};
  throw Error('Unexpected URL '+uri);
 };
 return()=>{globalThis.fetch=original};
}
test('Mac OAuth probe accepts normalized trailing slash issuer like Windows',async()=>{
 const restore=mockFetch();
 try{
  const result=await publicCheck('https://example.trycloudflare.com');
  assert.equal(result.remoteHealth,'HEALTHY');
  assert.equal(result.oauthState,'HEALTHY');
  assert.equal(result.authorizationState,'AUTH_REQUIRED');
  assert.equal(result.oauthAligned,true);
  assert.equal(result.anonymous401,true);
 }finally{restore()}
});
test('Mac metadata timeout is unverified, not a configuration mismatch',async()=>{
 const restore=mockFetch({metadataAvailable:false});
 try{
  const result=await publicCheck('https://example.trycloudflare.com');
  assert.equal(result.oauthState,'NOT_CHECKED');
  assert.equal(result.authorizationState,'AUTH_REQUIRED');
 }finally{restore()}
});
test('Mac genuine wrong issuer is clearly classified as mismatch',async()=>{
 const restore=mockFetch({issuer:'https://wrong.trycloudflare.com'});
 try{assert.equal((await publicCheck('https://example.trycloudflare.com')).oauthState,'MISMATCH')}
 finally{restore()}
});
test('Mac anonymous public MCP access can never count as OAuth protected',async()=>{
 const restore=mockFetch({allowAnonymous:true});
 try{
  const result=await publicCheck('https://example.trycloudflare.com');
  assert.equal(result.oauthState,'HEALTHY');
  assert.equal(result.authorizationState,'UNEXPECTED_200');
 }finally{restore()}
});
