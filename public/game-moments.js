/* Public presentation queue. Bounded, keyed per match, and never a source of rules actions. */
(() => {
  window.GameMoments = function({id,theme,select,art,onIdle}) {
    let match=null,last=0,timer=null,queue=[],dialog=null,active=false;
    const esc=text=>String(text||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function finish() { clearTimeout(timer);timer=null;if(dialog?.open)dialog.close();active=false;next();if(!active&&!queue.length)onIdle?.(); }
    function next() {
      if(active||!queue.length)return;
      const item=queue.shift();active=true;
      if(!dialog){dialog=document.createElement('dialog');dialog.id=id;dialog.className=`signature-stage signature-${theme}`;document.body.append(dialog);dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});}
      dialog.innerHTML=`<div class="signature-scene"><small>${esc(item.kicker)}</small><div class="signature-mark">${window.GameArt.icon(art(item))}</div><h2>${esc(item.title)}</h2><p>${esc(item.detail)}</p><button type="button">回到牌桌</button><span class="signature-dwell">阅读后自动回到牌桌</span></div>`;
      dialog.querySelector('button').onclick=finish;
      dialog.showModal();
      window.TableAudio?.play(item.sound||'major',{key:`${match}:${item.seq}`});
      timer=setTimeout(finish,Math.min(12000,Math.max(5500,1800+[...`${item.title}${item.detail}`].length*80)));
    }
    return {
      get busy() { return active || queue.length > 0; },
      update(key,events) {
        if(key!==match){clearTimeout(timer);if(dialog?.open)dialog.close();queue=[];active=false;match=key;last=events.at(-1)?.seq||0;return;}
        for(const event of events){if(event.seq<=last)continue;last=event.seq;const item=select(event);if(item)queue.push({...event,...item});}
        queue=queue.slice(-8);next();
      },
      clear(){clearTimeout(timer);queue=[];if(dialog?.open)dialog.close();dialog?.remove();dialog=null;active=false;match=null;last=0;}
    };
  };
})();
