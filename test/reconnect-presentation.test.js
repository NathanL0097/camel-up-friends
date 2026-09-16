const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function client() {
  const source = fs.readFileSync('public/app.js', 'utf8');
  const cues = [], invitations = [], handlers = {}, elements = {};
  let reply;
  const context = vm.createContext({
    reconnecting: true, identity: null,
    roomIdentities: { load: () => ({ code: 'ABC123', playerToken: 'local-test-only' }) },
    roomFromUrl: () => 'ABC123', name: () => '验收玩家',
    $: id => elements[id] ||= { value: '', textContent: '' },
    document: { getElementById: () => ({ remove() {} }) },
    socket: { on: (event, fn) => { handlers[event] = fn; }, emit: (event, data, callback) => { assert.equal(event, 'room:join'); reply = callback; } },
    setButtonBusy() {}, saveIdentity() {}, history: { replaceState() {} }, show() {},
    showSystemCue: text => cues.push(text), prepareInviteJoin: code => invitations.push(code),
  });
  vm.runInContext(source.slice(source.indexOf('function join('), source.indexOf('function prepareInviteJoin(')), context);
  vm.runInContext(source.slice(source.indexOf('socket.on("connect",'), source.indexOf('socket.on("disconnect",')), context);
  handlers.connect();
  return { cues, invitations, elements, reply: result => reply(result) };
}

test('transport reconnect never claims the room has recovered before successful rejoin', () => {
  const c = client();
  assert.deepEqual(c.cues, []);
  c.reply({ ok: true, code: 'ABC123' });
  assert.deepEqual(c.cues, ['已重新连接到牌桌']);
  assert.equal(c.elements.entryHint.textContent, '已连接到好友房。');
});

test('expired room returns to join UI and explains failure without success feedback', () => {
  const c = client();
  c.reply({ ok: false, error: '房间不存在或服务器已经重启' });
  assert.deepEqual(c.cues, []);
  assert.deepEqual(c.invitations, ['ABC123']);
  assert.equal(c.elements.entryHint.textContent, '房间不存在或服务器已经重启');
});
