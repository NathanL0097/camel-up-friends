const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const rules = require("../src/games/avalon/rules");

const makePlayers = (count) => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `骑士${index + 1}`, connected: true }));
function makeRoom(count = 7, settings = { preset: "classic", lady: false }, random = () => 0.3719) {
  const players = makePlayers(count);
  return { code: "AVALON", hostId: players[0].id, players, settings, game: rules.createGame(players, settings, random) };
}
function ackAll(room) {
  for (const player of room.players.filter((item) => item.connected !== false)) {
    if (["vote-result", "quest-result"].includes(room.game.phase)) rules.ackEvent(room, player.id);
  }
}
function propose(room, team, approve = true) {
  const leader = room.game.actorId;
  for (const player of team) rules.toggleTeam(room, leader, { targetId: player.playerId || player });
  rules.proposeTeam(room, leader);
  for (const player of room.players) rules.vote(room, player.id, { choice: approve ? "approve" : "reject" });
  assert.equal(room.game.phase, "vote-result");
  ackAll(room);
}
function playQuest(room, failIds = []) {
  assert.equal(room.game.phase, "quest");
  for (const playerId of room.game.proposedTeam) rules.questCard(room, playerId, { choice: failIds.includes(playerId) ? "fail" : "success" });
  assert.equal(room.game.phase, "quest-result");
}

test("5至10人阵营数量与五项任务人数严格符合标准表", () => {
  const expected = {
    5: [3, 2, [2, 3, 2, 3, 3]], 6: [4, 2, [2, 3, 4, 3, 4]],
    7: [4, 3, [2, 3, 3, 4, 4]], 8: [5, 3, [3, 4, 4, 5, 5]],
    9: [6, 3, [3, 4, 4, 5, 5]], 10: [6, 4, [3, 4, 4, 5, 5]]
  };
  for (const [countText, [good, evil, quests]] of Object.entries(expected)) {
    const room = makeRoom(Number(countText));
    assert.equal(room.game.seats.filter((seat) => seat.side === "good").length, good);
    assert.equal(room.game.seats.filter((seat) => seat.side === "evil").length, evil);
    assert.deepEqual(room.game.questSizes, quests);
    assert.equal(room.game.seats.filter((seat) => seat.role.id === "merlin").length, 1);
    assert.equal(room.game.seats.filter((seat) => seat.role.id === "assassin").length, 1);
  }
});

test("房主可配置身份预设与湖中仙女，其他玩家不能修改", () => {
  const room = { hostId: "p1", settings: {}, game: null };
  rules.configure(room, "p1", { preset: "shadow", lady: true });
  assert.deepEqual(room.settings, { preset: "shadow", lady: true });
  assert.throws(() => rules.configure(room, "p2", { preset: "base" }), /只有房主/);
});

test("梅林、派西维尔、莫德雷德与奥伯伦只获得规则允许的情报", () => {
  const shadow = makeRoom(7, { preset: "shadow", lady: false });
  const merlin = shadow.game.seats.find((seat) => seat.role.id === "merlin");
  const mordred = shadow.game.seats.find((seat) => seat.role.id === "mordred");
  const merlinView = rules.publicRoom(shadow, merlin.playerId).game.you;
  assert.ok(!merlinView.knowledge.some((item) => item.playerId === mordred.playerId));
  assert.equal(merlinView.knowledge.length, shadow.game.seats.filter((seat) => seat.side === "evil").length - 1);

  const classic = makeRoom(7, { preset: "classic", lady: false });
  const percival = classic.game.seats.find((seat) => seat.role.id === "percival");
  const oberon = classic.game.seats.find((seat) => seat.role.id === "oberon");
  const percivalView = rules.publicRoom(classic, percival.playerId).game.you;
  assert.equal(percivalView.knowledge.length, 2);
  assert.deepEqual(new Set(percivalView.knowledge.map((item) => item.hint)), new Set(["梅林候选"]));
  assert.equal(rules.publicRoom(classic, oberon.playerId).game.you.knowledge.length, 0);
  for (const evil of classic.game.seats.filter((seat) => seat.side === "evil" && seat.role.id !== "oberon")) {
    assert.ok(!rules.publicRoom(classic, evil.playerId).game.you.knowledge.some((item) => item.playerId === oberon.playerId));
  }
});

test("组队必须人数准确，投票严格过半且平票视为否决", () => {
  const room = makeRoom(6);
  const leader = room.game.actorId;
  rules.toggleTeam(room, leader, { targetId: room.game.seats[0].playerId });
  assert.throws(() => rules.proposeTeam(room, leader), /正好2名/);
  rules.toggleTeam(room, leader, { targetId: room.game.seats[1].playerId });
  rules.proposeTeam(room, leader);
  room.players.forEach((player, index) => rules.vote(room, player.id, { choice: index < 3 ? "approve" : "reject" }));
  assert.equal(room.game.proposalHistory[0].accepted, false);
  assert.equal(room.game.rejectTrack, 1);
});

test("公开状态不会提前泄露身份、选票或匿名任务牌", () => {
  const room = makeRoom(7);
  const leader = room.game.actorId;
  const team = room.game.seats.slice(0, 2);
  team.forEach((player) => rules.toggleTeam(room, leader, { targetId: player.playerId }));
  rules.proposeTeam(room, leader);
  rules.vote(room, room.players[0].id, { choice: "reject" });
  const otherView = rules.publicRoom(room, room.players[1].id).game;
  assert.equal(otherView.seats[0].role, undefined);
  assert.equal(otherView.you.voteChoice, null);
  assert.equal(otherView.lastVoteResult, null);
  assert.equal(otherView.seats[0].voteSubmitted, true);
  room.players.slice(1).forEach((player) => rules.vote(room, player.id, { choice: "approve" }));
  ackAll(room);
  const evil = room.game.seats.find((seat) => seat.side === "evil");
  if (!room.game.proposedTeam.includes(evil.playerId)) {
    // The privacy assertion only needs one legitimate team submission; use an actual member.
    const member = room.game.proposedTeam[0];
    rules.questCard(room, member, { choice: "success" });
  } else rules.questCard(room, evil.playerId, { choice: "fail" });
  const spectator = room.game.seats.find((seat) => !room.game.proposedTeam.includes(seat.playerId));
  const questView = rules.publicRoom(room, spectator.playerId).game;
  assert.ok(!Object.prototype.hasOwnProperty.call(questView, "questCards"));
  assert.ok(questView.seats.some((seat) => seat.questSubmitted));
});

test("正义队员不能打失败牌，普通任务一张失败即告失败", () => {
  const room = makeRoom(7);
  const evil = room.game.seats.find((seat) => seat.side === "evil");
  const good = room.game.seats.find((seat) => seat.side === "good");
  propose(room, [evil, good]);
  assert.throws(() => rules.questCard(room, good.playerId, { choice: "fail" }), /只能让任务成功/);
  playQuest(room, [evil.playerId]);
  assert.equal(room.game.questHistory[0].success, false);
  assert.equal(room.game.evilScore, 1);
});

test("7人以上第4项任务必须至少两张失败才会失败", () => {
  const oneFail = makeRoom(7);
  oneFail.game.questIndex = 3;
  const teamA = [oneFail.game.seats.find((seat) => seat.side === "evil"), ...oneFail.game.seats.filter((seat) => seat.side === "good").slice(0, 3)];
  propose(oneFail, teamA);
  playQuest(oneFail, [teamA[0].playerId]);
  assert.equal(oneFail.game.questHistory[0].success, true);
  assert.equal(oneFail.game.questHistory[0].needsTwo, true);

  const twoFail = makeRoom(7);
  twoFail.game.questIndex = 3;
  const evil = twoFail.game.seats.filter((seat) => seat.side === "evil").slice(0, 2);
  const teamB = [...evil, ...twoFail.game.seats.filter((seat) => seat.side === "good").slice(0, 2)];
  propose(twoFail, teamB);
  playQuest(twoFail, evil.map((seat) => seat.playerId));
  assert.equal(twoFail.game.questHistory[0].success, false);
});

test("连续五支队伍被否决后邪恶立即获胜", () => {
  const room = makeRoom(5);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    propose(room, room.game.seats.slice(0, room.game.questSizes[room.game.questIndex]), false);
  }
  assert.equal(room.game.status, "finished");
  assert.equal(room.game.winner.side, "evil");
});

test("三次成功后必须经过刺杀，刺中梅林邪恶胜、刺错正义胜", () => {
  for (const hit of [true, false]) {
    const room = makeRoom(7, { preset: "base", lady: false });
    room.game.goodScore = 2;
    const goodTeam = room.game.seats.filter((seat) => seat.side === "good").slice(0, room.game.questSizes[0]);
    propose(room, goodTeam);
    playQuest(room);
    ackAll(room);
    assert.equal(room.game.phase, "assassination");
    const assassin = room.game.seats.find((seat) => seat.role.id === "assassin");
    const target = hit ? room.game.seats.find((seat) => seat.role.id === "merlin") : room.game.seats.find((seat) => seat.side === "good" && seat.role.id !== "merlin");
    rules.assassinate(room, assassin.playerId, { targetId: target.playerId });
    assert.equal(room.game.winner.side, hit ? "evil" : "good");
    assert.equal(rules.publicRoom(room, assassin.playerId).game.finalReveals.length, 7);
  }
});

test("湖中仙女只向持有者显示阵营并传给被查验者", () => {
  const room = makeRoom(7, { preset: "classic", lady: true });
  for (let mission = 0; mission < 2; mission += 1) {
    const team = room.game.seats.filter((seat) => seat.side === "good").slice(0, room.game.questSizes[room.game.questIndex]);
    propose(room, team);
    playQuest(room);
    ackAll(room);
  }
  assert.equal(room.game.phase, "lady");
  const holder = room.game.ladyHolderId;
  const target = room.game.seats.find((seat) => seat.playerId !== holder);
  rules.ladyInspect(room, holder, { targetId: target.playerId });
  assert.equal(rules.publicRoom(room, holder).game.you.ladyResult.side, target.side);
  const outsider = room.game.seats.find((seat) => ![holder, target.playerId].includes(seat.playerId));
  assert.equal(rules.publicRoom(room, outsider.playerId).game.you.ladyResult, null);
  rules.ackLady(room, holder);
  assert.equal(room.game.phase, "proposal");
  assert.equal(room.game.ladyHolderId, target.playerId);
});

function simulateGoodWin(count) {
  let seed = 700 + count;
  const random = () => ((seed = (seed * 48271) % 0x7fffffff) / 0x7fffffff);
  const room = makeRoom(count, { preset: "classic", lady: false }, random);
  let steps = 0;
  while (room.game.status === "playing" && steps < 100) {
    const game = room.game;
    if (game.phase === "proposal") {
      const team = game.seats.filter((seat) => seat.side === "good").slice(0, game.questSizes[game.questIndex]);
      propose(room, team);
    } else if (game.phase === "quest") {
      playQuest(room);
      ackAll(room);
    } else if (game.phase === "assassination") {
      const assassin = game.seats.find((seat) => seat.role.id === "assassin");
      const wrong = game.seats.find((seat) => seat.side === "good" && seat.role.id !== "merlin");
      rules.assassinate(room, assassin.playerId, { targetId: wrong.playerId });
    } else throw new Error(`无法处理阶段 ${game.phase}`);
    steps += 1;
  }
  assert.equal(room.game.status, "finished", `${count}人局不应卡在${room.game.phase}`);
  assert.equal(room.game.winner.side, "good");
}

test("资深玩家自动巡检：5至10人均能完整走完组队、任务与刺杀", () => {
  for (let count = 5; count <= 10; count += 1) simulateGoodWin(count);
});

test("手机端使用双列席位和固定私人身份区，不强制横屏", () => {
  const css = fs.readFileSync(path.join(__dirname, "../public/games/avalon.css"), "utf8");
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /\.av-seats\{grid-template-columns:repeat\(2/);
  assert.match(css, /\.av-private\{position:fixed/);
  assert.doesNotMatch(css, /min-width:\s*\d{4}px/);
});

test("结果确认期间有人断线时定时恢复不会让全桌永久卡住", () => {
  const room = makeRoom(5);
  propose(room, room.game.seats.slice(0, 2));
  playQuest(room);
  const disconnected = room.players[4];
  for (const player of room.players.slice(0, 4)) rules.ackEvent(room, player.id);
  assert.equal(room.game.phase, "quest-result");
  disconnected.connected = false;
  assert.equal(rules.tick(room), true);
  assert.equal(room.game.phase, "proposal");
});
