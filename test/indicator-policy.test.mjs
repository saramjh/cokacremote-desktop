import test from 'node:test';
import assert from 'node:assert/strict';
import {indicators,allVerified} from '../ui/indicator-policy.mjs';

const good=()=>({
 local:'HEALTHY',localHealth:'HEALTHY',serverAlive:true,serverOwned:true,
 public:'HEALTHY',remoteHealth:'HEALTHY',tunnelAlive:true,tunnelOwned:true,
 urlValid:true,oauth:'HEALTHY',oauthAligned:true,authorization:'AUTH_REQUIRED',anonymous401:true,
 task:'Ready',ready:false
});
test('all three indicators verified independent of launch agent / scheduled task running state',()=>{
 const status=indicators(good());
 assert.equal(status.server.level,'verified');
 assert.equal(status.tunnel.level,'verified');
 assert.equal(status.oauth.level,'verified');
 assert.equal(allVerified(status),true);
});
test('Mac probe without public OAuth evidence must be neutral rather than warning or false green',()=>{
 const s={...good(),oauth:'NOT_CHECKED',oauthAligned:false,authorization:'NOT_CHECKED',anonymous401:false};
 const p=indicators(s);
 assert.equal(p.oauth.level,'unverified');
 assert.equal(p.oauth.key,'status.authPending');
 assert.equal(allVerified(p),false);
});
test('real OAuth issuer/resource mismatch is attention, even if MCP server is otherwise healthy',()=>{
 const s={...good(),oauth:'MISMATCH',oauthAligned:false};
 const p=indicators(s);
 assert.equal(p.oauth.level,'attention');
 assert.equal(p.tunnel.level,'verified');
});
test('missing metadata response is not treated as malformed metadata',()=>{
 const s={...good(),oauth:'NOT_CHECKED',oauthAligned:false,authorization:'AUTH_REQUIRED',anonymous401:true};
 assert.equal(indicators(s).oauth.level,'unverified');
});
test('anonymous MCP endpoint accessible without OAuth is attention',()=>{
 const s={...good(),authorization:'UNEXPECTED_200',anonymous401:false};
 assert.equal(indicators(s).oauth.level,'attention');
});
test('foreign processes never get green status from a healthy HTTP response',()=>{
 const s={...good(),serverOwned:false,tunnelOwned:false};
 assert.equal(indicators(s).server.level,'blocked');
 assert.equal(indicators(s).tunnel.level,'blocked');
});
test('public check timeout while tunnel is present signals attention only on transport',()=>{
 const s={...good(),remoteHealth:'OFFLINE',public:'OFFLINE'};
 assert.equal(indicators(s).tunnel.level,'attention');
 assert.equal(indicators(s).oauth.level,'verified');
});
test('Windows and macOS OAuth evidence alias format produce the same assessment',()=>{
 const win={...good(),oauth:'HEALTHY',authorization:'AUTH_REQUIRED'};
 const mac={...good(),oauth:'HEALTHY',authorization:'AUTH_REQUIRED'};
 assert.deepEqual(indicators(win),indicators(mac));
});
