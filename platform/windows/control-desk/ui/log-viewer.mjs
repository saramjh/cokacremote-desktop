'use strict';
const SOURCES=['server','tunnel','manager'];
export function attachLogViewer({t,backend,onOverview=()=>{}}){
 const el=id=>document.getElementById(id);
 const overview=el('overviewPanel'),panel=el('logsPanel'),consoleEl=el('logConsole');
 const overviewTab=el('viewOverview'),logsTab=el('viewLogs');
 const sourceTabs=[...document.querySelectorAll('.log-source')];
 const filter=el('logFilter'),follow=el('logFollow'),refresh=el('logRefresh');
 let active=false,live=true,source='server',snapshot=null,timer=null,loading=false,epoch=0;
 function render(){
  if(!snapshot)return;
  const query=filter.value.trim().toLocaleLowerCase();
  let lines=snapshot.text?String(snapshot.text).split('\n'):[];
  if(query)lines=lines.filter(line=>line.toLocaleLowerCase().includes(query));
  const bottom=consoleEl.scrollHeight-consoleEl.scrollTop-consoleEl.clientHeight<60;
  consoleEl.textContent=!snapshot.available?t('logs.unavailable'):lines.length?lines.join('\n'):query?t('logs.noMatch'):t('logs.empty');
  if(live&&bottom)consoleEl.scrollTop=consoleEl.scrollHeight;
  el('logMeta').textContent=snapshot.available?t('logs.count',{count:lines.length})+(snapshot.truncated?' · '+t('logs.truncated'):''):'';
 }
 function translate(){
  filter.placeholder=t('logs.filterPlaceholder');
  consoleEl.setAttribute('aria-label',t('logs.consoleLabel'));
  follow.textContent=t(live?'logs.follow':'logs.paused');
  refresh.textContent=t('logs.refresh');
  if(!snapshot)consoleEl.textContent=t('logs.empty');
  render();
 }
 async function load(){
  if(!active||loading||document.hidden)return;
  const seq=epoch;loading=true;
  el('logsSummary').textContent=t('logs.loading');
  try{
   const next=await backend(source);
   if(!active||seq!==epoch)return;
   snapshot=next;
   render();
   el('logsSummary').textContent=t('logs.updated');
  }catch{
   if(seq!==epoch)return;
   consoleEl.textContent=t('logs.readFailed');
   el('logsSummary').textContent=t('logs.error');
  }finally{loading=false}
 }
 function stop(){if(timer){clearInterval(timer);timer=null}}
 function start(){stop();if(active&&live)timer=setInterval(()=>{if(!document.hidden)void load()},2500)}
 function open(target){
  active=target==='logs';
  overview.hidden=active;panel.hidden=!active;
  overviewTab.setAttribute('aria-selected',String(!active));
  logsTab.setAttribute('aria-selected',String(active));
  overviewTab.classList.toggle('active',!active);
  logsTab.classList.toggle('active',active);
  if(active){
   epoch++;snapshot=null;
   consoleEl.textContent=t('logs.loading');
   void load();start();
  }else{epoch++;stop();onOverview()}
 }
 overviewTab.addEventListener('click',()=>open('overview'));
 logsTab.addEventListener('click',()=>open('logs'));
 for(const tab of sourceTabs)tab.addEventListener('click',()=>{
  const selected=tab.dataset.source;
  if(!SOURCES.includes(selected)||selected===source)return;
  source=selected;epoch++;snapshot=null;
  for(const item of sourceTabs){
   const isCurrent=item.dataset.source===source;
   item.classList.toggle('active',isCurrent);
   item.setAttribute('aria-selected',String(isCurrent));
  }
  consoleEl.textContent=t('logs.loading');
  if(active)void load();
 });
 refresh.addEventListener('click',()=>void load());
 follow.addEventListener('click',()=>{
  live=!live;
  follow.classList.toggle('active',live);
  follow.setAttribute('aria-pressed',String(live));
  follow.textContent=t(live?'logs.follow':'logs.paused');
  start();if(live&&active)void load();
 });
 filter.addEventListener('input',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active&&live)void load()});
 for(const tabs of [[overviewTab,logsTab],sourceTabs]){
  for(let i=0;i<tabs.length;i++)tabs[i].addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();
   const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;
   tabs[n].focus();tabs[n].click();
  });
 }
 translate();
 return {translate,dispose:stop};
}
