const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture() {
  const button = {}, listeners = {}, shown = [], idle = [];
  const dialog = { open: false, innerHTML: '', addEventListener: (name, fn) => { listeners[name] = fn; }, querySelector: () => button,
    showModal() { this.open = true; shown.push(this.innerHTML); }, close() { this.open = false; }, remove() {} };
  const context = { window: { GameArt: { icon: () => '<svg></svg>' } }, document: { createElement: () => dialog, body: { append() {} } }, setTimeout: () => 1, clearTimeout() {} };
  vm.runInNewContext(fs.readFileSync('public/game-moments.js', 'utf8'), context);
  const moments = context.window.GameMoments({ id: 'test', theme: 'witch', select: () => ({}), art: () => 'seal', onIdle: () => idle.push(true) });
  return { moments, dialog, shown, idle, finish: () => button.onclick() };
}

test('signature queue skips reconnect history and signals idle only after all new events', () => {
  const f = fixture();
  f.moments.update('match', [{ seq: 1, title: 'old' }]);
  assert.equal(f.shown.length, 0);
  f.moments.update('match', [{ seq: 1 }, { seq: 2, title: 'trial' }, { seq: 3, title: 'elimination' }]);
  assert.equal(f.moments.busy, true);
  f.finish();
  assert.equal(f.moments.busy, true);
  assert.equal(f.idle.length, 0);
  f.finish();
  assert.equal(f.moments.busy, false);
  assert.equal(f.idle.length, 1);
  f.moments.update('match', [{ seq: 3 }]);
  assert.equal(f.shown.length, 2);
});

test('signature backlog is bounded and a new match clears the old scene', () => {
  const f = fixture();
  f.moments.update('match', []);
  f.moments.update('match', Array.from({ length: 20 }, (_, i) => ({ seq: i + 1, title: `event ${i + 1}` })));
  for (let i = 0; i < 8; i++) f.finish();
  assert.equal(f.shown.length, 8);
  assert.equal(f.moments.busy, false);
  f.moments.update('match', [{ seq: 21, title: 'next' }]);
  f.moments.update('new-match', []);
  assert.equal(f.dialog.open, false);
  assert.equal(f.moments.busy, false);
});
