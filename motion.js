const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage=document.querySelector('.signal-stage');
const track=document.getElementById('signalTrack');
const token=document.getElementById('signalToken');
const halo=document.getElementById('signalTokenHalo');
const caption=document.getElementById('stageCaption');
const replay=document.getElementById('replayMotion');
const chapters=[
  {start:0,text:'01 — Tools stay on your own computer.',active:'local'},
  {start:.35,text:'02 — OAuth secures the public connection.',active:'tunnel'},
  {start:.7,text:'03 — ChatGPT connects only after your approval.',active:'chat'}
];
let startTime=0,elapsed=0,raf=0,playing=false,hasStarted=false;
const duration=6600;
const total=track.getTotalLength();
function seek(fraction){
 const progress=Math.max(0,Math.min(1,fraction));
 const pos=track.getPointAtLength(total*progress);
 for(const node of [token,halo]){node.setAttribute('cx',pos.x.toFixed(2));node.setAttribute('cy',pos.y.toFixed(2));}
 const chapter=chapters[progress<.35?0:progress<.7?1:2];
 stage.dataset.active=chapter.active;
 caption.textContent=chapter.text;
}
function halt(){playing=false;cancelAnimationFrame(raf);}
function step(time){
 if(!playing)return;
 if(!startTime)startTime=time;
 elapsed=time-startTime;
 seek(elapsed/duration);
 if(elapsed<duration)raf=requestAnimationFrame(step);
 else {playing=false;replay.removeAttribute('aria-busy');}
}
function play(){
 halt();hasStarted=true;startTime=0;elapsed=0;seek(0);
 if(reduceMotion){seek(1);return;}
 playing=true;replay.setAttribute('aria-busy','true');raf=requestAnimationFrame(step);
}
replay.addEventListener('click',play);
if(reduceMotion){seek(1);caption.textContent='A local MCP server. An authenticated tunnel. Your ChatGPT approval.';}
else{
 seek(0);
 const observer=new IntersectionObserver((entries)=>{
  if(entries[0].isIntersecting&&!hasStarted){play();observer.disconnect();}
 },{threshold:.22});
 observer.observe(stage);
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&playing){cancelAnimationFrame(raf);playing=false;replay.removeAttribute('aria-busy');}
  else if(!document.hidden&&hasStarted&&elapsed<duration&&!playing){startTime=0;playing=true;raf=requestAnimationFrame(step);}
 });
}

const scenes={
 inspect:{
  eyebrow:'System assessment / 01',
  title:'Your existing tools come first.',
  description:'We inspect components before proposing any downloads.',
  rows:[['Node.js','Detected','ok'],['cloudflared','Detected','ok'],['cokacremote','Needs review','warn']],
  note:'This is an interactive product illustration; it does not scan your device.'
 },
 consent:{
  eyebrow:'Installation permission / 02',
  title:'Nothing installs without approval.',
  description:'Missing dependencies are offered individually, with source, reason and exact change.',
  rows:[['Node.js','Keep existing','ok'],['cloudflared','Keep existing','ok'],['cokacremote','Your approval required','warn']],
  note:'A real installation must verify publisher, package source and post-install health.'
 },
 connect:{
  eyebrow:'Account authorization / 03',
  title:'The final handshake stays yours.',
  description:'Copy the HTTPS endpoint into ChatGPT and complete the OAuth approval in your account.',
  rows:[['Local MCP','Healthy','ok'],['HTTPS tunnel','Verified','ok'],['ChatGPT registration','Manual account step','warn']],
  note:'This interface cannot attest to your ChatGPT account being connected.'
 }
};
const tabs=[...document.querySelectorAll('[data-scene]')];
const container=document.getElementById('panel-preview');
const title=document.getElementById('previewTitle');
const description=document.getElementById('previewDescription');
const eyebrow=document.getElementById('previewEyebrow');
const rows=document.getElementById('previewRows');
const note=document.getElementById('previewNote');
function setScene(scene,focus=false){
 const data=scenes[scene];
 if(!data)return;
 for(const tab of tabs){
  const active=tab.dataset.scene===scene;
  tab.classList.toggle('is-active',active);
  tab.setAttribute('aria-selected',String(active));
  tab.tabIndex=active?0:-1;
  if(active){container.setAttribute('aria-labelledby',tab.id);if(focus)tab.focus();}
 }
 eyebrow.textContent=data.eyebrow;
 title.textContent=data.title;
 description.textContent=data.description;
 rows.replaceChildren(...data.rows.map(([name,status,level])=>{
  const line=document.createElement('div');
  const dot=document.createElement('span');dot.className='mini-status'+(level==='warn'?' amber':'');
  const label=document.createTextNode(name);
  const small=document.createElement('small');small.textContent=status;
  line.append(dot,label,small);
  return line;
 }));
 note.textContent=data.note;
}
for(const tab of tabs){
 tab.addEventListener('click',()=>setScene(tab.dataset.scene));
 tab.addEventListener('keydown',(event)=>{
  if(!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(event.key))return;
  event.preventDefault();
  const index=tabs.indexOf(tab);
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:
    (index+(event.key==='ArrowRight'||event.key==='ArrowDown'?1:-1)+tabs.length)%tabs.length;
  setScene(tabs[next].dataset.scene,true);
 });
}
setScene('inspect');
document.documentElement.classList.add('enter-ready');
