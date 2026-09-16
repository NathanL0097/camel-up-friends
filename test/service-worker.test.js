const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function worker({ online = false, cached = new Map() } = {}) {
  const handlers = {}, writes = [], deleted = [];
  const cache = {
    match: async request => cached.get(typeof request === 'string' ? request : request.url),
    put: async request => writes.push(request.url),
    addAll: async () => {},
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    self: { location: { origin: 'https://table.test' }, addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim() {} } },
    caches: { open: async () => cache, keys: async () => ['friends-tabletop-shell-v6', 'other-app'], delete: async key => deleted.push(key) },
    fetch: async () => { if (!online) throw Error('offline'); return new Response('asset'); },
    URL, Response,
  });
  return {
    writes, deleted,
    async fetch(path, destination = 'script', mode = 'cors') {
      let response;
      const pending = [];
      handlers.fetch({ request: { url: `https://table.test${path}`, method: 'GET', destination, mode }, respondWith: value => { response = value; }, waitUntil: promise => pending.push(promise) });
      const result = await response;
      await Promise.all(pending);
      return result;
    },
    async activate() { let pending; handlers.activate({ waitUntil: value => { pending = value; } }); await pending; },
  };
}

test('offline navigation gets the shell, missing assets never get HTML', async () => {
  const w = worker({ cached: new Map([['/index.html', new Response('<html>shell</html>')]]) });
  assert.match(await (await w.fetch('/room/ABC123', 'document', 'navigate')).text(), /shell/);
  assert.equal((await w.fetch('/missing.js')).type, 'error');
  assert.equal((await w.fetch('/missing.css', 'style')).type, 'error');
});

test('worker caches static resources but never API, room pages, or socket transports', async () => {
  const w = worker({ online: true });
  await w.fetch('/app.js');
  await w.fetch('/socket.io/socket.io.js');
  assert.equal(await w.fetch('/api/rooms', ''), undefined);
  assert.equal(await w.fetch('/socket.io/?EIO=4&transport=polling', ''), undefined);
  await w.fetch('/room/ABC123', 'document', 'navigate');
  assert.deepEqual(w.writes, ['https://table.test/app.js', 'https://table.test/socket.io/socket.io.js']);
});

test('cache upgrade preserves unrelated applications caches', async () => {
  const w = worker();
  await w.activate();
  assert.deepEqual(w.deleted, ['friends-tabletop-shell-v6']);
});
