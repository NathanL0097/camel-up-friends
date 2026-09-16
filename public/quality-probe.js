/* Opt-in local QA only. Measurements are displayed locally, never transmitted. */
(() => {
  if(!['localhost','127.0.0.1'].includes(location.hostname))return; // app.js only loads this file for the explicit query flag.
  const panel=document.createElement('aside');panel.id='qualityProbe';panel.setAttribute('aria-label','本地性能检查');
  panel.style.cssText='position:fixed;z-index:2000;bottom:4px;right:4px;max-width:320px;padding:8px;background:#101a19;color:#f4e9ce;border:1px solid #8a987b;font:11px/1.5 monospace;pointer-events:none';
  document.body.append(panel);
  let frame,previous,frames=[],longTasks=0,observer;
  function tick(time){if(!document.hidden&&previous!==undefined){frames.push(time-previous);if(frames.length>1800)frames.shift();}previous=document.hidden?undefined:time;frame=requestAnimationFrame(tick);}
  try{observer=new PerformanceObserver(list=>{longTasks+=list.getEntries().length;});observer.observe({type:'longtask',buffered:false});}catch{}
  frame=requestAnimationFrame(tick);
  const timer=setInterval(()=>{
    const times=frames.slice().sort((a,b)=>a-b),median=times[Math.floor(times.length*.5)]||0,p95=times[Math.floor(times.length*.95)]||0;
    const animations=document.getAnimations().filter(a=>a.playState==='running').length;
    panel.textContent=`LOCAL QA · ${innerWidth}×${innerHeight} · ${document.hidden?'后台（不计分）':'可见'}\nFPS中位 ${median?(1000/median).toFixed(1):'…'} · P95 ${p95.toFixed(1)}ms\nDOM ${document.querySelectorAll('*').length} · 动画 ${animations} · 长任务 ${longTasks}\n采样 ${times.length} 帧 · 非实体手机性能`;
    panel.style.whiteSpace='pre-line';
  },1000);
  addEventListener('pagehide',()=>{cancelAnimationFrame(frame);clearInterval(timer);observer?.disconnect();},{once:true});
})();
