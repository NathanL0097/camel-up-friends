const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('all game clients and shared scripts exclude spoken notifications', () => {
  function check(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) check(file);
      else if (entry.name.endsWith('.js')) {
        assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /SpeechSynthesisUtterance|speechSynthesis|wtVoice|witchTownVoice/, file);
      }
    }
  }
  check('public');
  assert.doesNotMatch(fs.readFileSync('public/index.html', 'utf8'), /含语音/);
});
