const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/games/draw-and-guess/rules");

function makeRoom(count = 3, now = 1_000_000) {
  const players = Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `玩家${index + 1}`,
    connected: true,
    score: 999
  }));
  const room = { code: "DRAW88", hostId: "p1", players, game: null };
  room.game = rules.createGame(players, () => 0, now);
  return room;
}

test("开局安排每人两次作画并重置积分", () => {
  const room = makeRoom(3);
  assert.equal(room.game.phase, "choosing");
  assert.equal(room.game.totalTurns, 6);
  assert.equal(new Set(room.game.turnOrder).size, 3);
  assert.deepEqual(room.players.map((player) => player.score), [0, 0, 0]);
});

test("选词仅对画家可见，猜题者只看类别和字数提示", () => {
  const room = makeRoom(3);
  const artistId = room.game.artistId;
  const guesserId = room.players.find((player) => player.id !== artistId).id;
  const secret = room.game.wordChoices[0];
  const beforeArtist = rules.publicRoom(room, artistId);
  const beforeGuesser = rules.publicRoom(room, guesserId);
  assert.equal(beforeArtist.game.wordChoices.length, 3);
  assert.equal(beforeGuesser.game.wordChoices.length, 0);
  assert.equal(beforeGuesser.game.word, undefined);
  assert.throws(() => rules.selectWord(room, guesserId, secret.word), /只有本轮画家/);
  rules.selectWord(room, artistId, secret.word, 1_001_000);
  const artistView = rules.publicRoom(room, artistId);
  const guesserView = rules.publicRoom(room, guesserId);
  assert.equal(artistView.game.word, secret.word);
  assert.equal(guesserView.game.word, undefined);
  assert.equal(guesserView.game.category, secret.category);
  assert.equal(guesserView.game.hint.replaceAll(" ", "").length, [...secret.word].length);
});

test("画笔数据被限制在画布范围且只有画家可修改", () => {
  const room = makeRoom(2);
  const artistId = room.game.artistId;
  const guesserId = room.players.find((player) => player.id !== artistId).id;
  rules.selectWord(room, artistId, room.game.wordChoices[0].word, 1_001_000);
  assert.throws(() => rules.addStroke(room, guesserId, { strokeId: "bad", points: [{ x: .5, y: .5 }] }), /只有画家/);
  rules.addStroke(room, artistId, { strokeId: "line-1", color: "not-a-color", width: 99, points: [{ x: -2, y: 4 }, { x: .5, y: .6 }] });
  assert.equal(room.game.strokes[0].color, "#172b2b");
  assert.equal(room.game.strokes[0].width, 24);
  assert.deepEqual(room.game.strokes[0].points[0], { x: 0, y: 1 });
  rules.undoStroke(room, artistId);
  assert.equal(room.game.strokes.length, 0);
  rules.addStroke(room, artistId, { strokeId: "line-2", points: [{ x: .2, y: .3 }] });
  rules.clearCanvas(room, artistId);
  assert.equal(room.game.strokes.length, 0);
});

test("错误答案公开，正确答案保密并按剩余时间给双方计分", () => {
  const room = makeRoom(3);
  const artistId = room.game.artistId;
  const guessers = room.players.filter((player) => player.id !== artistId);
  const answer = room.game.wordChoices[0].word;
  rules.selectWord(room, artistId, answer, 1_001_000);
  rules.submitGuess(room, guessers[0].id, "完全不对", 1_005_000);
  assert.equal(room.game.messages[0].text, "完全不对");
  rules.submitGuess(room, guessers[0].id, answer, 1_006_000);
  assert.equal(room.game.phase, "drawing");
  assert.equal(room.game.messages[1].text, "猜中了！");
  assert.equal(room.players.find((player) => player.id === artistId).score, 40);
  assert.equal(room.players.find((player) => player.id === guessers[0].id).score, 240);
  assert.equal(rules.publicRoom(room, guessers[1].id).game.word, undefined);
  rules.submitGuess(room, guessers[1].id, answer, 1_007_000);
  assert.equal(room.game.phase, "reveal");
  assert.equal(rules.publicRoom(room, guessers[1].id).game.word, answer);
});

test("超时自动选词、揭晓并完成全部轮次排名", () => {
  const room = makeRoom(2);
  for (let turn = 1; turn <= room.game.totalTurns; turn += 1) {
    assert.equal(room.game.phase, "choosing");
    rules.tick(room, room.game.deadline + 1);
    assert.equal(room.game.phase, "drawing");
    room.game.hintStage = 1;
    rules.tick(room, room.game.deadline + 1);
    assert.equal(room.game.phase, "reveal");
    rules.tick(room, room.game.deadline + 1);
  }
  assert.equal(room.game.status, "finished");
  assert.equal(room.game.phase, "finished");
  assert.equal(room.game.ranking.length, 2);
});
