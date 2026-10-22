'use strict';
const el=id=>document.getElementById(id);
const systemName=window.mcpManager.platform==='darwin'?'macOS':'Windows';
el('hostLabel').textContent=systemName+' host';
el('hostContext').textContent=systemName+' / Remote MCP';
const texts={
 REUSE_BOTH:['연결 유지가 가장 안전합니다.','서버와 터널이 정상입니다. 주소와 프로세스를 변경하지 않습니다.','현재 연결 유지','stable'],
 ADOPT_EXISTING:['실행 환경만 복구하면 됩니다.','동작 중인 구성요소를 그대로 인수합니다. Quick Tunnel을 재발급하지 않습니다.','기존 프로세스 인수','stable'],
 RECOVER_SERVER_ONLY:['MCP 서버만 복구해야 합니다.','공개 터널은 유지하고 인증서버만 기존 URL로 재실행합니다.','MCP 서버 복구','warn'],
 RECOVER_TUNNEL_ONLY:['터널만 복구해야 합니다.','기존 MCP 서버를 유지한 채 확인된 터널만 복구합니다.','터널 복구','warn'],
 RECOVER_TUNNEL_REBIND_SERVER:['공개 주소 변경이 필요합니다.','터널을 복구한 뒤 MCP 서버의 OAuth 발급자를 새 주소로 맞춰야 합니다.','터널·OAuth 복구','warn'],
 START_BOTH:['서비스를 시작할 준비가 됐습니다.','기존 프로세스가 확인되지 않아 서버와 터널을 시작할 수 있습니다.','서비스 시작','warn'],
 WAIT_AND_RECHECK:['상태를 재확인하고 있습니다.','정상 프로세스를 보호하기 위해 불확실한 구간에서는 재시작하지 않습니다.','다시 확인','warn'],
 BLOCK_UNVERIFIED_OWNER:['프로세스 소유권 확인이 필요합니다.','다른 프로세스일 가능성이 있습니다. 자동 종료나 재기동을 차단합니다.','차단 원인 확인','block']
};
let latest=null,loading=false,busy=false,revealedTimer,autoTimer,lastAction='idle',lastRemote=false;
function fmtDate(value){if(!value)return '—';const d=new Date(value);return isNaN(d)?'—':d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function setDot(name,healthy){const d=el(name);d.className='svc-indicator '+(healthy?'healthy':'unhealthy')}
function setTopology(name,value,healthy){
 const node=el(name);node.textContent=value;node.className='top-status '+(healthy?'healthy':'offline');
}
function note(text,warning=false){const n=el('notice');n.textContent=text;n.className='notice-bar'+(warning?' warning':'')}
function heartbeat(text,healthy){el('heartbeat').innerHTML='<span class="pulse"></span>'+text;el('heartbeat').style.color=healthy?'#b6d8cc':'#e9b28a'}
function hideKey(){
 clearTimeout(revealedTimer);const input=el('approvalKey');input.type='password';input.value='관리자 승인 시에만 표시';
}
function apply(data){
 latest=data;
 const d=data.decision||{};const t=texts[d.operation]||texts.WAIT_AND_RECHECK;
 el('headline').textContent=t[0];
 el('subline').textContent=t[1];
 el('decisionTitle').textContent=d.operation==='REUSE_BOTH'?'재연결이 필요하지 않습니다':t[0];
 el('decisionText').textContent=t[1];
 el('decisionCode').textContent=d.operation||'ASSESSING';
 el('operationBanner').className='operation-banner '+(t[3]==='stable'?'':t[3]);
 el('lastChecked').textContent='마지막 점검 '+fmtDate(data.checkedAt);
 const mcp=data.local==='HEALTHY'&&data.serverOwned===true;
 const tunnel=data.public==='HEALTHY'&&data.tunnelOwned===true;
 const auth=data.oauth==='HEALTHY'&&data.authorization==='AUTH_REQUIRED';
 setDot('serverDot',mcp);setDot('tunnelDot',tunnel);setDot('authDot',auth);
 setTopology('mapServerState',mcp?'ACTIVE':data.serverAlive?'REVIEW':'OFFLINE',mcp);
 setTopology('mapTunnelState',tunnel?'ACTIVE':data.tunnelAlive?'REVIEW':'OFFLINE',tunnel);
 setTopology('mapOAuthState',auth?'SECURE':'REVIEW',auth);
 el('serverValue').textContent=mcp?'정상 실행':data.serverAlive?'확인 필요':'미실행';
 el('serverPid').textContent='PID '+(data.serverPid||'—');
 el('tunnelValue').textContent=tunnel?'공개 연결 정상':data.tunnelAlive?'터널 실행 중':'연결 불가';
 el('tunnelPid').textContent='PID '+(data.tunnelPid||'—');
 el('authValue').textContent=auth?'인증 검사 통과':data.oauth==='NOT_CHECKED'?'검증 대기':'인증 확인 필요';
 el('authSub').textContent=data.authorization==='AUTH_REQUIRED'?'401 / 익명 요청 거부':data.authorization||'검증 미완료';
 el('endpoint').value=data.urlValid&&data.endpoint?data.endpoint:'활성화된 공개 주소가 없습니다';
 el('copyUrl').disabled=!data.urlValid;
 el('copyKey').disabled=!data.approvalKeyAvailable;
 el('revealKey').disabled=!data.approvalKeyAvailable;
 el('repair').disabled=busy||d.operation==='BLOCK_UNVERIFIED_OWNER';
 el('repair').textContent=t[2];
 el('actionNote').textContent=d.requiresChatGPTReconnect?'주소 변경 감지 — ChatGPT MCP 연결을 재검증하세요.':
  (d.operation==='REUSE_BOTH'?'복구 작업 없이 기존 연결을 유지합니다.':'기존 자동화 스크립트가 상태 판단에 따라 수행합니다.');
 heartbeat(d.effectiveReady?'전체 운영 정상':data.local==='HEALTHY'?'일부 서비스 확인 중':'운영 상태 점검',Boolean(d.effectiveReady));
 if(d.requiresChatGPTReconnect)note('Cloudflare 주소가 변경됐습니다. ChatGPT의 MCP 연결을 확인하고 필요 시 새 주소로 등록하세요.',true);
}
async function refresh(remote=false){
 if(loading)return;
 loading=true;el('verify').disabled=true;
 try{
  const data=await window.mcpManager.status(remote);
  apply(data);
  if(remote){note(data.ready?'로컬·공개 주소·OAuth 상태 검증 완료. ChatGPT 앱 내 등록 여부는 별도 확인이 필요합니다.':'공개 상태 검증이 완료되지 않았습니다. 장애 구간을 확인하세요.',!data.ready)}
 }catch(e){
  heartbeat('상태 확인 실패',false);
  note('상태 수집 중 오류: '+String(e.message||e).slice(0,180),true);
 }finally{loading=false;el('verify').disabled=false}
}
async function operate(name){
 if(busy)return;
 if(name==='restart'&&!confirm('서버와 터널을 강제로 재시작합니다. Quick Tunnel 주소가 바뀌어 ChatGPT MCP 연결을 다시 등록해야 할 수 있습니다. 계속하시겠습니까?'))return;
 if(name==='stop'&&!confirm('원격 MCP 서비스를 중지합니다. 연결된 작업이 중단될 수 있습니다. 계속하시겠습니까?'))return;
 busy=true;for(const id of ['repair','restart','stop','verify'])el(id).disabled=true;
 note('기존 자동화 스크립트를 실행 중입니다. 결과를 확인합니다.');
 try{
  const result=await window.mcpManager.operate(name==='repair'?'setup':name);
  if(result.result==='REUSED_EXISTING'){note('정상 서비스와 터널을 그대로 재사용했습니다. PID와 URL이 유지됩니다.');}
  else if(result.result==='NO_MUTATION'){note('자동 변경 보류: '+result.reason,true)}
  else note('기존 운영 스크립트 실행 완료. 현재 상태를 다시 확인합니다.');
 }catch(e){note(String(e.message||e),true)}
 finally{busy=false;for(const id of ['repair','restart','stop','verify'])el(id).disabled=false;await refresh(true)}
}
async function copy(type){
 try{await window.mcpManager.copy(type);
  note(type==='url'?'MCP 주소를 복사했습니다. ChatGPT 연결 설정에 사용하세요.':'승인 키를 클립보드에 복사했습니다. OAuth 승인 화면에만 입력하세요.',type==='key')
 }catch(e){note(String(e.message||e),true)}
}
el('repair').addEventListener('click',()=>{const d=latest?.decision;if(d?.operation==='WAIT_AND_RECHECK')refresh(true);else operate('repair')});
el('verify').addEventListener('click',()=>refresh(true));
el('restart').addEventListener('click',()=>operate('restart'));
el('stop').addEventListener('click',()=>operate('stop'));
el('copyUrl').addEventListener('click',()=>copy('url'));
el('copyKey').addEventListener('click',()=>copy('key'));
el('revealKey').addEventListener('click',async()=>{
 try{const value=await window.mcpManager.reveal();const input=el('approvalKey');input.type='text';input.value=value;clearTimeout(revealedTimer);revealedTimer=setTimeout(hideKey,15000);note('승인 키가 15초간 표시됩니다. 화면 공유에 주의하세요.',true)}
 catch(e){note(String(e.message||e),true)}
});
el('openChat').addEventListener('click',()=>window.mcpManager.openChatGPT());
el('minimize').addEventListener('click',()=>window.mcpManager.minimize());
el('close').addEventListener('click',()=>window.mcpManager.close());
window.mcpManager.onProgress(data=>{
 if(data.phase==='error')note('기존 자동화 작업 실패: '+(data.message||'로그 확인 필요'),true);
 if(data.phase==='started')note('기존 Windows 관리 스크립트 실행 중입니다.');
 if(data.phase==='complete')note('운영 구성요소 확인이 완료됐습니다.');
});
window.addEventListener('blur',hideKey);
refresh(true);
autoTimer=setInterval(()=>{if(!busy&&!loading)refresh(true)},45000);
