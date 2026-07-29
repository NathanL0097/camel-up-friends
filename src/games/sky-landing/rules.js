const ROLES = { pilot: { name: "机长", color: "blue" }, copilot: { name: "副驾驶", color: "orange" } };
const AIRPORTS = {
  yul: { id: "yul", code: "YUL", name: "蒙特利尔", runway: "06L", difficulty: "入门", altitude: 6000, airportIndex: 6, traffic: [0, 0, 1, 2, 1, 3, 2], rerollMarkers: [2000], eventChance: 0.15, events: ["headwind", "tailwind", "traffic"] },
  lhr: { id: "lhr", code: "LHR", name: "伦敦希思罗", runway: "27R", difficulty: "繁忙", altitude: 7000, airportIndex: 7, traffic: [0, 1, 2, 2, 3, 2, 3, 2], rerollMarkers: [4000, 2000], eventChance: 0.6, events: ["headwind", "traffic", "crosswind-left"] },
  hnd: { id: "hnd", code: "HND", name: "东京羽田", runway: "34L", difficulty: "进阶", altitude: 7000, airportIndex: 7, traffic: [0, 0, 1, 2, 2, 3, 2, 1], rerollMarkers: [3000], eventChance: 0.55, events: ["tailwind", "traffic", "crosswind-right"] },
  lis: { id: "lis", code: "LIS", name: "里斯本", runway: "03", difficulty: "侧风", altitude: 6000, airportIndex: 6, traffic: [0, 0, 1, 1, 2, 2, 1], rerollMarkers: [3000], eventChance: 0.7, events: ["crosswind-left", "crosswind-right", "headwind"] },
  hkg: { id: "hkg", code: "HKG", name: "香港赤鱲角", runway: "25R", difficulty: "专家", altitude: 7000, airportIndex: 7, traffic: [0, 1, 1, 2, 3, 3, 2, 2], rerollMarkers: [4000, 1000], eventChance: 0.7, events: ["traffic", "tailwind", "crosswind-right"] },
  osl: { id: "osl", code: "OSL", name: "奥斯陆", runway: "19R", difficulty: "寒冷", altitude: 6000, airportIndex: 6, traffic: [0, 0, 1, 2, 1, 2, 1], rerollMarkers: [3000, 1000], eventChance: 0.6, events: ["headwind", "crosswind-left", "traffic"] },
  cpt: { id: "cpt", code: "CPT", name: "开普敦", runway: "19", difficulty: "山风", altitude: 7000, airportIndex: 7, traffic: [0, 0, 1, 1, 2, 2, 2, 1], rerollMarkers: [3000], eventChance: 0.75, events: ["crosswind-left", "crosswind-right", "tailwind"] },
  sin: { id: "sin", code: "SIN", name: "新加坡樟宜", runway: "20C", difficulty: "雷雨", altitude: 6000, airportIndex: 6, traffic: [0, 1, 1, 2, 2, 3, 1], rerollMarkers: [3000, 1000], eventChance: 0.7, events: ["traffic", "headwind", "tailwind"] }
};
const AIRPORT_ORDER = Object.keys(AIRPORTS);
const EVENTS = {
  headwind: { id: "headwind", icon: "🌬", name: "强劲逆风", detail: "本轮引擎合计点数 −1", speedModifier: -1 },
  tailwind: { id: "tailwind", icon: "💨", name: "突发顺风", detail: "本轮引擎合计点数 +1", speedModifier: 1 },
  "crosswind-left": { id: "crosswind-left", icon: "↙", name: "左侧阵风", detail: "本轮轴线结算额外向左偏移1格", axisModifier: -1 },
  "crosswind-right": { id: "crosswind-right", icon: "↘", name: "右侧阵风", detail: "本轮轴线结算额外向右偏移1格", axisModifier: 1 },
  traffic: { id: "traffic", icon: "📡", name: "临时进场航班", detail: "航路前方新增1架等待飞机", addTraffic: true }
};
const MODULE_PRESETS = {
  basic: {
    id: "basic", name: "基础航班", detail: "标准驾驶舱与机场突发事件",
    trafficDie: false, turns: false, fuel: "none", interns: false, wind: false, engineSync: false,
    iceBrakes: false, alarms: false, totalTrust: false, turbulence: false, lowVisibility: false, realTime: false, engineOut: false
  },
  advanced: {
    id: "advanced", name: "进阶机组", detail: "交通骰、航向限制、燃油、风向、实习生与协同引擎",
    trafficDie: true, turns: true, fuel: "kerosene", interns: true, wind: true, engineSync: true,
    iceBrakes: false, alarms: false, totalTrust: false, turbulence: false, lowVisibility: false, realTime: false, engineOut: false
  },
  complete: {
    id: "complete", name: "全模块挑战", detail: "启用全部可兼容进阶模块与扩展挑战",
    trafficDie: true, turns: true, fuel: "leak", interns: true, wind: true, engineSync: true,
    iceBrakes: true, alarms: true, totalTrust: true, turbulence: true, lowVisibility: true, realTime: true, engineOut: false
  },
  glider: {
    id: "glider", name: "无动力滑翔", detail: "引擎失效；每轮固定推进，使用三颗骰子完成降落",
    trafficDie: true, turns: true, fuel: "none", interns: true, wind: true, engineSync: false,
    iceBrakes: false, alarms: true, totalTrust: true, turbulence: false, lowVisibility: true, realTime: false, engineOut: true
  }
};
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
  { id: "coffee-2", area: "coffee", role: null, label: "专注Ⅲ" },
  { id: "fuel-pilot", area: "fuel", role: "pilot", label: "机长燃油" },
  { id: "fuel-copilot", area: "fuel", role: "copilot", label: "副驾驶燃油" },
  { id: "intern-pilot", area: "intern", role: "pilot", label: "机长带教" },
  { id: "intern-copilot", area: "intern", role: "copilot", label: "副驾驶带教" },
  { id: "alarm-pilot", area: "alarm", role: "pilot", label: "机长复位" },
  { id: "alarm-copilot", area: "alarm", role: "copilot", label: "副驾驶复位" }
];

const slot = (id) => SLOT_DEFS.find((item) => item.id === id);
const otherRole = (role) => role === "pilot" ? "copilot" : "pilot";
const playerName = (room, id) => room.players.find((player) => player.id === id)?.name || "玩家";
const randomDie = (random) => Math.floor(random() * 6) + 1;
function record(game, type, details = {}) { game.eventSeq += 1; game.lastEvent = { seq: game.eventSeq, type, ...details }; }
function cleanPlayers(room) { return room.players.map(({ token: _token, ...player }) => player); }

function defaults() { return { hostRole: "pilot", airportId: "yul", modulePreset: "basic" }; }
function nextAirportAfter(airportId) {
  const index = AIRPORT_ORDER.indexOf(airportId);
  return AIRPORTS[AIRPORT_ORDER[(index < 0 ? 0 : index + 1) % AIRPORT_ORDER.length]];
}
function configure(room, playerId, payload = {}) {
  if (room.hostId !== playerId) throw new Error("只有房主可以选择座位");
  if (room.game) throw new Error("航班开始后不能更换座位");
  const hostRole = payload.hostRole || room.settings.hostRole || "pilot";
  const airportId = payload.airportId || room.settings.airportId || "yul";
  const modulePreset = payload.modulePreset || room.settings.modulePreset || "basic";
  if (!ROLES[hostRole]) throw new Error("请选择机长或副驾驶");
  if (!AIRPORTS[airportId]) throw new Error("请选择有效机场");
  if (!MODULE_PRESETS[modulePreset]) throw new Error("请选择有效的进阶模块方案");
  room.settings = { ...room.settings, hostRole, airportId, modulePreset };
}

function setRoundEvent(game) {
  game.speedModifier = 0; game.axisModifier = 0; game.activeEvent = null;
  const pool = game.airport.events || [];
  if (!pool.length || game.random() >= game.airport.eventChance) return;
  const event = EVENTS[pool[Math.floor(game.random() * pool.length)]];
  if (!event) return;
  game.speedModifier = event.speedModifier || 0; game.axisModifier = event.axisModifier || 0;
  game.activeEvent = { id: event.id, icon: event.icon, name: event.name, detail: event.detail };
  if (event.addTraffic) {
    const target = Math.min(game.airportIndex, game.approachPosition + 2);
    if (target >= game.approachPosition) {
      game.traffic[target] = (game.traffic[target] || 0) + 1;
      game.activeEvent.target = target;
    }
  }
  game.eventHistory.unshift({ round: game.round, ...game.activeEvent });
}

function prepareAdvancedRound(game) {
  const modules = game.modules;
  game.wind = modules.wind ? Math.floor(game.random() * 5) - 2 : 0;
  game.turnLimit = modules.turns && !game.finalRound
    ? (game.round % 3 === 0 ? { min: -1, max: 0, label: "左转航段" } : game.round % 3 === 1 ? { min: 0, max: 1, label: "右转航段" } : null)
    : null;
  if (modules.totalTrust && game.round > 1 && game.round % 4 === 0) game.turnLimit = "no-briefing";
  if (modules.trafficDie && game.random() < 0.55) {
    const distance = randomDie(game.random);
    const target = Math.min(game.airportIndex, game.approachPosition + distance - 1);
    game.traffic[target] = (game.traffic[target] || 0) + 1;
    game.log.unshift(`交通骰掷出${distance}：D-${game.airportIndex - target}新增一架飞机。`);
  }
  if (modules.alarms && !game.activeAlarm && game.round % 2 === 0) {
    const alarms = [
      { area: "radio", name: "无线电故障" }, { area: "flap", name: "襟翼警报" },
      { area: "gear", name: "起落架警报" }, { area: "brake", name: "刹车警报" },
      { area: "coffee", name: "专注系统警报" }
    ];
    const chosen = alarms[Math.floor(game.random() * alarms.length)];
    game.activeAlarm = { ...chosen, role: game.random() < 0.5 ? "pilot" : "copilot", value: randomDie(game.random) };
    game.alarmHistory.unshift({ round: game.round, ...game.activeAlarm });
  }
}

function rollDice(game, skipBriefing = false) {
  game.phase = "placing"; game.placements = {}; game.ready = []; game.hands = {};
  const count = game.modules.engineOut ? 3 : 4;
  for (const id of Object.keys(game.roleByPlayer)) {
    const role = game.roleByPlayer[id];
    game.hands[id] = Array.from({ length: count }, (_, index) => ({ id: `${game.round}-${role}-${index}`, value: randomDie(game.random) }));
  }
  game.visibleDice = game.modules.lowVisibility ? 2 : count;
  game.deadline = game.modules.realTime ? Date.now() + 60000 : null;
  const starterRole = game.round % 2 === 1 ? "pilot" : "copilot";
  game.actorId = game.playerByRole[starterRole];
  game.log.unshift(`${skipBriefing ? "完全信任航段：" : ""}第${game.round}轮骰子已经掷出，驾驶舱进入静默操作。`);
  record(game, "dice-rolled", { round: game.round, actorId: game.actorId, lowVisibility: game.modules.lowVisibility });
}

function createGame(players, settings = defaults(), random = Math.random) {
  if (players.length !== 2) throw new Error("协同降落严格需要2名玩家");
  const hostRole = ROLES[settings.hostRole] ? settings.hostRole : "pilot";
  const roleByPlayer = { [players[0].id]: hostRole, [players[1].id]: otherRole(hostRole) };
  const playerByRole = Object.fromEntries(Object.entries(roleByPlayer).map(([id, role]) => [role, id]));
  const airport = AIRPORTS[settings.airportId] || AIRPORTS.yul;
  const modules = { ...(MODULE_PRESETS[settings.modulePreset] || MODULE_PRESETS.basic) };
  const altitude = modules.lowVisibility ? Math.min(5000, airport.altitude) : airport.altitude;
  const game = {
    status: "playing", phase: "briefing", round: 1, altitude, maxAltitude: altitude, maxRounds: altitude / 1000 + 1, finalRound: false,
    airport: { ...airport, traffic: [...airport.traffic], events: [...airport.events], rerollMarkers: [...airport.rerollMarkers] },
    roleByPlayer, playerByRole, actorId: null, ready: [], hands: {}, placements: {},
    axis: 0, approachPosition: 0, airportIndex: airport.airportIndex, traffic: [...airport.traffic],
    gear: [false, false, false], flaps: [false, false, false, false], brakes: [false, false, false],
    aeroLow: 5, aeroHigh: 9, brakeValue: 2, coffee: 0, rerolls: 1, rerollMarkers: [...airport.rerollMarkers], reroll: null,
    speedModifier: 0, axisModifier: 0, activeEvent: null, eventHistory: [],
    modules, modulePreset: modules.id, fuel: modules.fuel === "none" ? null : 20, wind: 0,
    internsRemaining: modules.interns ? 3 : 0, internsTrained: 0, activeAlarm: null, alarmHistory: [],
    turnLimit: null, iceBrakePending: null, review: null, reviewReady: [], deadline: null,
    lastSpeed: null, eventSeq: 0, lastEvent: null, log: [`${airport.name}进近开始：${airport.altitude}英尺，驾驶舱可以进行首轮简报。`],
    random
  };
  if (modules.lowVisibility) game.rerolls = 0;
  setRoundEvent(game);
  prepareAdvancedRound(game);
  record(game, "flight-start", { round: 1, altitude, airportId: airport.id, modulePreset: modules.id });
  return game;
}

function requireGame(room, playerId) {
  const game = room.game;
  if (!game || game.status !== "playing") throw new Error("本次航班已经结束");
  if (!game.roleByPlayer[playerId]) throw new Error("你不在本次机组中");
  return game;
}
function queueReview(game, review) {
  game.phase = "review"; game.actorId = null; game.reviewReady = []; game.review = review;
  record(game, "round-review", { round: game.round, outcome: review.outcome, terminal: Boolean(review.terminal) });
}
function fail(room, reason, code = "failed") {
  const game = room.game;
  game.log.unshift(`待复盘：${reason}`);
  queueReview(game, { terminal: true, outcome: "failed", reason, code });
}
function succeed(room) {
  const game = room.game;
  game.log.unshift("着陆检查全部通过，等待机组完成复盘。");
  queueReview(game, { terminal: true, outcome: "landed", reason: "所有着陆条件均已满足。" });
}

function finishReview(room, playerId) {
  const game = requireGame(room, playerId);
  if (game.phase !== "review" || !game.review) throw new Error("当前没有待确认的回合复盘");
  if (!game.reviewReady.includes(playerId)) game.reviewReady.push(playerId);
  if (game.reviewReady.length < 2) return;
  const review = game.review;
  game.review = null; game.reviewReady = [];
  if (review.terminal) {
    game.status = "finished"; game.phase = "finished"; game.actorId = null; game.result = review.outcome;
    if (review.outcome === "failed") {
      game.failureReason = review.reason;
      game.log.unshift(`航班失败：${review.reason}`);
      record(game, "flight-failed", { reason: review.reason, code: review.code });
    } else {
      game.log.unshift("安全着陆！客舱响起掌声。");
      record(game, "landed", { round: game.round });
    }
    return;
  }
  game.round += 1;
  if (game.altitude === 0 && game.approachPosition === game.airportIndex) game.finalRound = true;
  if (game.modules.totalTrust && game.round % 4 === 0) {
    setRoundEvent(game); prepareAdvancedRound(game);
    return rollDice(game, true);
  }
  beginBriefing(game);
}

function continueFlight(room, playerId) {
  const game = room.game;
  if (room.hostId !== playerId) throw new Error("只有房主可以选择下一站");
  if (!game || game.status !== "finished" || game.result !== "landed") throw new Error("安全着陆后才能飞往下一站");
  const nextAirport = nextAirportAfter(game.airport.id);
  const completedAirports = [...new Set([...(room.settings.completedAirports || []), game.airport.id])];
  room.settings = { ...room.settings, airportId: nextAirport.id, completedAirports };
  room.game = createGame(room.players, room.settings);
  room.game.log.unshift(`机组完成转场准备，下一站：${nextAirport.code} ${nextAirport.name}。`);
  record(room.game, "journey-continued", {
    fromAirportId: game.airport.id,
    airportId: nextAirport.id,
    completedAirports: [...completedAirports]
  });
}

function ready(room, playerId) {
  const game = requireGame(room, playerId);
  if (game.phase !== "briefing") throw new Error("现在不是航前简报阶段");
  if (!game.ready.includes(playerId)) game.ready.push(playerId);
  if (game.ready.length < 2) return;
  rollDice(game);
}

function validateSlot(game, playerId, def, value) {
  const role = game.roleByPlayer[playerId];
  if (!def) throw new Error("驾驶舱中没有这个操作位");
  if (game.placements[def.id]) throw new Error("这个操作位本轮已经有骰子");
  if (def.role && def.role !== role) throw new Error("这个操作位不属于你的岗位");
  if (def.allowed && !(game.modules.iceBrakes && def.area === "brake") && !def.allowed.includes(value)) throw new Error(`这里仅接受点数 ${def.allowed.join("/")}`);
  if (game.modules.engineOut && def.area === "engine") throw new Error("本航班引擎失效，引擎操作位不可使用");
  if (game.modules.fuel === "leak" && def.area === "fuel") throw new Error("燃油泄漏时燃油操作位不可使用");
  if (!game.modules.interns && def.area === "intern") throw new Error("本航班没有实习生模块");
  if (def.area === "intern" && game.internsRemaining < 1) throw new Error("没有尚未带教的实习生");
  if (def.area === "alarm") {
    if (!game.activeAlarm) throw new Error("当前没有需要复位的警报");
    if (game.activeAlarm.role !== role || game.activeAlarm.value !== value) throw new Error(`警报需要${ROLES[game.activeAlarm.role].name}的${game.activeAlarm.value}点骰子`);
  } else if (game.activeAlarm?.area === def.area) throw new Error(`${game.activeAlarm.name}尚未复位，这个区域暂时不能使用`);
  if (game.modules.iceBrakes && def.area === "brake" && game.iceBrakePending && game.iceBrakePending.value !== value) {
    throw new Error(`结冰刹车第二颗骰子也必须是${game.iceBrakePending.value}点`);
  }
  const required = [`axis-${role}`, ...(game.modules.engineOut ? [] : [`engine-${role}`])].filter((id) => !game.placements[id]);
  const diceLeft = game.hands[playerId]?.length || 0;
  if (required.length && diceLeft <= required.length && !required.includes(def.id)) throw new Error("剩余骰子必须优先完成轴线与引擎强制操作");
  if (def.area === "flap" && !game.flaps[def.index]) {
    const next = game.flaps.findIndex((active) => !active);
    if (def.index !== next) throw new Error("襟翼必须从上到下依次展开");
  }
  if (def.area === "brake" && !game.modules.iceBrakes && !game.brakes[def.index]) {
    const next = game.brakes.findIndex((active) => !active);
    if (def.index !== next) throw new Error("刹车必须按照2、4、6依次启用");
  }
}

function resolveAxis(room) {
  const game = room.game, pilot = game.placements["axis-pilot"], copilot = game.placements["axis-copilot"];
  if (!pilot || !copilot) return;
  game.axis += copilot.value - pilot.value + (game.axisModifier || 0);
  if (Math.abs(game.axis) >= 3) return fail(room, "机身倾斜越过安全极限，飞机进入尾旋。", "spin");
  if (game.turnLimit && game.turnLimit !== "no-briefing" && (game.axis < game.turnLimit.min || game.axis > game.turnLimit.max)) {
    return fail(room, `${game.turnLimit.label}要求轴线保持在${game.turnLimit.min}至${game.turnLimit.max}之间。`, "turn-limit");
  }
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
  const speed = Math.max(0, pilot.value + copilot.value + (game.speedModifier || 0) + (game.wind || 0)); game.lastSpeed = speed;
  if (game.modules.engineSync && pilot.value === copilot.value && game.rerolls < 1) {
    game.rerolls += 1;
    game.log.unshift("协同引擎：两颗引擎骰点数相同，获得1枚复骰标记。");
    record(game, "engine-sync", { value: pilot.value, rerolls: game.rerolls });
  }
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
  if (def.area === "brake") {
    if (game.modules.iceBrakes) {
      if (!game.iceBrakePending) {
        game.iceBrakePending = { value, slotId: def.id };
        record(game, "ice-brake-armed", { value });
      } else {
        if (game.iceBrakePending.value !== value) throw new Error("结冰刹车必须在同一轮放置两颗相同点数的骰子");
        const next = game.brakes.findIndex((active) => !active);
        if (next >= 0) {
          game.brakes[next] = true; game.brakeValue = [3, 5, 7][next];
          record(game, "brake-set", { index: next, brakeValue: game.brakeValue, ice: true });
        }
        game.iceBrakePending = null;
      }
      return;
    }
    if (game.brakes[def.index]) return;
    game.brakes[def.index] = true; game.brakeValue = [3, 5, 7][def.index]; record(game, "brake-set", { index: def.index, brakeValue: game.brakeValue }); return;
  }
  if (def.area === "coffee" && game.coffee < 3) {
    game.coffee += 1; record(game, "coffee-made", { playerId, coffee: game.coffee });
  }
  if (def.area === "fuel" && game.fuel != null) {
    game.fuel = Math.max(0, game.fuel - value); record(game, "fuel-managed", { playerId, value, fuel: game.fuel }); return;
  }
  if (def.area === "intern") {
    game.internsRemaining -= 1; game.internsTrained += 1; game.rerolls += 1;
    record(game, "intern-trained", { playerId, remaining: game.internsRemaining, rerolls: game.rerolls }); return;
  }
  if (def.area === "alarm") {
    const alarm = game.activeAlarm; game.activeAlarm = null;
    record(game, "alarm-reset", { playerId, area: alarm.area, name: alarm.name }); return;
  }
}

function place(room, playerId, payload = {}) {
  const game = requireGame(room, playerId);
  if (game.phase !== "placing") throw new Error("现在不能放置骰子");
  if (game.deadline && Date.now() >= game.deadline) return fail(room, "60秒实时操作时间已耗尽，未放置的骰子被忽略。", "real-time");
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
  if (game.phase === "review" || game.status === "finished") return;
  if (game.modules.turbulence) {
    for (const dice of Object.values(game.hands)) for (const remainingDie of dice) remainingDie.value = randomDie(game.random);
    record(game, "turbulence-reroll", { playerId });
  }
  const remaining = Object.values(game.hands).reduce((sum, dice) => sum + dice.length, 0);
  if (remaining === 0) return endRound(room);
  game.actorId = game.playerByRole[otherRole(game.roleByPlayer[playerId])];
}

function checkTime(room, playerId) {
  const game = requireGame(room, playerId);
  if (game.phase !== "placing" || !game.deadline) throw new Error("当前没有实时倒计时");
  if (Date.now() >= game.deadline) fail(room, "60秒实时操作时间已耗尽，未放置的骰子被忽略。", "real-time");
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
  setRoundEvent(game);
  prepareAdvancedRound(game);
  game.log.unshift(`第${game.round}轮简报：当前高度${game.altitude || "着陆"}英尺。`);
  if (game.activeEvent) game.log.unshift(`突发事件「${game.activeEvent.name}」：${game.activeEvent.detail}`);
  record(game, "round-start", { round: game.round, altitude: game.altitude, finalRound: game.finalRound, activeEvent: game.activeEvent });
}
function evaluateLanding(room) {
  const game = room.game, problems = [];
  if (game.traffic.some((count) => count > 0)) problems.push("航路上仍有其他飞机");
  if (!game.gear.every(Boolean)) problems.push("起落架尚未全部放下");
  if (!game.flaps.every(Boolean)) problems.push("襟翼尚未全部展开");
  if (game.axis !== 0) problems.push("机身没有保持水平");
  if (!(game.lastSpeed < game.brakeValue)) problems.push(`着陆速度${game.lastSpeed}不低于刹车强度${game.brakeValue}`);
  if (game.modules.interns && game.internsRemaining > 0) problems.push(`仍有${game.internsRemaining}名实习生未完成带教`);
  if (game.fuel != null && game.fuel <= 0) problems.push("燃油已经耗尽");
  if (problems.length) fail(room, problems.join("；") + "。", "landing-check"); else succeed(room);
}
function endRound(room) {
  const game = room.game;
  const mandatory = ["axis-pilot", "axis-copilot", ...(game.modules.engineOut ? [] : ["engine-pilot", "engine-copilot"])];
  for (const id of mandatory) if (!game.placements[id]) return fail(room, `本轮没有完成全部${game.modules.engineOut ? "轴线" : "轴线与引擎"}强制操作。`, "mandatory");
  if (game.modules.iceBrakes && game.iceBrakePending) game.iceBrakePending = null;
  if (game.modules.fuel === "kerosene" && !game.placements["fuel-pilot"] && !game.placements["fuel-copilot"]) game.fuel -= 6;
  if (game.modules.fuel === "leak") {
    const p = game.placements["engine-pilot"]?.value || 0, c = game.placements["engine-copilot"]?.value || 0;
    game.fuel -= Math.abs(p - c) + 1;
  }
  if (game.fuel != null && game.fuel <= 0) return fail(room, "燃油耗尽，发动机停止工作。", "fuel-empty");
  if (game.modules.engineOut && !game.finalRound) advanceApproach(room, 1);
  if (game.phase === "review") return;
  if (game.finalRound) return evaluateLanding(room);
  game.altitude -= 1000;
  if (game.altitude === 0 && game.approachPosition < game.airportIndex) return fail(room, "高度已经耗尽，但飞机尚未抵达机场。", "short-landing");
  queueReview(game, {
    terminal: false, outcome: "continue",
    reason: `第${game.round}轮操作完成。请检查航路、轴线、设备与剩余资源，再共同进入下一轮。`
  });
}

function publicRoom(room, viewerId) {
  const players = cleanPlayers(room);
  if (!room.game) return { code: room.code, hostId: room.hostId, players, settings: room.settings, game: null };
  const game = room.game, fullHand = game.hands[viewerId] || [], myHand = game.modules.lowVisibility ? fullHand.slice(0, game.visibleDice || 2) : fullHand, nextAirport = nextAirportAfter(game.airport.id);
  return { code: room.code, hostId: room.hostId, players, settings: room.settings, game: {
    status: game.status, phase: game.phase, round: game.round, altitude: game.altitude, finalRound: game.finalRound,
    modules: game.modules, modulePreset: game.modulePreset,
    airport: game.airport, nextAirport: { id: nextAirport.id, code: nextAirport.code, name: nextAirport.name, runway: nextAirport.runway, difficulty: nextAirport.difficulty },
    completedAirports: [...(room.settings.completedAirports || [])], maxAltitude: game.maxAltitude, maxRounds: game.maxRounds, activeEvent: game.activeEvent, eventHistory: game.eventHistory.slice(0, 8), speedModifier: game.speedModifier, axisModifier: game.axisModifier,
    roleByPlayer: game.roleByPlayer, playerByRole: game.playerByRole, actorId: game.actorId, ready: [...game.ready],
    myDice: myHand.map((die) => ({ ...die })), diceCounts: Object.fromEntries(Object.keys(game.roleByPlayer).map((id) => [id, game.hands[id]?.length || 0])),
    placements: game.placements, axis: game.axis, approachPosition: game.approachPosition, airportIndex: game.airportIndex, traffic: [...game.traffic],
    gear: [...game.gear], flaps: [...game.flaps], brakes: [...game.brakes], aeroLow: game.aeroLow, aeroHigh: game.aeroHigh,
    brakeValue: game.brakeValue, coffee: game.coffee, rerolls: game.rerolls, rerollMarkers: [...game.rerollMarkers], lastSpeed: game.lastSpeed,
    fuel: game.fuel, wind: game.wind, turnLimit: game.turnLimit, internsRemaining: game.internsRemaining, internsTrained: game.internsTrained,
    activeAlarm: game.activeAlarm, alarmHistory: game.alarmHistory.slice(0, 8), iceBrakePending: game.iceBrakePending,
    review: game.review, reviewReady: [...game.reviewReady], deadline: game.deadline,
    reroll: game.reroll ? { submitted: Object.fromEntries(Object.keys(game.roleByPlayer).map((id) => [id, Boolean(game.reroll.submitted[id])])) } : null,
    slotDefs: SLOT_DEFS, eventSeq: game.eventSeq, lastEvent: game.lastEvent, log: game.log.slice(0, 35), result: game.result || null, failureReason: game.failureReason || null
  }};
}

module.exports = { defaults, configure, createGame, ready, place, checkTime, startReroll, submitReroll, finishReview, continueFlight, publicRoom, SLOT_DEFS, ROLES, AIRPORTS, AIRPORT_ORDER, EVENTS, MODULE_PRESETS, endRound };
