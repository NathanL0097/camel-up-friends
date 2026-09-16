const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function audioHarness({unsupported = false, enabled = false} = {}) {
  const handlers = new Map(), elements = new Map(), values = new Map();
  const stats = {contexts:0, buffers:0, starts:0, stops:0, sources:[]};
  if(enabled) values.set('tabletop.audio.enabled', 'true');
  const on = (name, fn) => {const list=handlers.get(name)||[];list.push(fn);handlers.set(name,list);};
  const document = {hidden:false, focused:true, hasFocus(){return this.focused;}, addEventListener:on,
    dispatchEvent(event){for(const fn of handlers.get(event.type)||[])fn(event);},
    getElementById(id){if(!elements.has(id))elements.set(id,{setAttribute(){},showModal(){},close(){}});return elements.get(id);}};
  class AudioContext {
    constructor(){stats.contexts++;this.state='suspended';this.sampleRate=8000;this.currentTime=0;this.destination={};}
    async resume(){this.state='running';}
    createGain(){return {gain:{value:0,setTargetAtTime(){}},connect(){}};}
    createBuffer(channels,length){stats.buffers++;return {getChannelData:()=>new Float32Array(length)};}
    createBufferSource(){const source={connect(){},disconnect(){},start(){stats.starts++;},stop(){stats.stops++;source.onended?.();}};stats.sources.push(source);return source;}
  }
  const window = {addEventListener:on, ...(unsupported?{}:{AudioContext})};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/platform-audio.js'),'utf8'),{
    window, document, localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}, Float32Array, Date, console
  });
  return {audio:window.TableAudio,document,stats,values,dispatch:(type,event={})=>{for(const fn of handlers.get(type)||[])fn(event);}};
}

test('sound defaults to silence and creates no context or asset buffer before a gesture', async()=>{
  const h=audioHarness();assert.equal(h.audio.muted,true);assert.equal(h.audio.play('dice'),false);assert.equal(h.stats.contexts,0);
  await h.audio.unlock();assert.equal(h.stats.contexts,1);assert.equal(h.stats.buffers,3);assert.equal(h.audio.play('dice'),false);
  await h.audio.unlock();assert.equal(h.stats.contexts,1);assert.equal(h.stats.buffers,3);
});
test('audio events are deduplicated and synthesized buffers reused',async()=>{
  const h=audioHarness({enabled:true});await h.audio.unlock();
  assert.equal(h.audio.play('dice',{key:'round-1'}),true);assert.equal(h.audio.play('dice',{key:'round-1'}),false);
  h.stats.sources[0].onended();assert.equal(h.audio.play('dice',{key:'round-2'}),true);assert.equal(h.stats.buffers,4);
});
test('major audio interrupts micro sounds and suppresses low-priority overlap',async()=>{
  const h=audioHarness({enabled:true});await h.audio.unlock();h.audio.play('click');
  assert.equal(h.audio.play('victory',{key:'win'}),true);assert.equal(h.stats.stops,1);
  assert.equal(h.audio.play('token'),false);assert.equal(h.stats.starts,2);
});
test('audio concurrency is bounded and ended voices release their slot',async()=>{
  const h=audioHarness({enabled:true});await h.audio.unlock();
  for(let i=0;i<4;i++)assert.equal(h.audio.play('card',{key:`card-${i}`}),true);
  assert.equal(h.audio.play('card',{key:'fifth'}),false);h.stats.sources[0].onended();
  assert.equal(h.audio.play('card',{key:'sixth'}),true);
  assert.equal(h.audio.play('victory',{key:'crowded-win'}),true); // A full micro-voice pool must not swallow the ending.
  assert.equal(h.stats.stops,4);
});
test('mute, zero volume, hidden tabs and unfocused tabs cannot emit game audio',async()=>{
  const h=audioHarness({enabled:true});await h.audio.unlock();h.audio.update({volume:0});assert.equal(h.audio.play('dice'),false);
  h.audio.update({volume:2});assert.equal(h.audio.volume,1);h.document.hidden=true;assert.equal(h.audio.play('dice'),false);
  h.document.hidden=false;h.document.focused=false;assert.equal(h.audio.play('dice'),false);
  h.document.focused=true;h.audio.play('dice');h.audio.update({muted:true});assert.equal(h.stats.stops,1);assert.equal(h.audio.audible,false);
});
test('cross-tab mute and volume updates use the shared sound controls',async()=>{
  const h=audioHarness({enabled:true});await h.audio.unlock();h.audio.play('movement');
  h.dispatch('storage',{key:'tabletop.audio.enabled',newValue:'false'});assert.equal(h.audio.muted,true);assert.equal(h.stats.stops,1);
  h.dispatch('storage',{key:'tabletop.audio.volume',newValue:'.25'});assert.equal(h.audio.volume,.25);
});
test('unsupported mobile audio fails silently without affecting game controls',async()=>{
  const h=audioHarness({unsupported:true});await h.audio.unlock();h.audio.update({muted:false});assert.equal(h.audio.play('victory'),false);assert.equal(h.stats.contexts,0);
});
