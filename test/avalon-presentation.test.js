const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const rules=require('../src/games/avalon/rules');

// Small presentation harness: verifies update identity/listener behaviour, not layout.
// Real browser screenshots remain the visual acceptance criterion.
function harness(){
  const nodes=new Map(),storage=new Map(),sent=[];
  class Node {
    constructor(id){this.id=id;this.dataset={};this.writes=0;this.listeners=[];this.children=[];this.classList={toggle(){}};nodes.set(id,this);}
    set innerHTML(value){this.children.forEach(id=>nodes.delete(id));this.children=[];this.markup=value;this.writes++;
      for(const match of value.matchAll(/\bid="([^"]+)"/g)){new Node(match[1]);this.children.push(match[1]);}}
    get innerHTML(){return this.markup||'';}
    get firstElementChild(){return this.markup?{}:null;}
    replaceChildren(){this.innerHTML='';}
    setAttribute(){}
    addEventListener(type,fn){this.listeners.push({type,fn});}
    showModal(){this.open=true;this.opens=(this.opens||0)+1;}
    close(){this.open=false;}
  }
  ['avalonGame','avAction','avMissions','avSeats','avHistory','avPrivate','avRoleOverlay','avResult','avEvent','avCode','avPhase','rulesContent'].forEach(id=>new Node(id));
  const window={GameArt:{icon:()=>'<svg></svg>'},TableAudio:{play(){}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/games/avalon.js'),'utf8'),{
    window,document:{querySelectorAll:()=>[]},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}
  });
  const client=window.GameClientFactories.avalon({socket:{emit:(...args)=>sent.push(args)},$:id=>nodes.get(id),show(){},escapeHtml:String,getMyId:()=> 'p1',copyInvite(){}});
  const players=Array.from({length:5},(_,i)=>({id:`p${i+1}`,name:`骑士${i+1}`,connected:true}));
  const room={code:'AVTEST',hostId:'p1',players,game:rules.createGame(players,{preset:'classic'},()=>.3719)};
  return {nodes,client,room,sent,render:()=>client.render(rules.publicRoom(room,'p1'))};
}

test('Avalon role reveal stays mounted through unrelated connection updates',()=>{
  const h=harness();h.render();const dialog=h.nodes.get('avRoleDialog');
  h.room.players[1].connected=false;h.render();
  assert.equal(h.nodes.get('avRoleDialog'),dialog);assert.equal(dialog.opens,1);
  h.nodes.get('avRoleSeen').onclick();h.render();assert.equal(h.nodes.has('avRoleDialog'),false);
});

test('Avalon peer votes do not rebuild the local action or add duplicate handlers',()=>{
  const h=harness(),g=h.room.game;
  for(const p of g.seats.slice(0,g.questSizes[0]))rules.toggleTeam(h.room,g.actorId,{targetId:p.playerId});
  rules.proposeTeam(h.room,g.actorId);h.render();
  const button=h.nodes.get('avApprove'),writes=h.nodes.get('avAction').writes;
  rules.vote(h.room,'p2',{choice:'approve'});h.render();
  assert.equal(h.nodes.get('avApprove'),button);assert.equal(h.nodes.get('avAction').writes,writes);
  button.onclick();assert.equal(h.sent.filter(([event])=>event==='game:action').length,1);
});

test('Avalon end scene is stable and supports review without replaying on updates',()=>{
  const h=harness();h.room.game.status='finished';h.room.game.phase='result';
  h.room.game.winner={side:'good',title:'守住圆桌',detail:'验收终局'};
  h.render();const dialog=h.nodes.get('avResultDialog');assert.ok(dialog.open);
  h.nodes.get('avReturnTable').onclick();h.room.players[1].connected=false;h.render();
  assert.equal(h.nodes.get('avResultDialog'),dialog);assert.equal(dialog.open,false);
  h.nodes.get('avReviewResult').onclick();assert.equal(dialog.open,true);
});
