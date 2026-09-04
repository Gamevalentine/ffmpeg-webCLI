(()=>{
const boot=()=>{
  const A=window.Studio;if(!A)return setTimeout(boot,40);const {S,v,$,$$,msg}=A;
  v.addEventListener('loadedmetadata',()=>setTimeout(()=>{S.w=v.videoWidth||S.w;S.h=v.videoHeight||S.h;S.clips.filter(c=>c.track==='V1').forEach(c=>{c.srcStart??=c.start;c.srcEnd??=c.end})},0));

  // Inspector tabs now navigate to the real control groups instead of being decorative.
  const tabs=$$('.tabs button'),secs=$$('.insbody .sec'),map=[0,2,3];tabs.forEach((b,i)=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');secs[map[i]]?.scrollIntoView({block:'start',behavior:'smooth'})});

  // The third timeline tool now has a real action: jump playhead to the start.
  const tlBtns=$$('.tlbar button');if(tlBtns[2]){tlBtns[2].title='Go to start';tlBtns[2].onclick=()=>{v.currentTime=0;v.pause();msg('Playhead moved to start')}}

  // Keep source ranges separate from timeline positions so moving a clip does not change which source frames it contains.
  let gesture=null;$('#tracks').addEventListener('pointerdown',e=>{const el=e.target.closest('.clip');if(!el)return;const track=el.parentElement.id,name=el.querySelector('.cname')?.textContent,c=S.clips.find(x=>x.track===track&&x.name===name);if(!c)return;gesture={c,start:c.start,end:c.end,srcStart:c.srcStart??c.start,srcEnd:c.srcEnd??c.end,side:e.target.classList.contains('l')?'l':e.target.classList.contains('r')?'r':null}},true);
  addEventListener('pointerup',()=>{if(!gesture)return;const g=gesture,c=g.c;if(g.side==='l')c.srcStart=Math.max(0,g.srcStart+(c.start-g.start));else if(g.side==='r')c.srcEnd=Math.max(c.srcStart??g.srcStart+.05,g.srcEnd+(c.end-g.end));else{c.srcStart=g.srcStart;c.srcEnd=g.srcEnd}gesture=null},true);

  // Split keeps both the timeline cut and the exact source-frame cut.
  $('#split').onclick=()=>{if(!S.file)return;const t=v.currentTime,c=S.clips.find(q=>q.id===S.sel&&q.track==='V1')||S.clips.find(q=>q.track==='V1');if(!c||t<=c.start+.05||t>=c.end-.05)return msg('Move playhead inside a clip');const ss=c.srcStart??c.start,se=c.srcEnd??c.end,ratio=(t-c.start)/Math.max(.001,c.end-c.start),cut=ss+(se-ss)*ratio,oldEnd=c.end,n={...c,id:crypto.randomUUID(),start:t,end:oldEnd,srcStart:cut,srcEnd:se,name:c.name+' · 2'};c.end=t;c.srcEnd=cut;S.clips.push(n);S.sel=n.id;A.timeline();msg('Clip split')};

  // Extend delete cleanup for imported audio while preserving the existing delete behavior.
  const del=$('#del'),oldDel=del.onclick;del.onclick=()=>{const c=S.clips.find(x=>x.id===S.sel);oldDel?.();if(c?.audio){S.audioFile=null;if(S.audioUrl)URL.revokeObjectURL(S.audioUrl);S.audioUrl=null}if(c?.text&&!S.clips.some(x=>x.text&&!x.caption))$('#txt').hidden=true};
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();