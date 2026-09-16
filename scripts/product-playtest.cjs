// Local-only live playtest peers. Uses the same public protocol as a player.
const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const savePath = path.join(__dirname, '../.quality/peers.json');
const peers = new Map();
function save(){fs.mkdirSync(path.dirname(savePath),{recursive:true,mode:0o700});fs.writeFileSync(savePath,JSON.stringify([...peers.values()].filter(p=>p.id&&p.code).map(p=>({name:p.name,code:p.code,token:p.token}))),{mode:0o600});}
async function join(code, name, token, gameId) {
  const ws = new WebSocket('ws://localhost:3000/socket.io/?EIO=4&transport=websocket');
  const peer = { ws, name, code, token:token||crypto.randomUUID(), room: null, auto:false };
  peers.set(name, peer);
  ws.addEventListener('message', ({data}) => {
    const message = String(data);
    if (message.startsWith('0')) ws.send('40');
    else if (message === '2') ws.send('3');
    else if (message.startsWith('40')) ws.send('421' + JSON.stringify([gameId?'room:create':'room:join', {code,name,gameId,playerToken:peer.token}]));
    else if (message.startsWith('431')) { const result = JSON.parse(message.slice(3))[0]; peer.id = result.playerId;peer.code=result.code||code;peer.token=result.playerToken||peer.token;if(result.ok)save(); console.log(JSON.stringify({name,joined:result.ok,id:peer.id,code:peer.code,error:result.error})); }
    else if (message.startsWith('42')) {
      const [event, payload] = JSON.parse(message.slice(2));
      if (event === 'room:update') peer.room = payload;
      else console.log(JSON.stringify({name,event,payload}));
    }
  });
}
readline.createInterface({input:process.stdin}).on('line', line => {
  try {
    const c = JSON.parse(line);
    if(c.restore){const saved=JSON.parse(fs.readFileSync(savePath,'utf8'));saved.forEach(p=>join(p.code,p.name,p.token));}
    else if(c.create)join(null,c.name,null,c.create);
    else if (c.join) c.names.forEach(name=>join(c.join,name,c.token));
    else if(c.start)peers.get(c.start).ws.send('42'+JSON.stringify(['game:start']));
    else if(c.restart)peers.get(c.restart).ws.send('42'+JSON.stringify(['game:restart']));
    else if(c.auto!==undefined){peers.get(c.name).auto=c.auto;peers.get(c.name).pace=c.pace||2400;}
    else if(c.reconnect){const p=peers.get(c.reconnect);join(p.code,p.name,p.token);}
    else if(c.duplicate){const p=peers.get(c.duplicate);join(p.code,p.name+'-tab',p.token);}
    else if (c.close) peers.get(c.close)?.ws.close();
    else if (c.action) peers.get(c.name).ws.send('42'+JSON.stringify(['game:action',{action:c.action,payload:c.payload||{}}]));
    else if (c.inspect) { const p=peers.get(c.inspect); console.log(JSON.stringify(c.full?{name:p.name,id:p.id,room:p.room}:{name:p.name,id:p.id,code:p.code,phase:p.room?.game?.phase,actor:p.room?.game?.actorId,players:p.room?.players,you:p.room?.game?.you,pending:p.room?.game?.pending,options:p.room?.game?.executionOptions})); }
    else console.log(JSON.stringify([...peers.values()].map(p=>({name:p.name,id:p.id,code:p.room?.code,phase:p.room?.game?.phase,actor:p.room?.game?.actorId}))));
  } catch(error) { console.log(error.message); }
});
setInterval(()=>{for(const p of peers.values())if(p.auto&&p.ws.readyState===WebSocket.OPEN&&p.room?.game?.status==='playing'&&Date.now()-(p.lastActionAt||0)>=(p.pace||2400)){
  try{delete require.cache[require.resolve('./playtest-policy.cjs')];const choice=require('./playtest-policy.cjs')(p.room,p.id);if(choice){p.lastActionAt=Date.now();p.ws.send('42'+JSON.stringify(['game:action',choice]));}}catch(e){console.log(JSON.stringify({name:p.name,error:e.message}));}
}},400);
