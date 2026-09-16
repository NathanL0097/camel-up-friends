/* Presentation-only audio. Synthesized buffers are original, tiny and offline-safe.
 * Replace a cue's buffer factory in CUES to add recorded assets; rules never import this module. */
(() => {
  'use strict';
  const CUES = Object.freeze({
    click: {level:1,notes:[420],length:.055,noise:.2},
    selection: {level:1,notes:[520,660],length:.1},
    invalid: {level:1,notes:[160,125],length:.18},
    dice: {level:2,notes:[145,220,170,300],length:.42,noise:.8},
    card: {level:2,notes:[420],length:.16,noise:.85},
    token: {level:2,notes:[180,110],length:.16,noise:.25},
    movement: {level:2,notes:[150,190,230],length:.3,noise:.25},
    landingGear: {level:2,notes:[72,60,48],length:.7,noise:.38},
    flaps: {level:2,notes:[175,235,320],length:.7,noise:.12},
    brakes: {level:2,notes:[120,95,78],length:.48,noise:.65},
    traffic: {level:2,notes:[680,920],length:.22},
    money: {level:2,notes:[880,1175,1480],length:.4},
    turn: {level:2,notes:[392,523],length:.28},
    countdown: {level:2,notes:[560],length:.07},
    phase: {level:2,notes:[262,392,523],length:.48},
    attack: {level:3,notes:[100,65],length:.35,noise:.65},
    reveal: {level:3,notes:[220,330,440],length:.7},
    major: {level:3,notes:[147,220,330,440],length:1.05},
    victory: {level:4,notes:[262,330,392,523,659],length:1.5},
    defeat: {level:4,notes:[262,233,196,131],length:1.25}
  });
  let muted=true,volume=.4,context,master,unlocked=false,priorityUntil=0;
  const buffers=new Map(),seen=new Map(),voices=new Set();
  try { muted=localStorage.getItem('tabletop.audio.enabled')!=='true'; const saved=localStorage.getItem('tabletop.audio.volume'); if(saved!==null)volume=Math.max(0,Math.min(1,Number(saved)||0)); } catch {}
  const audible=()=>unlocked&&!muted&&volume>0&&!document.hidden&&document.hasFocus();
  function bufferFor(name) {
    if(buffers.has(name))return buffers.get(name);
    const cue=CUES[name],rate=context.sampleRate,buffer=context.createBuffer(1,Math.ceil(rate*cue.length),rate),data=buffer.getChannelData(0);
    let seed=173; // Stable original timbre; no downloads and no gameplay RNG.
    for(let i=0;i<data.length;i++) {
      const t=i/rate,part=Math.min(cue.notes.length-1,Math.floor(t/cue.length*cue.notes.length));
      const local=t%(cue.length/cue.notes.length),env=Math.min(1,local/.006)*Math.exp(-local*18)*(1-t/cue.length);
      seed=(seed*16807)%2147483647;
      data[i]=.3*env*(Math.sin(2*Math.PI*cue.notes[part]*t)*(1-(cue.noise||0))+(seed/1073741823.5-1)*(cue.noise||0));
    }
    buffers.set(name,buffer); return buffer;
  }
  async function unlock() {
    try {
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return;
      if(!context){context=new Audio();master=context.createGain();master.gain.value=muted?0:volume;master.connect(context.destination);}
      if(context.state!=='running')await context.resume();
      unlocked=context.state==='running';
      // Prewarm only the three micro cues after the user's gesture; gameplay buffers are lazy.
      ['click','selection','invalid'].forEach(bufferFor);
    } catch { unlocked=false; }
  }
  function stop() { for(const source of voices){try{source.stop();}catch{}} voices.clear(); }
  function play(name,{key,cooldown=100,level}={}) {
    if(!CUES[name]||!audible())return false;
    const now=Date.now(),id=key||`cue:${name}`;
    if(seen.has(id)&&(key||now-seen.get(id)<cooldown))return false;
    seen.set(id,now); if(seen.size>256)seen.delete(seen.keys().next().value);
    const priority=level||CUES[name].level;
    if(priority<3&&(now<priorityUntil||voices.size>=4))return false;
    if(priority>=3){stop();priorityUntil=now+CUES[name].length*1000;}
    try {
      const source=context.createBufferSource();source.buffer=bufferFor(name);source.connect(master);voices.add(source);
      source.onended=()=>{voices.delete(source);source.disconnect();};source.start();return true;
    } catch{return false;}
  }
  function update(next={}) {
    if(typeof next.muted==='boolean')muted=next.muted;
    if(Number.isFinite(next.volume))volume=Math.max(0,Math.min(1,next.volume));
    if(master)master.gain.setTargetAtTime(muted?0:volume,context.currentTime,.025);
    if(muted)stop();
    try{localStorage.setItem('tabletop.audio.enabled',String(!muted));localStorage.setItem('tabletop.audio.volume',String(volume));}catch{}
    document.dispatchEvent(new CustomEvent('tabletop:audio',{detail:{muted,volume}}));syncControls();
  }
  function syncControls() {
    const b=document.getElementById('soundToggle'),m=document.getElementById('soundMute'),v=document.getElementById('soundVolume');
    if(b){b.textContent=muted?'音效：关':'音效：开';b.setAttribute('aria-pressed',String(!muted));}
    if(m)m.checked=muted;if(v)v.value=Math.round(volume*100);
  }
  window.TableAudio=Object.freeze({play,unlock,update,stop,get muted(){return muted;},get volume(){return volume;},get audible(){return audible();}});
  document.addEventListener('pointerdown',unlock,{passive:true});
  document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')unlock();});
  document.addEventListener('click',event=>{const button=event.target.closest('button');if(button&&!button.disabled&&!button.closest('#soundControls'))play('click',{cooldown:120});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('blur',stop);
  window.addEventListener('storage',event=>{if(event.key==='tabletop.audio.enabled'){muted=event.newValue!=='true';if(muted)stop();}if(event.key==='tabletop.audio.volume')volume=Math.max(0,Math.min(1,Number(event.newValue)||0));if(master)master.gain.value=muted?0:volume;syncControls();});
  document.getElementById('soundToggle').onclick=async()=>{await unlock();update({muted:!muted});play('selection');};
  document.getElementById('soundSettings').onclick=()=>document.getElementById('soundDialog').showModal();
  document.getElementById('soundClose').onclick=()=>document.getElementById('soundDialog').close();
  document.getElementById('soundMute').onchange=event=>update({muted:event.target.checked});
  document.getElementById('soundVolume').oninput=event=>update({volume:Number(event.target.value)/100});
  document.getElementById('soundPreview').onclick=async()=>{await unlock();play('reveal');};
  syncControls();
})();
