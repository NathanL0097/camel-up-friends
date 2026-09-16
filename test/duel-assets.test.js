const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { WONDERS } = require('../src/games/seven-duel/data');

test('every wonder has its own original, local, script-free monument symbol', () => {
  const svg = fs.readFileSync('public/assets/duel-monuments.svg', 'utf8');
  const ids = [...svg.matchAll(/<symbol id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, WONDERS.length);
  for (const wonder of WONDERS) assert.ok(ids.includes(wonder.id), wonder.id);
  assert.doesNotMatch(svg, /<script|<image|onload=|href=/i);
});
