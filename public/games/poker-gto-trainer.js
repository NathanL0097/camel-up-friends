(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.PokerGTOTrainer=api;})(typeof window!=="undefined"?window:globalThis,function(){
  const SUITS={s:"♠",h:"♥",d:"♦",c:"♣"},STREETS={preflop:"翻牌前",flop:"翻牌",turn:"转牌",river:"河牌"};
  const ACTIONS={
    fold:"弃牌",check:"过牌",call:"跟注",limp:"跛入 1BB",open25:"开池 2.5BB",raise50:"加注 1/2池",
    raise67:"加注 2/3池",bet33:"下注 1/3池",bet50:"下注 1/2池",bet67:"下注 2/3池",
    bet100:"满池下注",allin:"ALL IN"
  };
  const BET_FRACTIONS={bet33:1/3,bet50:1/2,bet67:2/3,bet100:1};
  const node=(street,board,pot,stack,villain,options,concept)=>({street,board,pot,stack,villain,options,concept});
  const option=(action,freq,loss,reason)=>({action,freq,loss,reason});
  const LINES=[
    {id:"btn-ak",title:"顶对价值线",position:"BTN 对 BB",stage:"常规阶段",context:"60BB · 筹码EV · 无抽水",hand:["Ah","Kd"],nodes:[
      node("preflop",[],1.5,60,"前面全部弃牌，行动到你",[
        option("open25",100,0,"AKo属于按钮位纯开池范围。"),option("check",0,2.4,"按钮位不能过牌进入底池。"),option("allin",0,8.6,"60BB直接全下会让弱牌全部弃掉。")
      ],"开池范围"),
      node("flop",["As","7d","2c"],5.5,57.5,"大盲跟注后过牌",[
        option("bet33",68,0,"干燥A高牌面适合范围小注。"),option("check",32,.04,"顶对也可少量过牌保护过牌范围。"),option("bet67",0,.48,"大尺寸会使对手继续范围过强。"),option("bet100",0,1.1,"此牌面无需用满池制造极化。")
      ],"范围优势与小注"),
      node("turn",["As","7d","2c","9h"],9.1,55.7,"对手跟注翻牌，转牌再次过牌",[
        option("bet67",57,0,"安全转牌可用中大尺寸继续取值。"),option("check",43,.03,"保留部分顶对控制底池同样合理。"),option("bet33",0,.31,"小注给听牌与弱A过于便宜的价格。"),option("bet100",0,.42,"满池会把价值目标压缩得太窄。")
      ],"第二枪价值与控池"),
      node("river",["As","7d","2c","9h","2s"],21.3,49.6,"对手跟注转牌，河牌第三次过牌",[
        option("bet67",48,0,"多数Ax与部分口袋对仍可支付。"),option("bet100",22,.02,"极化大注可混合使用。"),option("check",30,.05,"摊牌有价值，过牌并非错误。"),option("allin",0,1.25,"超池全下会让可支付的次强牌大量弃牌。")
      ],"薄价值与极化")
    ]},
    {id:"bb-qjs",title:"大盲防守与顶对",position:"BB 对 BTN",stage:"常规阶段",context:"40BB · 筹码EV · 无抽水",hand:["Qh","Jh"],nodes:[
      node("preflop",[],4,37.5,"按钮位开池到 2.5BB",[
        option("call",69,0,"同花连张有良好可实现权益。"),option("raise50",23,.03,"适量3-bet可利用阻断与可玩性。"),option("fold",8,.18,"低频弃牌损失很小但不应成为常态。"),option("allin",0,6.9,"40BB全下严重过度。")
      ],"大盲混合防守"),
      node("flop",["Qs","8d","4c"],5.5,37.5,"你过牌，按钮位下注 1/3池",[
        option("call",78,0,"顶对强踢脚以跟注为主。"),option("raise50",17,.05,"少量加注保护并取值。"),option("fold",5,1.7,"顶对面对小注不能弃牌。"),option("allin",0,8.1,"过度加注只会被更强范围跟注。")
      ],"跟注范围保护"),
      node("turn",["Qs","8d","4c","2h"],9.1,35.7,"你过牌，按钮位下注 2/3池",[
        option("call",84,0,"空白转牌继续跟注保持其诈唬。"),option("raise67",9,.11,"低频保护性加注可接受。"),option("fold",7,1.05,"对手仍有足够半诈唬。"),option("allin",0,4.6,"一对牌不宜把深筹码全部投入。")
      ],"面对第二枪"),
      node("river",["Qs","8d","4c","2h","Ac"],21.3,29.6,"你过牌，按钮位下注满池",[
        option("fold",72,0,"A河牌改善了对手大量价值组合。"),option("call",28,.07,"阻断部分Qx价值时可保留少量抓诈。"),option("allin",0,5.4,"转成诈唬无法让其强价值弃牌。")
      ],"河牌抓诈阈值")
    ]},
    {id:"co-a5s",title:"同花A的4-bet与半诈唬",position:"CO 对 BTN",stage:"早期阶段",context:"60BB · 筹码EV · 无抽水",hand:["As","5s"],nodes:[
      node("preflop",[],10,52,"你开池2.5BB，按钮位3-bet到 8BB",[
        option("fold",46,0,"A5s可部分弃牌。"),option("call",19,.07,"有位置劣势但具备坚果潜力。"),option("raise50",35,.02,"A阻断使其成为经典混合4-bet诈唬。"),option("allin",0,5.8,"60BB直接推入并非合理4-bet尺寸。")
      ],"阻断牌与混合4-bet"),
      node("flop",["Ks","7s","2d"],18,51,"双方进入单加注假设线，对手过牌",[
        option("bet33",61,0,"坚果同花听牌可用小注施压。"),option("check",39,.03,"保留强听牌保护过牌范围。"),option("bet100",0,.62,"满池不必要地放大波动。"),option("allin",0,5.2,"深筹码听牌不能直接全下。")
      ],"高权益半诈唬"),
      node("turn",["Ks","7s","2d","Jc"],30,45,"对手跟注后再次过牌",[
        option("bet67",52,0,"继续施压中等Kx和口袋对。"),option("check",48,.04,"实现坚果听牌权益也合理。"),option("bet33",0,.34,"尺寸太小，弃牌率不足。"),option("allin",0,1.8,"仍未到必须推入的SPR。")
      ],"转牌持续施压"),
      node("river",["Ks","7s","2d","Jc","3h"],70,25,"听牌落空，对手过牌",[
        option("allin",39,0,"后手仅25BB，唯一合法的进攻尺寸是全下；A高阻断强K与部分跟注牌。"),option("check",61,.09,"并非所有组合都要诈唬，放弃有较高频率。")
      ],"阻断牌诈唬选择")
    ]},
    {id:"sb-99",title:"中口袋对控池",position:"SB 对 BB",stage:"泡沫期",context:"25BB · ICM中等压力 · 无抽水",hand:["9d","9c"],nodes:[
      node("preflop",[],1.5,25,"前面全部弃牌，行动到小盲；你和大盲均为中等筹码",[
        option("open25",82,0,"99是稳定开池牌。"),option("limp",18,.04,"部分策略允许跛入保护范围。"),option("fold",0,3.7,"强口袋对绝不能弃牌。"),option("allin",0,7.3,"25BB直接全下会损失非全下开池线的价值。")
      ],"小盲开池"),
      node("flop",["Kh","6s","2d"],5,22.5,"大盲跟注并在你行动前等待",[
        option("bet33",45,0,"K高干燥面可小注获得保护。"),option("check",55,.02,"中等摊牌价值大量过牌。"),option("bet67",0,.45,"大注使更差牌难以继续。"),option("bet100",0,.91,"不应把中等牌打成极化价值。")
      ],"中等摊牌价值"),
      node("turn",["Kh","6s","2d","Td"],8.3,20.8,"翻牌过牌过牌，转牌大盲下注 1/2池",[
        option("call",67,0,"一次延迟下注仍包含大量空气与听牌。"),option("fold",33,.08,"无方块组合可部分弃牌。"),option("raise50",0,.92,"加注会赶走诈唬并撞上Kx。"),option("allin",0,6.4,"没有价值或合适阻断。")
      ],"延迟下注防守"),
      node("river",["Kh","6s","2d","Td","Ac"],16.6,16.7,"你跟注转牌，对手河牌下注 2/3池",[
        option("fold",91,0,"A河牌让对手价值范围进一步增强。"),option("call",9,.21,"仅少量抓诈，且此无阻断组合偏弃。"),option("allin",0,5.9,"无法代表足够可信的价值范围。")
      ],"河牌弃牌纪律")
    ]},
    {id:"btn-76s",title:"强听牌进攻线",position:"BTN 对 BB",stage:"常规阶段",context:"40BB · 筹码EV · 无抽水",hand:["7c","6c"],nodes:[
      node("preflop",[],1.5,40,"前面全部弃牌，行动到按钮位",[
        option("open25",94,0,"同花连张是标准按钮开池。"),option("fold",6,.11,"极少量简化弃牌损失有限。"),option("allin",0,9.2,"深筹码推入完全不合适。")
      ],"按钮宽范围开池"),
      node("flop",["8c","5d","2c"],5.5,37.5,"大盲跟注后过牌",[
        option("bet67",48,0,"同花加两头顺听牌可建立大底池。"),option("bet33",27,.03,"小注同样保留高权益施压。"),option("check",25,.05,"强听牌也可过牌实现权益。"),option("allin",0,4.2,"SPR过高，不应直接推入。")
      ],"组合听牌下注"),
      node("turn",["8c","5d","2c","Kh"],12.8,31.1,"对手跟注翻牌，转牌过牌",[
        option("bet67",58,0,"K是范围优势牌，适合继续施压。"),option("check",42,.05,"保留权益并避免被加注也合理。"),option("bet33",0,.27,"小尺寸对一对和听牌压力不足。"),option("allin",0,2.5,"全下风险与收益不匹配。")
      ],"范围牌上的第二枪"),
      node("river",["8c","5d","2c","Kh","9s"],30,22.5,"河牌成顺，对手再次过牌",[
        option("allin",68,0,"后手22.5BB小于30BB底池，全下就是最大合法价值尺寸。"),option("bet67",32,.03,"下注20BB仍能稳定取值，也保留少量筹码。"),option("check",0,2.7,"强成牌过牌损失大量价值。")
      ],"河牌坚果价值")
    ]},
    {id:"bb-ako",title:"3-bet底池防守",position:"BB 对 CO",stage:"泡沫期",context:"40BB · ICM轻度压力 · 无抽水",hand:["Ac","Kd"],nodes:[
      node("preflop",[],4,37.5,"CO中等筹码开池到 2.5BB",[
        option("raise50",91,0,"AKo以3-bet取值为主。"),option("call",9,.08,"少量平跟保护范围。"),option("fold",0,6.8,"顶级非对子牌不能弃。"),option("allin",0,4.9,"40BB直接推入会损失弱牌价值。")
      ],"线性3-bet价值"),
      node("flop",["Jd","7s","3h"],17,31.5,"CO跟注3-bet，你在翻牌先行动",[
        option("bet33",56,0,"干燥J高面保有范围优势，可小注。"),option("check",44,.03,"AK高张也需进入过牌范围。"),option("bet67",0,.43,"空气牌不需要用大尺寸。"),option("allin",0,7.8,"没有理由推入剩余筹码。")
      ],"3-bet底池范围小注"),
      node("turn",["Jd","7s","3h","Ah"],28,26,"翻牌小注被跟，转牌击中A，对手等待",[
        option("bet50",63,0,"顶对顶踢脚继续中尺寸取值。"),option("check",37,.04,"控池并保护过牌范围可接受。"),option("allin",0,2.6,"SPR仍不适合直接推入。")
      ],"转牌顶对取值"),
      node("river",["Jd","7s","3h","Ah","8c"],56,12,"对手跟注后河牌过牌",[
        option("allin",62,0,"后手只剩12BB，任何价值下注都等同全下，可从AQ、AT与部分Jx获取价值。"),option("check",38,.06,"控制底池并诱导摊牌同样保留频率。")
      ],"河牌薄价值")
    ]},
    {id:"btn-jt",title:"河牌抓诈",position:"BTN 对 BB",stage:"决赛桌",context:"30BB · ICM中等压力 · 无抽水",hand:["Jh","Th"],nodes:[
      node("preflop",[],1.5,30,"前面全部弃牌，行动到按钮位；两名短码仍在桌上",[
        option("open25",97,0,"JTs是纯开池牌。"),option("fold",3,.25,"弃牌浪费很强的可玩性。"),option("allin",0,8.7,"深筹码全下不是开池策略。")
      ],"按钮开池"),
      node("flop",["Js","8c","3d"],5.5,27.5,"大盲跟注后过牌",[
        option("bet33",59,0,"顶对中踢脚适合小注取值保护。"),option("check",41,.03,"部分过牌避免范围过薄。"),option("bet100",0,.77,"过大尺寸只会留下强继续范围。")
      ],"顶对小注"),
      node("turn",["Js","8c","3d","6s"],9.1,25.7,"翻牌过牌过牌，大盲转牌下注 2/3池",[
        option("call",88,0,"顶对面对延迟下注稳定跟注。"),option("fold",12,.36,"无黑桃时可极少量弃牌，但总体过紧。"),option("raise67",0,1.1,"没有必要把中等顶对变成加注。"),option("allin",0,6.2,"只会被更强牌继续。")
      ],"延迟下注跟注"),
      node("river",["Js","8c","3d","6s","2c"],21.3,19.6,"大盲河牌下注满池",[
        option("call",54,0,"空白河牌保留大量落空听牌，JT处于抓诈阈值上方。"),option("fold",46,.06,"无关键阻断组合可混合弃牌。"),option("allin",0,5.1,"顶对没有加注价值。")
      ],"极化范围抓诈")
    ]},
    {id:"co-qq",title:"超对面对压力",position:"CO 对 BB",stage:"决赛桌",context:"25BB · ICM高压 · 无抽水",hand:["Qd","Qc"],nodes:[
      node("preflop",[],1.5,25,"前面全部弃牌，行动到CO；你覆盖两名短码",[
        option("open25",100,0,"QQ是纯开池价值牌。"),option("fold",0,9.8,"顶级口袋对绝不能弃。"),option("allin",0,5.5,"深筹码直接推入会损失巨大价值。")
      ],"强牌开池"),
      node("flop",["Ts","7s","4h"],5.5,22.5,"大盲跟注后过牌",[
        option("bet67",46,0,"湿润中低牌面可用较大尺寸保护。"),option("bet33",31,.04,"小注仍可获得宽范围价值。"),option("check",23,.06,"少量过牌保护范围。"),option("bet100",0,.29,"满池略显过大。")
      ],"湿润牌面超对"),
      node("turn",["Ts","7s","4h","8d"],12.8,16.1,"对手跟注后转牌过牌",[
        option("check",58,0,"8改善大量跟注范围，超对应降低进攻。"),option("bet50",42,.06,"仍可部分下注取值保护。"),option("bet100",0,.72,"大注会遭遇很强的继续范围。"),option("allin",0,3.9,"一对牌不能无脑打光。")
      ],"动态牌面降速"),
      node("river",["Ts","7s","4h","8d","2h"],12.8,16.1,"转牌过牌过牌，对手河牌下注 2/3池",[
        option("call",76,0,"河牌空白且错过同花，超对可较高频跟注。"),option("fold",24,.17,"无黑桃阻断时可少量弃。"),option("raise67",0,1.7,"加注无法被足够差牌跟注。"),option("allin",0,6.1,"不是合理价值或诈唬组合。")
      ],"错失听牌后的抓诈")
    ]}
  ];
  function scoreOption(choice,options){
    const selected=options.find(item=>item.action===choice);
    if(!selected)throw new Error("这个行动不在当前决策树中");
    const loss=selected.loss;
    const score=loss<=.05?100:loss<=.15?90:loss<=.35?78:loss<=.7?62:loss<=1.25?45:loss<=2.5?25:0;
    const grade=loss<=.05?"最佳/等价":loss<=.35?"可以接受":loss<=1.25?"偏差":"严重错误";
    return{...selected,score,grade};
  }
  function actionLabel(action,node){
    if(action==="allin")return`ALL IN · ${node.stack.toFixed(1)}BB`;
    const fraction=BET_FRACTIONS[action];
    if(fraction)return`${ACTIONS[action]} · ${(node.pot*fraction).toFixed(1)}BB`;
    return ACTIONS[action];
  }
  function validateLines(lines=LINES){
    const errors=[];
    for(const line of lines)for(const [nodeIndex,spot] of line.nodes.entries()){
      const total=spot.options.reduce((sum,item)=>sum+item.freq,0);
      if(Math.abs(total-100)>.001)errors.push(`${line.id}#${nodeIndex+1} 频率合计${total}%`);
      for(const item of spot.options){
        const fraction=BET_FRACTIONS[item.action];
        if(fraction&&spot.pot*fraction>spot.stack+.001)errors.push(`${line.id}#${nodeIndex+1} ${item.action}需要${(spot.pot*fraction).toFixed(1)}BB但仅剩${spot.stack.toFixed(1)}BB`);
      }
    }
    return errors;
  }
  function seededShuffle(items,seed){
    let value=(seed||Date.now())>>>0;const random=()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};
    const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;
  }
  function buildSession(length=50,seed=Date.now()){
    const count=[50,75,100].includes(Number(length))?Number(length):50;
    const hands=[];let cycle=0;
    while(hands.length<count){
      for(const line of seededShuffle(LINES,seed+cycle*9973)){
        if(hands.length>=count)break;
        hands.push({...line,instanceId:`${line.id}-${cycle}-${hands.length+1}`});
      }
      cycle++;
    }
    return{length:count,hands,index:0,nodeIndex:0,records:[],startedAt:Date.now(),finished:false};
  }
  function summarize(session){
    const records=session.records,average=records.length?Math.round(records.reduce((sum,item)=>sum+item.score,0)/records.length):0;
    const byStreet=Object.keys(STREETS).map(street=>{const list=records.filter(item=>item.street===street);return{street,label:STREETS[street],count:list.length,score:list.length?Math.round(list.reduce((sum,item)=>sum+item.score,0)/list.length):0};}).filter(item=>item.count);
    const byStage=[...new Set(records.map(item=>item.stage).filter(Boolean))].map(stage=>{const list=records.filter(item=>item.stage===stage);return{stage,label:stage,count:list.length,score:Math.round(list.reduce((sum,item)=>sum+item.score,0)/list.length)};});
    const mistakes=records.filter(item=>item.score<78).sort((a,b)=>a.score-b.score);
    const weak=[...byStreet].sort((a,b)=>a.score-b.score)[0],weakStage=[...byStage].sort((a,b)=>a.score-b.score)[0];
    return{average,byStreet,byStage,mistakes,weak,weakStage,grade:average>=95?"GTO精英":average>=88?"稳定优秀":average>=78?"基础扎实":average>=65?"需要打磨":"建议系统复习"};
  }
  function cardHtml(code){const red=code&&/[hd]/.test(code[1]);return`<i class="gto-card ${red?"red":""}"><b>${code?.[0]||"?"}</b><span>${SUITS[code?.[1]]||""}</span></i>`;}
  let state=null,answered=false,currentResult=null,selectedLength=50;
  function ensureRoot(){
    if(document.getElementById("gtoTrainer"))return;
    const host=document.createElement("div");host.id="gtoTrainer";host.className="gto-trainer hidden";document.body.append(host);
  }
  function intro(){
    ensureRoot();const el=document.getElementById("gtoTrainer");el.classList.remove("hidden");
    el.innerHTML=`<div class="gto-shell intro"><button class="gto-close" data-gto-close>×</button><div class="gto-hero"><span>TOURNAMENT GTO LAB · BETA</span><h1>锦标赛单人训练场</h1><p>零抽水 · 6-max · 多筹码深度 · ChipEV / ICM</p></div><div class="gto-intro-grid"><article><b>01</b><h3>完整决策线</h3><p>从翻牌前走到河牌，每个节点面对机器行动作出判断。</p></article><article><b>02</b><h3>EV与ICM评分</h3><p>常规阶段看筹码EV，泡沫期和决赛桌加入生存压力。</p></article><article><b>03</b><h3>自动漏洞报告</h3><p>结束后定位低分牌局、薄弱赛段和错误原因。</p></article></div><div class="gto-length"><strong>本次训练手数</strong>${[50,75,100].map(n=>`<button data-length="${n}" class="${n===selectedLength?"active":""}">${n}<small>手</small></button>`).join("")}</div><div class="gto-disclaimer">本模式仅训练零抽水锦标赛。题目覆盖常规ChipEV、泡沫期与决赛桌ICM场景；数据是公开博弈论原则下的精选简化解，不冒充商业求解器的私有实时解。真实最优策略仍会随奖励结构、全桌筹码、范围和下注树改变。</div><button class="gto-start">开始训练</button></div>`;
    el.querySelector("[data-gto-close]").onclick=close;el.querySelectorAll("[data-length]").forEach(button=>button.onclick=()=>{selectedLength=Number(button.dataset.length);intro();});el.querySelector(".gto-start").onclick=()=>{state=buildSession(selectedLength);answered=false;renderSpot();};
  }
  function current(){const hand=state.hands[state.index];return{hand,node:hand.nodes[state.nodeIndex]};}
  function renderSpot(){
    const {hand,node}=current(),el=document.getElementById("gtoTrainer"),progress=((state.index+(state.nodeIndex/hand.nodes.length))/state.length)*100;
    answered=false;currentResult=null;
    const heroPosition=hand.position.split(" 对 ")[0],villainPosition=hand.position.split(" 对 ")[1]||"—";
    el.innerHTML=`<div class="gto-shell session"><header><div><span>TOURNAMENT GTO LAB</span><b>第 ${state.index+1} / ${state.length} 手</b><small>${hand.stage} · ${hand.context}</small></div><div class="gto-progress"><i style="width:${progress}%"></i></div><button data-finish>提前生成报告</button><button class="gto-close" data-gto-close>×</button></header><main><section class="gto-table"><div class="gto-villain"><i>AI</i><b>基准对手 · ${villainPosition}</b><span>${node.stack.toFixed(1)} BB</span></div><div class="gto-speech">${node.villain}</div><div class="gto-pot"><small>POT</small><b>${node.pot.toFixed(1)}</b><span>BB</span></div><div class="gto-board">${node.board.map(cardHtml).join("")||'<em>翻牌前</em>'}</div><div class="gto-hero-seat"><div class="gto-position-badge"><small>你的位置</small><b>${heroPosition}</b></div><span>你的手牌</span><div class="gto-hole-cards">${hand.hand.map(cardHtml).join("")}</div><small>${hand.context} · 有效筹码 ${node.stack.toFixed(1)} BB</small></div></section><aside class="gto-coach"><span>DECISION ${state.nodeIndex+1}/${hand.nodes.length}</span><h2>${STREETS[node.street]}怎么行动？</h2><p>${node.concept}</p><div class="gto-live-score"><small>当前训练分</small><b>${state.records.length?Math.round(state.records.reduce((s,r)=>s+r.score,0)/state.records.length):"--"}</b></div><div id="gtoFeedback"><div class="gto-thinking">先独立判断，行动后显示策略频率和EV反馈。</div></div></aside></main><footer><div class="gto-actions">${node.options.map(item=>`<button data-action="${item.action}">${actionLabel(item.action,node)}</button>`).join("")}</div><button id="gtoNext" class="hidden">下一决策 →</button></footer></div>`;
    el.querySelector("[data-gto-close]").onclick=close;el.querySelector("[data-finish]").onclick=()=>finish(true);el.querySelectorAll("[data-action]").forEach(button=>button.onclick=()=>answer(button.dataset.action));el.querySelector("#gtoNext").onclick=next;
  }
  function answer(action){
    if(answered)return;answered=true;const {hand,node}=current(),result=scoreOption(action,node.options);currentResult=result;
    state.records.push({handNumber:state.index+1,handId:hand.instanceId,title:hand.title,position:hand.position,stage:hand.stage,context:hand.context,hole:[...hand.hand],board:[...node.board],street:node.street,concept:node.concept,villain:node.villain,choice:action,choiceLabel:actionLabel(action,node),score:result.score,grade:result.grade,loss:result.loss,reason:result.reason,options:node.options.map(item=>({...item,label:actionLabel(item.action,node)}))});
    const feedback=document.getElementById("gtoFeedback");feedback.innerHTML=`<div class="gto-grade grade-${result.score>=90?"good":result.score>=62?"ok":"bad"}"><strong>+${result.score}</strong><div><b>${result.grade}</b><small>模型EV损失 ${result.loss.toFixed(2)}</small></div></div><p>${result.reason}</p><div class="gto-mix">${node.options.map(item=>`<div class="${item.action===action?"chosen":""}"><span>${actionLabel(item.action,node)}</span><i><em style="width:${item.freq}%"></em></i><b>${item.freq}%</b><small>损失 ${item.loss.toFixed(2)}</small></div>`).join("")}</div><div class="gto-note">频率接近但EV相同的行动属于混合策略，不按“猜中最高频”机械扣分。ICM场景按相对锦标赛EV衡量，不换算成现金。</div>`;
    document.querySelectorAll(".gto-actions button").forEach(button=>{button.disabled=true;if(button.dataset.action===action)button.classList.add("selected");});
    document.getElementById("gtoNext").classList.remove("hidden");
  }
  function next(){
    const hand=state.hands[state.index];
    if(state.nodeIndex<hand.nodes.length-1)state.nodeIndex++;
    else{state.index++;state.nodeIndex=0;}
    if(state.index>=state.length)finish(false);else renderSpot();
  }
  function finish(early){
    if(!state||!state.records.length){close();return;}state.finished=true;const report=summarize(state),el=document.getElementById("gtoTrainer");
    el.innerHTML=`<div class="gto-shell report"><header><div><span>SESSION REPORT</span><h1>${report.grade}</h1><p>${early?"提前结束 · ":""}完成 ${new Set(state.records.map(r=>r.handNumber)).size} 手牌 / ${state.records.length} 个决策</p></div><div class="gto-score-ring" style="--score:${report.average}"><b>${report.average}</b><small>总评</small></div><button class="gto-close" data-gto-close>×</button></header><h3 class="gto-report-label">按街道</h3><section class="gto-street-report">${report.byStreet.map(item=>`<article><span>${item.label}</span><b>${item.score}</b><i><em style="width:${item.score}%"></em></i><small>${item.count}次决策</small></article>`).join("")}</section><h3 class="gto-report-label">按锦标赛阶段</h3><section class="gto-street-report gto-stage-report">${report.byStage.map(item=>`<article><span>${item.label}</span><b>${item.score}</b><i><em style="width:${item.score}%"></em></i><small>${item.count}次决策</small></article>`).join("")}</section><div class="gto-report-grid"><section><h2>训练结论</h2><div class="gto-summary-copy"><b>薄弱街道：${report.weak?.label||"样本不足"} · 薄弱赛段：${report.weakStage?.label||"样本不足"}</b><p>${report.weak?`该街道平均 ${report.weak.score} 分。优先复习最低频率并不等于错误；真正应修正的是具有明确EV损失的纯错误。`:"至少完成一个决策后才能分析。"}</p></div><button id="retryMistakes" ${report.mistakes.length?"":"disabled"}>重练 ${Math.min(12,report.mistakes.length)} 个低分节点</button><button id="newSession">重新开始完整训练</button></section><section><h2>低分牌局拆解 <small>${report.mistakes.length}</small></h2><div class="gto-mistakes">${report.mistakes.slice(0,20).map((item,index)=>`<button data-review="${index}"><b>#${item.handNumber} · ${STREETS[item.street]} · ${item.score}分</b><span>${item.stage} · ${item.hole.join(" ")} / ${item.board.join(" ")||"翻牌前"}</span><em>你的行动：${item.choiceLabel}</em><small>${item.reason}</small></button>`).join("")||"<p>没有低分节点，这次训练非常稳定。</p>"}</div></section></div><div id="gtoReview"></div></div>`;
    el.querySelector("[data-gto-close]").onclick=close;el.querySelector("#newSession").onclick=intro;el.querySelectorAll("[data-review]").forEach(button=>button.onclick=()=>review(report.mistakes[Number(button.dataset.review)]));el.querySelector("#retryMistakes").onclick=()=>retry(report.mistakes.slice(0,12));
    try{localStorage.setItem("pokerGtoLastReport",JSON.stringify({date:Date.now(),average:report.average,grade:report.grade,completed:new Set(state.records.map(r=>r.handNumber)).size,mistakes:report.mistakes.length}));}catch(_){}
  }
  function review(item){
    const el=document.getElementById("gtoReview");el.innerHTML=`<div class="gto-review-card"><button data-close-review>×</button><span>第${item.handNumber}手 · ${item.position} · ${item.stage}</span><h3>${item.title} / ${STREETS[item.street]}</h3><div class="gto-review-cards">${item.hole.map(cardHtml).join("")}<i>｜</i>${item.board.map(cardHtml).join("")}</div><p><b>锦标赛环境：</b>${item.context}</p><p><b>局面：</b>${item.villain}</p><p><b>你的行动：</b>${item.choiceLabel}，模型EV损失 ${item.loss.toFixed(2)}。</p><p><b>拆解：</b>${item.reason}</p><div class="gto-mix">${item.options.map(option=>`<div><span>${option.label}</span><i><em style="width:${option.freq}%"></em></i><b>${option.freq}%</b><small>损失 ${option.loss.toFixed(2)}</small></div>`).join("")}</div></div>`;el.querySelector("[data-close-review]").onclick=()=>el.innerHTML="";
  }
  function retry(mistakes){
    const lookup=new Map(LINES.map(line=>[line.id,line])),hands=[];
    for(const item of mistakes){const baseId=item.handId.split("-").slice(0,-2).join("-"),line=lookup.get(baseId);if(!line)continue;const source=line.nodes.find(node=>node.street===item.street&&node.concept===item.concept);if(source)hands.push({...line,instanceId:`retry-${hands.length}`,nodes:[source]});}
    if(!hands.length)return;state={length:hands.length,hands,index:0,nodeIndex:0,records:[],startedAt:Date.now(),finished:false};renderSpot();
  }
  function close(){document.getElementById("gtoTrainer")?.classList.add("hidden");}
  return{open:intro,close,scoreOption,actionLabel,validateLines,buildSession,summarize,ACTIONS,LINES};
});
