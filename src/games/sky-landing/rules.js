const ROLES = { pilot: { name: "机长", color: "blue" }, copilot: { name: "副驾驶", color: "orange" } };
const SLOT_DEFS = [
  { id: "axis-pilot", area: "axis", role: "pilot", label: "机长轴线", mandatory: true },
  { id: "axis-copilot", area: "axis", role: "copilot", label: "副驾驶轴线", mandatory: true },
  { id: "engine-pilot", area: "engine", role: "pilot", label: "机长引擎", mandatory: true },
  { id: "engine-copilot", area: "engine", role: "copilot", label: "副驾驶引擎", mandatory: true },
  { id: "radio-pilot", area: "radio", role: "pilot", label: "机长无线电" },
  { id: "radio-copilot-0", area: "radio", role: "copilot", label: "副驾驶无线电Ⅰ" },
  { id: "radio-copilot-1", area: "radio", role: "copilot", label: "副驾驶无线电Ⅱ" },
  { id: "gear-0", area: "gear", role: "pilot", label: "起落架 1/2", allowed: [1, 2], index: 0 },
  { id: "gear-1", area: "gear", role: "pilot", label: "起落架 3/4", allowed: [3, 4], index: 1 },
  { id: "gear-2", area: "gear", role: "pilot", label: "起落架 5/6", allowed: [5, 6], index: 2 },
  { id: "flap-0", area: "flap", role: "copilot", label: "襟翼 1/2", allowed: [1, 2], index: 0 },
  { id: "flap-1", area: "flap", role: "copilot", label: "襟翼 2/3", allowed: [2, 3], index: 1 },
  { id: "flap-2", area: "flap", role: "copilot", label: "襟翼 4/5", allowed: [4, 5], index: 2 },
  { id: "flap-3", area: "flap", role: "copilot", label: "襟翼 5/6", allowed: [5, 6], index: 3 },
  { id: "brake-0", area: "brake", role: "pilot", label: "刹车 2", allowed: [2], index: 0 },
  { id: "brake-1", area: "brake", role: "pilot", label: "刹车 4", allowed: [4], index: 1 },
  { id: "brake-2", area: "brake", role: "pilot", label: "刹车 6", allowed: [6], index: 2 },
  { id: "coffee-0", area: "coffee", role: null, label: "专注Ⅰ" },
  { id: "coffee-1", area: "coffee", role: null, label: "专注Ⅱ" },
  { id: "coffee-2", area: "coffee", role: null, label: "专注Ⅲ" }
];

const slot = (id) => SLOT_DEFS.find((item) => item.id === id);
const otherRole = (role) => role === "pilot" ? "copilot" : "pilot";
const playerName = (room, id) => room.players.find((player) => player.id === id)?.name || "玩家";
const randomDie = (random) => Math.floor(random() * 6) + 1;
function record(game, type, details = {}) { game.eventSeq += 1; game.lastEvent = { seq: game.eventSeq, type, ...details }; }
function cleanPlayers(room) { return room.players.map(({ token: _token, ...player }) => player); }

function defaults() { return { hostRole: "pilot" }; }
function configure(room, playerId, payload = {}) {
  if (room.hostId !== playerId) throw new Error("只有房主可以选择座位");
  if (room.game) throw new Error("航班开始后不能更换座位");
  if (!ROLES[payload.hostRole]) throw new Error("请选择机长或副驾驶");
  room.settings.hostRole = payload.hostRole;
}

function createGame(players, settings = defaults(), random = Math.random) {
  if (players.length !== 2) throw new Error("协同降落严格需要2名玩家");
  const hostRole = ROLES[settings.hostRole] ? settings.hostRole : "pilot";
  const roleByPlayer = { [players[0].id]: hostRole, [players[1].id]: otherRole(hostRole) };
  const playerByRole = Object.fromEntries(Object.entries(roleByPlayer).map(([id, role]) => [role, id]));
  const game = {
    status: "playing", phase: "briefing", round: 1, altitude: 6000, finalRound: false,
    roleByPlayer, playerByRole, actorId: null, ready: [], hands: {}, placements: {},
    axis: 0, approachPosition: 0, airportIndex: 6, traffic: [0, 0, 1, 2, 1, 3, 2],
    gear: [false, false, false], flaps: [false, false, false, false], brakes: [false, false, false],
    aeroLow: 5, aeroHigh: 9, brakeValue: 2, coffee: 0, rerolls: 1, rerollMarkers: [2000], reroll: null,
    lastSpeed: null, eventSeq: 0, lastEvent: null, log: ["蒙特利尔进近开始：6000英尺，驾驶舱可以进行首轮简报。"],
    random
  };
  record(game, "flight-start", { round: 1, altitude: 6000 });
  return game;
}

function requireGame(room, playerId) {
  const game = room.game;
  if (!game || game.status !== "playing") throw new Error("本次航班已经结束");
  if (!game.roleByPlayer[playerId]) throw new Error("你不在本次机组中");
  return game;
}
function fail(room, reason, code = "failed") {
  const game = room.game;
  game.status = "finished"; game.phase = "finished"; game.actorId = null; game.result = "failed"; game.failureReason = reason;
  game.log.unshift(`航班失败：${reason}`); record(game, "flight-failed", { reason, code });
}
function succeed(room) {
  const game = room.game;
  game.status = "finished"; game.phase = "finished"; game.actorId = null; game.result = "landed";
  game.log.unshift("安全着陆！客舱响起掌声。"); record(game, "landed", { round: game.round });
}

function ready(room, playerId) {
  const game = requireGame(room, playerId);
  if (game.phase !== "briefing") throw new Error("现在不是航前简报阶段");
  if (!game.ready.includes(playerId)) game.ready.push(playerId);
  if (game.ready.length < 2) return;
  game.phase = "placing"; game.placements = {}; game.ready = []; game.hands = {};
  for (const id of Object.keys(game.roleByPlayer)) {
    const role = game.roleByPlayer[id];
    game.hands[id] = Array.from({ length: 4 }, (_, index) => ({ id: `${game.round}-${role}-${index}`, value: randomDie(game.random) }));
  }
  const starterRole = game.round % 2 === 1 ? "pilot" : "copilot";
  game.actorId = game.playerByRole[starterRole];
  game.log.unshift(`第${game.round}轮骰子已经掷出，驾驶舱进入静默操作。`);
  record(game, "dice-rolled", { round: game.round, actorId: game.actorId });
}

function validateSlot(game, playerId, def, value) {
  const role = game.roleByPlayer[playerId];
  if (!def) throw new Error("驾驶舱中没有这个操作位");
  if (game.placements[def.id]) throw new Error("这个操作位本轮已经有骰子");
  if (def.role && def.role !== role) throw new Error("这个操作位不属于你的岗位");
  if (def.allowed && !def.allowed.includes(value)) throw new Error(`这里仅接受点数 ${def.allowed.join("/")}`);
  if (def.area === "flap" && !game.flaps[def.index]) {
    const next = game.flaps.findIndex((active) => !active);
    if (def.index !== next) throw new Error("襟翼必须从上到下依次展开");
  }
  if (def.area === "brake" && !game.brakes[def.index]) {
    const next = game.brakes.findIndex((active) => !active);
    if (def.index !== next) throw new Error("刹车必须按照2、4、6依次启用");
  }
}

function resolveAxis(room) {
  const game = room.game, pilot = game.placements["axis-pilot"], copilot = game.placements["axis-copilot"];
  if (!pilot || !copilot) return;
  game.axis += copilot.value - pilot.value;
  if (Math.abs(game.axis) >= 3) return fail(room, "机身倾斜越过安全极限，飞机进入尾旋。", "spin");
}
function advanceApproach(room, steps) {
  const game = room.game, from = game.approachPosition;
  for (let i = 0; i < steps; i += 1) {
    if (game.traffic[game.approachPosition] > 0) return fail(room, "航路正前方仍有其他飞机，发生空中碰撞。", "collision");
    if (game.approachPosition >= game.airportIndex) return fail(room, "速度过快，飞机冲过了机场。", "overshoot");
    game.approachPosition += 1;
  }
  if (steps) record(game, "approach-moved", { from, to: game.approachPosition, steps });
}
function resolveEngine(room) {
  const game = room.game, pilot = game.placements["engine-pilot"], copilot = game.placements["engine-copilot"];
  if (!pilot || !copilot) return;
  const speed = pilot.value + copilot.value; game.lastSpeed = speed;
  if (game.finalRound) return record(game, "landing-speed", { speed, brakeValue: game.brakeValue });
  const steps = speed < game.aeroLow ? 0 : speed < game.aeroHigh ? 1 : 2;
  record(game, "engine-resolved", { speed, steps });
  advanceApproach(room, steps);
}
function resolveArea(room, def, playerId) {
  const game = room.game, placed = game.placements[def.id], value = placed.value;
  if (def.area === "axis") return resolveAxis(room);
  if (def.area === "engine") return resolveEngine(room);
  if (def.area === "radio") {
    const target = game.approachPosition + value - 1;
    if (target <= game.airportIndex && game.traffic[target] > 0) {
      game.traffic[target] -= 1; game.log.unshift(`${ROLES[game.roleByPlayer[playerId]].name}通过无线电清除了一架航路飞机。`);
      record(game, "traffic-cleared", { playerId, target, value });
    }
    return;
  }
  if (def.area === "gear" && !game.gear[def.index]) {
    game.gear[def.index] = true; game.aeroLow += 1; record(game, "gear-down", { index: def.index, aeroLow: game.aeroLow }); return;
  }
  if (def.area === "flap" && !game.flaps[def.index]) {
    game.flaps[def.index] = true; game.aeroHigh += 1; record(game, "flap-down", { index: def.index, aeroHigh: game.aeroHigh }); return;
  }
  if (def.area === "brake" && !game.brakes[def.index]) {
    game.brakes[def.index] = true; game.brakeValue = [3, 5, 7][def.index]; record(game, "brake-set", { index: def.index, brakeValue: game.brakeValue }); return;
  }
  if (def.area === "coffee" && game.coffee < 3) {
    game.coffee += 1; record(game, "coffee-made", { playerId, coffee: game.coffee });
  }
}

function place(room, playerId, payload = {}) {
  const game = requireGame(room, playerId);
  if (game.phase !== "placing") throw new Error("现在不能放置骰子");
  if (game.actorId !== playerId) throw new Error("请等待搭档完成操作");
  const hand = game.hands[playerId] || [], dieIndex = hand.findIndex((die) => die.id === payload.dieId);
  if (dieIndex < 0) throw new Error("这颗骰子不在你的剩余骰子中");
  const die = hand[dieIndex], delta = Number(payload.coffeeDelta || 0);
  if (!Number.isInteger(delta) || Math.abs(delta) > game.coffee) throw new Error("咖啡标记不足");
  const value = die.value + delta;
  if (value < 1 || value > 6) throw new Error("骰子只能调整到1至6点");
  const def = slot(payload.slotId); validateSlot(game, playerId, def, value);
  if (delta) game.coffee -= Math.abs(delta);
  hand.splice(dieIndex, 1);
  game.placements[def.id] = { playerId, role: game.roleByPlayer[playerId], original: die.value, value, coffeeDelta: delta };
  game.log.unshift(`${ROLES[game.roleByPlayer[playerId]].name}将一颗${value}点骰子放到「${def.label}」。`);
  record(game, "die-placed", { playerId, role: game.roleByPlayer[playerId], slotId: def.id, area: def.area, value });
  resolveArea(room, def, playerId);
  if (game.status === "finished") return;
  const remaining = Object.values(game.hands).reduce((sum, dice) => sum + dice.length, 0);
  if (remaining === 0) return endRound(room);
  game.actorId = game.playerByRole[otherRole(game.roleByPlayer[playerId])];
}

function startReroll(room, playerId) {
  const game = requireGame(room, playerId);
  if (game.phase !== "placing") throw new Error("现在不能启用复骰");
  if (game.rerolls < 1) throw new Error("已经没有复骰标记");
  game.rerolls -= 1; game.phase = "reroll"; game.reroll = { returnActorId: game.actorId, submitted: {} };
  record(game, "reroll-started", { playerId });
}
function submitReroll(room, playerId, payload = {}) {
  const game = requireGame(room, playerId);
  if (game.phase !== "reroll" || !game.reroll) throw new Error("当前没有复骰流程");
  if (game.reroll.submitted[playerId]) throw new Error("你已经确认复骰选择");
  const hand = game.hands[playerId] || [], ids = [...new Set(Array.isArray(payload.dieIds) ? payload.dieIds : [])];
  if (ids.some((id) => !hand.some((die) => die.id === id))) throw new Error("只能重掷自己尚未放置的骰子");
  game.reroll.submitted[playerId] = ids;
  if (Object.keys(game.reroll.submitted).length < 2) return;
  for (const [id, selected] of Object.entries(game.reroll.submitted)) for (const die of game.hands[id]) if (selected.includes(die.id)) die.value = randomDie(game.random);
  const actorId = game.reroll.returnActorId; game.reroll = null; game.phase = "placing"; game.actorId = actorId;
  game.log.unshift("机组完成协同复骰，继续静默操作。"); record(game, "rerolled", { actorId });
}

function beginBriefing(game) {
  game.phase = "briefing"; game.actorId = null; game.ready = []; game.hands = {}; game.placements = {}; game.lastSpeed = null;
  const markerIndex = game.rerollMarkers.indexOf(game.altitude);
  if (markerIndex >= 0) { game.rerolls += 1; game.rerollMarkers.splice(markerIndex, 1); }
  game.log.unshift(`第${game.round}轮简报：当前高度${game.altitude || "着陆"}英尺。`);
  record(game, "round-start", { round: game.round, altitude: game.altitude, finalRound: game.finalRound });
}
function evaluateLanding(room) {
  const game = room.game, problems = [];
  if (game.traffic.some((count) => count > 0)) problems.push("航路上仍有其他飞机");
  if (!game.gear.every(Boolean)) problems.push("起落架尚未全部放下");
  if (!game.flaps.every(Boolean)) problems.push("襟翼尚未全部展开");
  if (game.axis !== 0) problems.push("机身没有保持水平");
  if (!(game.lastSpeed < game.brakeValue)) problems.push(`着陆速度${game.lastSpeed}不低于刹车强度${game.brakeValue}`);
  if (problems.length) fail(room, problems.join("；") + "。", "landing-check"); else succeed(room);
}
function endRound(room) {
  const game = room.game;
  for (const id of ["axis-pilot", "axis-copilot", "engine-pilot", "engine-copilot"]) if (!game.placements[id]) return fail(room, "本轮没有同时完成轴线与引擎两项强制操作。", "mandatory");
  if (game.finalRound) return evaluateLanding(room);
  game.altitude -= 1000;
  if (game.altitude === 0 && game.approachPosition < game.airportIndex) return fail(room, "高度已经耗尽，但飞机尚未抵达机场。", "short-landing");
  game.round += 1;
  if (game.altitude === 0 && game.approachPosition === game.airportIndex) game.finalRound = true;
  beginBriefing(game);
}

function publicRoom(room, viewerId) {
  const players = cleanPlayers(room);
  if (!room.game) return { code: room.code, hostId: room.hostId, players, settings: room.settings, game: null };
  const game = room.game, myHand = game.hands[viewerId] || [];
  return { code: room.code, hostId: room.hostId, players, settings: room.settings, game: {
    status: game.status, phase: game.phase, round: game.round, altitude: game.altitude, finalRound: game.finalRound,
    roleByPlayer: game.roleByPlayer, playerByRole: game.playerByRole, actorId: game.actorId, ready: [...game.ready],
    myDice: myHand.map((die) => ({ ...die })), diceCounts: Object.fromEntries(Object.keys(game.roleByPlayer).map((id) => [id, game.hands[id]?.length || 0])),
    placements: game.placements, axis: game.axis, approachPosition: game.approachPosition, airportIndex: game.airportIndex, traffic: [...game.traffic],
    gear: [...game.gear], flaps: [...game.flaps], brakes: [...game.brakes], aeroLow: game.aeroLow, aeroHigh: game.aeroHigh,
    brakeValue: game.brakeValue, coffee: game.coffee, rerolls: game.rerolls, rerollMarkers: [...game.rerollMarkers], lastSpeed: game.lastSpeed,
    reroll: game.reroll ? { submitted: Object.fromEntries(Object.keys(game.roleByPlayer).map((id) => [id, Boolean(game.reroll.submitted[id])])) } : null,
    slotDefs: SLOT_DEFS, eventSeq: game.eventSeq, lastEvent: game.lastEvent, log: game.log.slice(0, 35), result: game.result || null, failureReason: game.failureReason || null
  }};
}

module.exports = { defaults, configure, createGame, ready, place, startReroll, submitReroll, publicRoom, SLOT_DEFS, ROLES, endRound };
