// Legal choices derived only from this peer's public view. No server state imports.
module.exports=(r,id)=>{
  const g=r.game,y=g.you,mine=g.actorId===id,a=(action,payload={})=>({action,payload});
  if(r.gameId==='camel-race'&&r.players[g.turn%r.players.length]?.id===id)return a('roll');
  if(r.gameId==='seven-duel'&&mine&&g.phase==='wonder-draft')return a('pick-wonder',{wonderId:g.wonderDraft.offers[0].id});
  if(r.gameId==='seven-duel'&&mine&&g.phase==='playing'){
    const entry=Object.entries(g.legal||{})[0];
    if(entry)return a('take',{cardId:entry[0],mode:entry[1].canBuild?'build':'discard'});
  }
  if(r.gameId==='colt-express'){
    if(g.phase==='planning'&&mine){const c=y.hand.find(c=>c.kind==='action');return c?a('play-card',{cardId:c.id}):a('draw-cards');}
    if(g.phase==='executing'&&mine){const o=g.executionOptions[0],t=g.currentAction.cardType;if(o)return a('execute-action',t==='rob'?{lootId:o.id}:t==='punch'?{targetId:o.playerId,destination:o.destinations[0],lootId:o.loot?.[0]?.id}:t==='shoot'?{targetId:o.playerId}:{carIndex:o.carIndex});}
    return; // No ack: exercise all timed result paths.
  }
  if(r.gameId==='avalon'){
    if(g.phase==='proposal'&&mine){const t=g.seats.slice(-g.currentTeamSize).find(s=>!g.selectedTeam.includes(s.playerId));return t?a('toggle-team',{targetId:t.playerId}):a('propose-team');}
    if(g.phase==='voting'&&!y.voteChoice)return a('vote',{choice:'approve'});
    if(g.phase==='quest'&&g.proposedTeam.includes(id)&&!y.questChoice)return a('quest-card',{choice:'success'});
    if(['vote-result','quest-result'].includes(g.phase)&&!g.eventAcks.includes(id))return a('ack-event');
    if(g.phase==='assassination'&&mine)return a('assassinate',{targetId:g.seats.find(s=>s.playerId!==id).playerId});
  }
  if(r.gameId==='witch-town'){
    if(!y?.alive)return;
    if(g.phase==='dawn'&&mine)return a('dawn-cat',{targetId:g.seats.find(s=>s.playerId!==id&&!s.blackCatImmune).playerId});
    if(g.phase==='day'&&mine)return a(g.turnMode==='play'?'end-turn':'draw');
    if(['trial','conspiracy-cat'].includes(g.phase)&&mine&&g.trialOptions.length)return a('reveal-trial',{trialId:g.trialOptions[0].id});
    if(g.phase==='conspiracy-pass'&&!y.submitted&&y.leftNeighbor?.trials.length)return a('conspiracy-pick',{trialId:y.leftNeighbor.trials[0].id});
    if(['conspiracy-result','night-result'].includes(g.phase)&&!g.eventAcks.includes(id))return a('ack-event');
    if(g.phase==='night-choice'){
      if(y.everWitch&&!g.night.witchSubmitted){const t=g.seats.find(s=>s.alive&&!y.witchTeam.some(w=>w.playerId===s.playerId));if(t)return a('night-target',{targetId:t.playerId});}
      if(y.currentConstable&&!g.night.protectSubmitted)return a('night-protect',{targetId:g.seats.find(s=>s.alive&&s.playerId!==id).playerId});
    }
    if(g.phase==='night-confession'&&!g.night.confessionSubmitted)return a('night-pass');
  }
  if(r.gameId==='las-vegas-royale'){
    const p=g.pending;
    if(p?.actorId===id){let payload;const t=p.type;
      if(['biggyKick','handicap'].includes(t))payload={skip:true};
      if(['luckyChoose','luckyGuess'].includes(t))payload={count:2};
      if(t==='fifty')payload={choice:'cashout'};
      if(t==='noEntry')payload={casino:g.casinos.find(c=>c.number!==p.casino).number};
      if(t==='block')payload={cluster:p.clusters[0],casino:g.casinos.find(c=>c.number!==g.closedCasino).number};
      if(t==='knockoutGive')payload={dieId:p.options[0].id};
      if(t==='doubleDown')payload={dieIds:[]};if(t==='niceDice')payload={dieId:''};if(t==='primeTime')payload={indices:[]};
      if(t==='blackDivide')payload={indices:[0,2,4]};if(t==='blackChoose')payload={pile:0};if(t==='myChoice')payload={option:6};
      return payload?a('resolve',payload):null;
    }
    if(p||g.currentTurnId!==id)return;
    if(!g.currentRoll)return a('roll');
    const counts = new Map();
    for (const die of g.currentRoll) if (die.face !== g.closedCasino) counts.set(die.face, (counts.get(die.face) || 0) + 1);
    const face = [...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
    return face ? a('place',{face}) : a('pass');
  }
};
