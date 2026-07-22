const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/games/sky-landing/rules");

const players = [{ id: "captain", name: "大麓", connected: true }, { id: "first", name: "小莉", connected: true }];
const room = (random = () => 0.42) => ({ code: "SKY777", hostId: "captain", players: structuredClone(players), settings: rules.defaults(), game: rules.createGame(players, rules.defaults(), random) });
function roll(r) { rules.ready(r, "captain"); rules.ready(r, "first"); }
function setHand(game, role, values) { const id = game.playerByRole[role]; game.hands[id] = values.map((value, i) => ({ id: `${game.round}-${role}-test-${i}`, value })); }
function put(r, role, index, slotId, coffeeDelta = 0) { const id = r.game.playerByRole[role], die = r.game.hands[id][index]; rules.place(r, id, { dieId: die.id, slotId, coffeeDelta }); }

test("房主可选择岗位且航班严格分配一名机长和一名副驾驶", () => {
  const r = room();
  assert.equal(r.game.roleByPlayer.captain, "pilot");
  r.game = null; rules.configure(r, "captain", { hostRole: "copilot" });
  r.game = rules.createGame(r.players, r.settings, () => 0.2);
  assert.equal(r.game.roleByPlayer.captain, "copilot");
  assert.equal(r.game.roleByPlayer.first, "pilot");
});

test("双方确认简报后秘密掷四骰且只公开自己的结果", () => {
  const r = room(); roll(r);
  assert.equal(r.game.phase, "placing");
  assert.equal(r.game.actorId, r.game.playerByRole.pilot);
  const pilotView = rules.publicRoom(r, r.game.playerByRole.pilot).game;
  const copilotView = rules.publicRoom(r, r.game.playerByRole.copilot).game;
  assert.equal(pilotView.myDice.length, 4);
  assert.equal(copilotView.myDice.length, 4);
  assert.notDeepEqual(pilotView.myDice.map((die) => die.id), copilotView.myDice.map((die) => die.id));
  assert.equal(JSON.stringify(pilotView).includes(`${r.game.hands[r.game.playerByRole.copilot][0].id}`), false);
});

test("骰子严格交替放置并遵守岗位颜色与数字限制", () => {
  const r = room(); roll(r); setHand(r.game, "pilot", [1, 2, 3, 4]); setHand(r.game, "copilot", [1, 2, 3, 4]);
  put(r, "pilot", 0, "axis-pilot");
  assert.equal(r.game.actorId, r.game.playerByRole.copilot);
  assert.throws(() => put(r, "copilot", 0, "gear-0"), /不属于/);
  put(r, "copilot", 0, "axis-copilot");
  assert.throws(() => put(r, "pilot", 1, "brake-0"), /仅接受点数 2/);
});

test("轴线按双方骰差倾斜且达到红色极限立即尾旋失败", () => {
  const r = room(); roll(r); setHand(r.game, "pilot", [1, 2, 2, 2]); setHand(r.game, "copilot", [4, 2, 2, 2]);
  put(r, "pilot", 0, "axis-pilot"); put(r, "copilot", 0, "axis-copilot");
  assert.equal(r.game.status, "finished");
  assert.match(r.game.failureReason, /尾旋/);
});

test("引擎合计依据气动标记推进零一或两格并检查空中碰撞", () => {
  const r = room(); roll(r); setHand(r.game, "pilot", [3, 3, 2, 2]); setHand(r.game, "copilot", [3, 3, 2, 2]);
  put(r, "pilot", 0, "axis-pilot"); put(r, "copilot", 0, "axis-copilot");
  put(r, "pilot", 0, "engine-pilot"); put(r, "copilot", 0, "engine-copilot");
  assert.equal(r.game.approachPosition, 1);
  r.game.traffic[1] = 1; r.game.hands[r.game.playerByRole.pilot][0].value = 6; r.game.hands[r.game.playerByRole.copilot][0].value = 6;
  r.game.placements["engine-pilot"] = null; r.game.placements["engine-copilot"] = null; r.game.actorId = r.game.playerByRole.pilot;
  put(r, "pilot", 0, "engine-pilot"); put(r, "copilot", 0, "engine-copilot");
  assert.match(r.game.failureReason, /碰撞/);
});

test("无线电按相对距离清除一架飞机", () => {
  const r = room(); roll(r); setHand(r.game, "pilot", [3, 3, 2, 2]); setHand(r.game, "copilot", [3, 2, 2, 2]);
  put(r, "pilot", 0, "axis-pilot"); put(r, "copilot", 0, "axis-copilot");
  put(r, "pilot", 0, "radio-pilot");
  assert.equal(r.game.traffic[2], 0);
});

test("起落架、襟翼与刹车依规则改变速度阈值", () => {
  const r = room(); roll(r); setHand(r.game, "pilot", [3, 1, 2, 2]); setHand(r.game, "copilot", [3, 1, 2, 2]);
  put(r, "pilot", 0, "axis-pilot"); put(r, "copilot", 0, "axis-copilot");
  put(r, "pilot", 0, "gear-0"); put(r, "copilot", 0, "flap-0");
  put(r, "pilot", 0, "brake-0"); put(r, "copilot", 0, "coffee-0");
  assert.equal(r.game.aeroLow, 6); assert.equal(r.game.aeroHigh, 10); assert.equal(r.game.brakeValue, 3); assert.equal(r.game.coffee, 1);
});

test("咖啡可调整正在放置的骰子且不能超出1至6", () => {
  const r = room(); roll(r); r.game.coffee = 2; setHand(r.game, "pilot", [3, 2, 2, 2]); setHand(r.game, "copilot", [3, 2, 2, 2]);
  put(r, "pilot", 0, "axis-pilot", -2);
  assert.equal(r.game.placements["axis-pilot"].value, 1); assert.equal(r.game.coffee, 0);
  put(r, "copilot", 0, "axis-copilot");
});

test("一枚复骰标记让双方各自秘密选择任意剩余骰子重掷", () => {
  let n = 0; const r = room(() => (++n % 6) / 6); roll(r);
  const pilot = r.game.playerByRole.pilot, copilot = r.game.playerByRole.copilot;
  const pId = r.game.hands[pilot][0].id, cId = r.game.hands[copilot][1].id;
  const beforeP = r.game.hands[pilot][0].value, beforeC = r.game.hands[copilot][1].value;
  rules.startReroll(r, copilot); rules.submitReroll(r, pilot, { dieIds: [pId] });
  assert.equal(r.game.phase, "reroll"); assert.equal(rules.publicRoom(r, copilot).game.reroll.submitted[pilot], true);
  rules.submitReroll(r, copilot, { dieIds: [cId] });
  assert.equal(r.game.phase, "placing"); assert.notEqual(r.game.hands[pilot][0].value, beforeP); assert.notEqual(r.game.hands[copilot][1].value, beforeC);
});

test("可按基础规则完整飞行七轮并满足全部条件安全着陆", () => {
  const r = room(() => 0.4); r.game.traffic.fill(0);
  const pilotSpecial = [["gear-0", 1], ["gear-1", 3], ["gear-2", 5], ["brake-0", 2], ["brake-1", 4], ["radio-pilot", 1]];
  const copilotSpecial = [["flap-0", 1], ["flap-1", 2], ["flap-2", 4], ["flap-3", 5], ["radio-copilot-0", 1], ["radio-copilot-0", 1]];
  while (r.game.status === "playing") {
    roll(r);
    const final = r.game.finalRound, low = r.game.aeroLow;
    const pEngine = final ? 1 : Math.floor(low / 2), cEngine = final ? 2 : low - pEngine;
    const pSpecial = final ? ["gear-0", 1] : pilotSpecial[r.game.round - 1];
    const cSpecial = final ? ["radio-copilot-0", 1] : copilotSpecial[r.game.round - 1];
    setHand(r.game, "pilot", [3, pEngine, pSpecial[1], 2]);
    setHand(r.game, "copilot", [3, cEngine, cSpecial[1], 2]);
    const queues = {
      pilot: [["axis-pilot", 3], ["engine-pilot", pEngine], [pSpecial[0], pSpecial[1]], ["coffee-0", 2]],
      copilot: [["axis-copilot", 3], ["engine-copilot", cEngine], [cSpecial[0], cSpecial[1]], [final ? "radio-copilot-1" : "coffee-1", 2]]
    };
    const used = { pilot: 0, copilot: 0 };
    while (r.game.phase === "placing") {
      const role = r.game.roleByPlayer[r.game.actorId], [target] = queues[role][used[role]++];
      put(r, role, 0, target);
    }
  }
  assert.equal(r.game.result, "landed"); assert.equal(r.game.round, 7); assert.equal(r.game.approachPosition, 6);
});
