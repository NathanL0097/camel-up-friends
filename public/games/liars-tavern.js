window.GameClientFactories=window.GameClientFactories||{};
window.GameClientFactories["liars-tavern"]=({socket,$,show,escapeHtml,getMyId,copyInvite})=>{
  let selected=[],lastRound=0,lastShotKey="",lastVerdictKey="",soundOn=true,audio=null;
  const act=(action,payload={})=>socket.emit("game:action",{action,payload});
  const rankName=rank=>rank==="A"?"A":rank==="K"?"K":rank==="Q"?"Q":rank==="JOKER"?"万能牌":"恶魔牌";
  const rankSymbol=rank=>rank==="JOKER"?"★":rank==="DEVIL"?"♆":rank;
  const faces=["🦊","🐺","🦉","🐗","🐍","🦝"];
  function rules(){
    $("rulesDialog").innerHTML=`<button id="closeRules" class="close-button">×</button><div class="liar-rules"><small>LIAR'S TAVERN</small><h2>😈 骗子酒馆</h2><ol><li>每轮随机指定A、K或Q作为桌面牌，每人获得5张私人手牌。</li><li>轮到你时盖着打出1–3张，并声称它们都是桌面牌；万能牌可以当作任何桌面牌。</li><li>最近一次盖牌后，除出牌者外的任意存活玩家都可以喊“骗子”。若出牌者说谎，出牌者开枪；若出牌者诚实，质疑者开枪。</li><li>如果不是当前行动位的玩家跨位质疑，质疑错误时要连续开两枪；质疑正确仍由说谎者开一枪。</li><li>恶魔牌只能单独打出。它被质疑时，除出牌者外仍有手牌的存活玩家都要依次接受左轮判定。</li><li>每人的六发弹仓中随机固定一颗实弹。空膛后危险越来越高，中弹即淘汰，最后存活者获胜。</li><li>如果有人出空手牌，当前行动位不能继续盖牌，但任意符合条件的玩家仍可发起质疑。</li></ol><p>每次行动限时30秒；超时会自动出一张牌，已有可质疑出牌时则由当前行动位自动质疑。</p></div>`;$("closeRules").onclick=()=>$("rulesDialog").close();
  }
  function renderLobby(){
    rules();
    $("gameLobbySettings").innerHTML=`<div class="liar-lobby"><span>😈</span><div><b>恶魔牌局已经开启</b><small>2–6人 · 每人5张牌 · 1颗实弹藏在6个弹仓中</small><p>恶魔牌只能单独打出；一旦被质疑，除出牌者外的所有人依次扣动扳机。</p></div></div>`;
  }
  function mount(){
    if($("liarsTavern"))return;
    $("gameMount").innerHTML=`<div id="liarsTavern"><div class="tavern-smoke"></div><header class="liar-head"><div><small>PRIVATE TABLE · ROOM <span id="liarCode"></span></small><h2>骗子酒馆 <em>恶魔牌局</em></h2></div><div id="liarRound"></div><div><button id="liarSound" class="ghost-button">🔊 音效</button><button id="liarRules" class="ghost-button">📖 规则</button><button id="liarInvite" class="ghost-button">邀请骗子</button></div></header><main id="tavernStage"><div class="lamp-cone"></div><section id="liarSeats"></section><section id="liarTableCenter"></section><aside id="liarLog"></aside><div id="rouletteOverlay"></div><div id="liarResult"></div></main><section id="liarHandDock"></section></div>`;
    $("liarRules").onclick=()=>$("rulesDialog").showModal();$("liarInvite").onclick=copyInvite;$("liarSound").onclick=()=>{soundOn=!soundOn;$("liarSound").textContent=soundOn?"🔊 音效":"🔇 静音";if(soundOn)tone(320,.08);};rules();
  }
  function tone(freq,duration=.1,delay=0,type="triangle",volume=.035){
    if(!soundOn)return;
    audio||=new(window.AudioContext||window.webkitAudioContext)();
    if(audio.state==="suspended")audio.resume();
    const start=audio.currentTime+delay,osc=audio.createOscillator(),gain=audio.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.01);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain).connect(audio.destination);osc.start(start);osc.stop(start+duration+.02);
  }
  function shotSound(bullet){tone(145,.12,.25,"sawtooth",.025);if(bullet){tone(68,.55,2.25,"sawtooth",.11);tone(42,.7,2.3,"square",.055)}else{tone(205,.08,2.18,"square",.04);tone(155,.06,2.3,"square",.025)}}
  function card(card,selectable=false,dealIndex=0){
    const chosen=selected.includes(card.uid),kind=card.rank.toLowerCase();
    return `<button class="liar-card rank-${kind} ${chosen?"selected":""} ${lastRound?"":"deal-card"}" style="--deal-index:${dealIndex}" data-card-id="${card.uid}" ${selectable?"":"disabled"}><span>${rankSymbol(card.rank)}</span><i>${card.rank==="DEVIL"?"😈":card.rank==="JOKER"?"🎭":"♠"}</i><b>${rankName(card.rank)}</b>${card.rank==="DEVIL"?'<small>只能单独打出</small>':card.rank==="JOKER"?'<small>可作为桌面牌</small>':""}</button>`;
  }
  function seatLayout(seats,myId){
    const mine=Math.max(0,seats.findIndex(seat=>seat.playerId===myId)),ordered=seats.map((_,index)=>seats[(mine+index)%seats.length]);
    const layouts={
      2:[[50,79],[50,22]],
      3:[[50,80],[18,38],[82,38]],
      4:[[50,81],[14,51],[50,20],[86,51]],
      5:[[50,82],[13,61],[24,25],[76,25],[87,61]],
      6:[[50,83],[12,64],[20,30],[50,18],[80,30],[88,64]]
    };
    return ordered.map((seat,index)=>({seat,index,x:layouts[ordered.length][index][0],y:layouts[ordered.length][index][1]}));
  }
  function renderSeats(room){
    const g=room.game,layout=seatLayout(g.seats,getMyId()),actor=g.seats[g.currentIndex]?.playerId;
    $("liarSeats").innerHTML=layout.map(({seat,index,x,y})=>`<article class="liar-seat ${seat.playerId===getMyId()?"mine":""} ${seat.playerId===actor&&g.phase==="play"?"acting":""} ${seat.alive?"":"dead"}" style="--seat-x:${x}%;--seat-y:${y}%"><div class="liar-avatar">${seat.alive?faces[room.players.findIndex(player=>player.id===seat.playerId)%faces.length]:"☠"}</div><div><b>${escapeHtml(seat.playerName)}${seat.playerId===getMyId()?"（你）":""}</b><small>${seat.alive?`${seat.handCount}张手牌 · ${seat.lastAction}`:"已经出局"}</small><span class="shot-track">${Array.from({length:6},(_,i)=>`<i class="${i<seat.shots?"spent":""}">${i<seat.shots?"×":"•"}</i>`).join("")}<em>${seat.shots}/6</em></span></div></article>`).join("");
  }
  function renderCenter(room){
    const g=room.game,previous=g.previousPlay,challenge=g.lastChallenge;
    const reveal=challenge?`<div class="challenge-reveal ${challenge.devil?"devil":challenge.truthful?"truth":"lie"}"><small>${challenge.devil?"恶魔牌":challenge.truthful?"没有说谎":"谎言揭穿"}</small><div>${challenge.cards.map((item,index)=>card({...item,uid:`reveal-${index}`})).join("")}</div></div>`:"";
    $("liarTableCenter").innerHTML=`<div class="table-rank"><small>本轮桌面牌</small><b>${rankSymbol(g.tableRank)}</b><span>所有出牌都声称是 ${rankName(g.tableRank)}</span></div><div class="covered-pile">${Array.from({length:Math.min(7,g.pileCount+(previous?.count||0))},(_,index)=>`<i style="--pile-index:${index}"></i>`).join("")}<b>${g.pileCount+(previous?.count||0)} 张</b></div><div class="last-claim ${g.mustChallenge?"forced":""}">${previous?`<small>${escapeHtml(g.seats.find(seat=>seat.playerId===previous.playerId)?.playerName||"上家")}声称</small><strong>${previous.count} 张 ${rankName(g.tableRank)}</strong><span>${g.mustChallenge?"手牌已空 · 必须质疑":"相信，还是揭穿？"}</span>`:"<small>等待第一位骗子出牌</small>"}</div>${reveal}`;
  }
  function renderHand(room,newRound){
    const g=room.game,you=g.you,legal=g.legal,seconds=g.deadline?Math.max(0,Math.ceil((g.deadline-Date.now())/1000)):0;
    selected=selected.filter(id=>you.hand.some(card=>card.uid===id));
    const challengeLabel=legal?.isCrossChallenge?"跨位质疑 · 错则两枪":"骗子！质疑他";
    const actionHint=legal?.mustChallenge?"上家已经出空手牌，你只能质疑":legal?.isCrossChallenge?"你可以抢先质疑，但错了要连续开两枪":legal?.canChallenge&&legal?.canPlay?"选择1–3张继续，或质疑上家":legal?.canChallenge?"现在也可以质疑最近一次出牌":legal?.canPlay?"选择1–3张牌盖下":"等待其他玩家行动…";
    $("liarHandDock").innerHTML=`<div class="hand-owner"><small>你的手牌</small><b>${escapeHtml(you.playerName)}</b><span>${you.alive?`左轮已扣动 ${you.shots}/6 次`:"你已经出局，只能旁观"}</span></div><div class="liar-hand ${newRound?"dealing":""}">${you.hand.map((item,index)=>card(item,Boolean(legal?.canPlay),index)).join("")||'<div class="empty-hand">手牌已空 · 等待质疑</div>'}</div><div class="liar-actions"><div class="liar-clock ${seconds<=7?"urgent":""}"><small>THINK</small><b>${seconds}</b><em>SEC</em></div><button id="playLiarCards" ${legal?.canPlay&&selected.length?"":"disabled"}>盖下 ${selected.length||""} 张</button><button id="callLiar" class="${legal?.mustChallenge?"forced":""} ${legal?.isCrossChallenge?"cross":""}" ${legal?.canChallenge?"":"disabled"}>${challengeLabel}</button><small>${actionHint}</small></div>`;
    document.querySelectorAll("[data-card-id]").forEach(button=>button.onclick=()=>{const id=button.dataset.cardId,item=you.hand.find(card=>card.uid===id);if(!item||!legal?.canPlay)return;if(selected.includes(id))selected=selected.filter(cardId=>cardId!==id);else if(item.rank==="DEVIL")selected=[id];else{selected=selected.filter(cardId=>you.hand.find(card=>card.uid===cardId)?.rank!=="DEVIL");if(selected.length<3)selected.push(id);}renderHand(room,false);});
    $("playLiarCards").onclick=()=>{if(!selected.length)return;act("play",{cardIds:selected});selected=[];};
    $("callLiar").onclick=()=>act("challenge");
  }
  function renderRoulette(room){
    const g=room.game,challenge=g.lastChallenge,current=g.roulette?.current;
    if(g.phase==="verdict"&&challenge){
      const key=`${g.round}-${challenge.challengerId}-${challenge.accusedId}`;
      if(key!==lastVerdictKey){lastVerdictKey=key;tone(challenge.truthful?155:520,.16,.12,"sawtooth",.06);tone(challenge.truthful?110:680,.22,.42,"triangle",.045);}
      const headline=challenge.devil?"恶魔降临！":challenge.truthful?"质疑错误！":"质疑正确！";
      const sentence=challenge.devil
        ? `${escapeHtml(challenge.accusedName)}打出了恶魔牌`
        : challenge.truthful
          ? `${escapeHtml(challenge.challengerName)}错怪了${escapeHtml(challenge.accusedName)}`
          : `${escapeHtml(challenge.challengerName)}抓住了${escapeHtml(challenge.accusedName)}的谎言`;
      const punishment=challenge.devil
        ? "除出牌者外，其他玩家依次接受左轮判定"
        : challenge.truthful
          ? `${escapeHtml(challenge.challengerName)}将${challenge.shotsOwed===2?"连续开 2 枪":"开 1 枪"}`
          : `${escapeHtml(challenge.accusedName)}将开 1 枪`;
      $("rouletteOverlay").innerHTML=`<div class="verdict-scene ${challenge.devil?"devil":challenge.truthful?"wrong":"correct"}"><div class="verdict-stamp"><small>CHALLENGE VERDICT</small><h2>${headline}</h2><p>${sentence}</p><strong>${punishment}</strong>${challenge.isCrossChallenge&&challenge.truthful?'<em>跨位质疑错误 · 双枪惩罚</em>':""}<div class="verdict-cards">${challenge.cards.map((item,index)=>card({...item,uid:`verdict-${index}`})).join("")}</div><span>左轮判定即将开始</span></div></div>`;
      return;
    }
    if(!current){$("rouletteOverlay").innerHTML="";return;}
    const target=g.seats.find(seat=>seat.playerId===current.playerId),key=`${g.roulette.id}-${current.playerId}-${current.shot}`;
    if(key!==lastShotKey){lastShotKey=key;shotSound(current.bullet);}
    const remaining=Math.max(1,7-current.shot);
    $("rouletteOverlay").innerHTML=`<div class="roulette-scene ${current.bullet?"live":"blank"}"><div class="roulette-curtain"></div><div class="roulette-target"><i>${current.bullet?"☠":faces[room.players.findIndex(player=>player.id===current.playerId)%faces.length]}</i><small>正在开枪</small><b>${escapeHtml(target?.playerName||"玩家")}</b><span>第 ${current.shot} 次扣动扳机 · 命中概率 1/${remaining}</span></div><div class="revolver"><div class="barrel"></div><div class="cylinder">${Array.from({length:6},(_,i)=>`<i class="${i===current.shot-1?"current":""}"></i>`).join("")}</div><div class="hammer"></div><div class="trigger"></div><div class="grip"></div><div class="muzzle-flash">砰！</div></div><div class="roulette-result"><small>${escapeHtml(target?.playerName||"玩家")}的左轮结果</small><b>${current.bullet?"实弹！":"咔哒——空膛"}</b><em>${current.bullet?"这张椅子永远空下来了":"命运暂时放过了他"}</em></div></div>`;
  }
  function renderResult(room){
    const g=room.game,winner=g.seats.find(seat=>seat.playerId===g.winnerId);
    $("liarResult").innerHTML=g.status==="finished"?`<div class="liar-result"><span>♛</span><small>LAST LIAR STANDING</small><h2>${escapeHtml(winner?.playerName||"无人")}活到最后</h2><p>酒馆只相信最后仍敢坐在牌桌前的人。</p>${room.hostId===getMyId()?'<button id="restartLiars">再开一桌</button>':"<em>等待房主重新开局…</em>"}</div>`:"";
    $("restartLiars")?.addEventListener("click",()=>socket.emit("game:restart"));
  }
  function renderGame(room){
    show("game");mount();const g=room.game,newRound=g.round!==lastRound;if(newRound){lastRound=g.round;selected=[];lastShotKey="";tone(420,.07);tone(290,.08,.09);}
    $("liarCode").textContent=room.code;$("liarRound").innerHTML=`<small>ROUND</small><b>${g.round}</b><span>${g.phase==="play"?"谎言阶段":g.phase==="verdict"?"质疑揭晓":g.phase==="roulette"?"命运判定":"本局结束"}</span>`;
    renderSeats(room);renderCenter(room);renderHand(room,newRound);renderRoulette(room);renderResult(room);$("liarLog").innerHTML=`<b>酒馆低语</b>${g.log.slice(0,6).map(item=>`<p>${escapeHtml(item)}</p>`).join("")}`;
  }
  setInterval(()=>{const el=document.querySelector(".liar-clock b"),deadline=window.__liarDeadline;if(el&&deadline)el.textContent=Math.max(0,Math.ceil((deadline-Date.now())/1000));},250);
  return{prepare:()=>null,renderLobby,render(room){window.__liarDeadline=room.game.deadline;renderGame(room);}};
};
