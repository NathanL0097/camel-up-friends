const { PLAYER_COUNTS, ROLES, PRESETS, roleIdsFor } = require("./data");

const clone = (value) => JSON.parse(JSON.stringify(value));
const defaults = () => ({ preset: "classic", lady: false });

function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function configure(room, playerId, payload = {}) {
  if (room.hostId !== playerId) throw new Error("只有房主可以修改阿瓦隆规则");
  if (room.game) throw new Error("游戏已经开始");
  const preset = PRESETS[payload.preset] ? payload.preset : "classic";
  room.settings = { preset, lady: Boolean(payload.lady) };
}

function seat(game, playerId) {
  const found = game.seats.find((item) => item.playerId === playerId);
  if (!found) throw new Error("你不在圆桌议会中");
  return found;
}
function nameOf(game, playerId) { return seat(game, playerId).playerName; }
function rotateLeader(game) {
  game.leaderIndex = (game.leaderIndex + 1) % game.seats.length;
  game.actorId = game.seats[game.leaderIndex].playerId;
}
function addLog(game, text) {
  game.log.unshift(text);
  game.log = game.log.slice(0, 30);
}
function emit(game, type, title, detail, extra = {}) {
  game.eventSeq += 1;
  game.lastEvent = { seq: game.eventSeq, type, title, detail, ...extra };
  addLog(game, `${title}：${detail}`);
}
function finish(game, side, title, detail) {
  game.status = "finished";
  game.phase = "result";
  game.actorId = null;
  game.winner = { side, title, detail };
  emit(game, "game-finished", title, detail);
}

function knowledgeFor(game, viewer) {
  if (viewer.role.id === "merlin") {
    return game.seats.filter((item) => item.side === "evil" && item.role.id !== "mordred")
      .map((item) => ({ playerId: item.playerId, playerName: item.playerName, hint: "邪恶气息" }));
  }
  if (viewer.role.id === "percival") {
    return game.seats.filter((item) => ["merlin", "morgana"].includes(item.role.id))
      .map((item) => ({ playerId: item.playerId, playerName: item.playerName, hint: "梅林候选" }));
  }
  if (viewer.side === "evil" && viewer.role.id !== "oberon") {
    return game.seats.filter((item) => item.side === "evil" && item.playerId !== viewer.playerId && item.role.id !== "oberon")
      .map((item) => ({ playerId: item.playerId, playerName: item.playerName, hint: "邪恶同伴" }));
  }
  return [];
}

function createGame(players, settings = {}, random = Math.random) {
  const config = PLAYER_COUNTS[players.length];
  if (!config) throw new Error("阿瓦隆标准局需要5至10名玩家");
  const preset = PRESETS[settings.preset] ? settings.preset : "classic";
  const roleIds = shuffle(roleIdsFor(players.length, preset), random);
  const seats = players.map((player, index) => {
    const role = clone(ROLES[roleIds[index]]);
    return { playerId: player.id, playerName: player.name, role, side: role.side };
  });
  const leaderIndex = Math.floor(random() * players.length);
  const ladyEnabled = Boolean(settings.lady && players.length >= 7);
  const game = {
    status: "playing", phase: "proposal", seats, preset, ladyEnabled,
    questIndex: 0, questSizes: [...config.quests], goodScore: 0, evilScore: 0,
    leaderIndex, actorId: seats[leaderIndex].playerId, selectedTeam: [], proposedTeam: [],
    rejectTrack: 0, votes: {}, questCards: {}, eventAcks: [], pendingAfterEvent: null,
    proposalHistory: [], questHistory: [], ladyHolderId: ladyEnabled ? seats[(leaderIndex - 1 + seats.length) % seats.length].playerId : null,
    ladyPastHolders: [], ladyResult: null, winner: null, eventSeq: 0, lastEvent: null, log: [],
    startedAt: Date.now(), random
  };
  emit(game, "council-open", "圆桌议会召开", `首领是${nameOf(game, game.actorId)}，第一项任务需要${config.quests[0]}名骑士。`);
  return game;
}

function requirePlaying(room, playerId) {
  const game = room.game;
  if (!game || game.status !== "playing") throw new Error("本局已经结束");
  return { game, player: seat(game, playerId) };
}
function requirePhase(game, phase, playerId) {
  if (game.phase !== phase) throw new Error("当前阶段不能执行这个操作");
  if (playerId && game.actorId !== playerId) throw new Error("现在不是你的行动");
}

function toggleTeam(room, playerId, payload = {}) {
  const { game } = requirePlaying(room, playerId);
  requirePhase(game, "proposal", playerId);
  const targetId = String(payload.targetId || "");
  seat(game, targetId);
  const selected = new Set(game.selectedTeam);
  if (selected.has(targetId)) selected.delete(targetId);
  else {
    if (selected.size >= game.questSizes[game.questIndex]) throw new Error(`本次只能选择${game.questSizes[game.questIndex]}人`);
    selected.add(targetId);
  }
  game.selectedTeam = [...selected];
}

function proposeTeam(room, playerId) {
  const { game } = requirePlaying(room, playerId);
  requirePhase(game, "proposal", playerId);
  const required = game.questSizes[game.questIndex];
  if (game.selectedTeam.length !== required) throw new Error(`必须选择正好${required}名任务成员`);
  game.proposedTeam = [...game.selectedTeam];
  game.selectedTeam = [];
  game.votes = {};
  game.phase = "voting";
  game.actorId = null;
  emit(game, "team-proposed", "首领提交远征队", `${nameOf(game, playerId)}提议由${game.proposedTeam.map((id) => nameOf(game, id)).join("、")}执行任务。`);
}

function vote(room, playerId, payload = {}) {
  const { game } = requirePlaying(room, playerId);
  requirePhase(game, "voting");
  if (game.votes[playerId]) throw new Error("你已经投过票");
  const choice = payload.choice === "approve" ? "approve" : payload.choice === "reject" ? "reject" : null;
  if (!choice) throw new Error("请选择赞成或反对");
  game.votes[playerId] = choice;
  if (Object.keys(game.votes).length === game.seats.length) resolveVote(game);
}

function resolveVote(game) {
  const approvals = Object.values(game.votes).filter((choice) => choice === "approve").length;
  const accepted = approvals > game.seats.length / 2;
  if (accepted) game.rejectTrack = 0;
  else game.rejectTrack += 1;
  const history = {
    quest: game.questIndex + 1, attempt: game.proposalHistory.filter((item) => item.quest === game.questIndex + 1).length + 1,
    leaderId: game.seats[game.leaderIndex].playerId, team: [...game.proposedTeam], votes: clone(game.votes), accepted
  };
  game.proposalHistory.push(history);
  game.phase = "vote-result";
  game.actorId = null;
  game.eventAcks = [];
  game.pendingAfterEvent = accepted ? "quest" : game.rejectTrack >= 5 ? "five-rejects" : "next-proposal";
  emit(game, accepted ? "vote-approved" : "vote-rejected", accepted ? "远征队获准出发" : "圆桌否决了队伍",
    `${approvals}票赞成，${game.seats.length - approvals}票反对。${!accepted && game.rejectTrack < 5 ? `连续否决轨来到${game.rejectTrack}/5。` : ""}`,
    { accepted, approvals });
}

function questCard(room, playerId, payload = {}) {
  const { game, player } = requirePlaying(room, playerId);
  requirePhase(game, "quest");
  if (!game.proposedTeam.includes(playerId)) throw new Error("你不在本次任务队伍中");
  if (game.questCards[playerId]) throw new Error("你已经秘密提交任务牌");
  const choice = payload.choice === "fail" ? "fail" : payload.choice === "success" ? "success" : null;
  if (!choice) throw new Error("请选择任务牌");
  if (player.side === "good" && choice === "fail") throw new Error("正义阵营只能让任务成功");
  game.questCards[playerId] = choice;
  if (Object.keys(game.questCards).length === game.proposedTeam.length) resolveQuest(game);
}

function resolveQuest(game) {
  const shuffled = shuffle(Object.values(game.questCards), game.random);
  const failCount = shuffled.filter((choice) => choice === "fail").length;
  const needsTwo = game.seats.length >= 7 && game.questIndex === 3;
  const success = failCount < (needsTwo ? 2 : 1);
  if (success) game.goodScore += 1;
  else game.evilScore += 1;
  game.questHistory.push({ quest: game.questIndex + 1, team: [...game.proposedTeam], failCount, success, needsTwo });
  game.phase = "quest-result";
  game.actorId = null;
  game.eventAcks = [];
  if (game.goodScore >= 3) game.pendingAfterEvent = "assassination";
  else if (game.evilScore >= 3) game.pendingAfterEvent = "evil-wins";
  else if (game.ladyEnabled && [1, 2, 3].includes(game.questIndex) && ladyTargets(game).length) game.pendingAfterEvent = "lady";
  else game.pendingAfterEvent = "next-quest";
  emit(game, success ? "quest-success" : "quest-fail", success ? "圣杯之路被照亮" : "远征遭到暗中破坏",
    `${game.proposedTeam.length}张任务牌已充分洗混：${failCount}张失败。${needsTwo ? "本项任务需要至少2张失败才会失败。" : ""}`,
    { success, failCount, needsTwo });
}

function connectedAckIds(room) {
  const connected = room.players.filter((player) => player.connected !== false).map((player) => player.id);
  return connected.length ? connected : room.game.seats.map((player) => player.playerId);
}
function ackEvent(room, playerId) {
  const { game } = requirePlaying(room, playerId);
  if (!["vote-result", "quest-result"].includes(game.phase)) throw new Error("当前没有需要确认的公开结果");
  if (!game.eventAcks.includes(playerId)) game.eventAcks.push(playerId);
  if (connectedAckIds(room).every((id) => game.eventAcks.includes(id))) continueAfterEvent(game);
}

function continueAfterEvent(game) {
  const next = game.pendingAfterEvent;
  game.pendingAfterEvent = null;
  game.eventAcks = [];
  if (next === "quest") {
    game.phase = "quest";
    game.questCards = {};
    emit(game, "quest-begins", "远征队踏入迷雾", "队员分别秘密选择任务成功或失败；正义骑士只能选择成功。");
    return;
  }
  if (next === "five-rejects") return finish(game, "evil", "邪恶笼罩圆桌", "连续五支队伍被否决，任务无法出发，莫德雷德阵营获胜。");
  if (next === "next-proposal") {
    rotateLeader(game);
    beginProposal(game, false);
    return;
  }
  if (next === "assassination") {
    game.phase = "assassination";
    game.actorId = game.seats.find((item) => item.role.id === "assassin").playerId;
    emit(game, "assassination", "三项任务已经成功", "正义尚未真正获胜。邪恶阵营可以讨论，刺客必须指出谁是梅林。")
    return;
  }
  if (next === "evil-wins") return finish(game, "evil", "远征彻底失败", "三项任务遭到破坏，莫德雷德的爪牙控制了阿瓦隆。");
  rotateLeader(game);
  game.questIndex += 1;
  if (next === "lady") {
    game.phase = "lady";
    game.actorId = game.ladyHolderId;
    game.ladyResult = null;
    emit(game, "lady", "湖中仙女睁开双眼", `${nameOf(game, game.ladyHolderId)}可以秘密查验一名从未持有过湖中仙女的玩家阵营。`);
  } else beginProposal(game, true);
}

function beginProposal(game, missionAdvanced) {
  game.phase = "proposal";
  game.actorId = game.seats[game.leaderIndex].playerId;
  game.selectedTeam = [];
  game.proposedTeam = [];
  game.votes = {};
  game.questCards = {};
  const lead = nameOf(game, game.actorId);
  emit(game, missionAdvanced ? "next-quest" : "new-leader", missionAdvanced ? `第${game.questIndex + 1}项任务` : "首领令牌传递",
    `${lead}成为首领，需要选择${game.questSizes[game.questIndex]}名队员。`);
}

function ladyTargets(game) {
  return game.seats.filter((item) => item.playerId !== game.ladyHolderId && !game.ladyPastHolders.includes(item.playerId));
}
function ladyInspect(room, playerId, payload = {}) {
  const { game } = requirePlaying(room, playerId);
  requirePhase(game, "lady", playerId);
  const targetId = String(payload.targetId || "");
  if (!ladyTargets(game).some((item) => item.playerId === targetId)) throw new Error("这名玩家不能被湖中仙女再次查验");
  const target = seat(game, targetId);
  game.ladyPastHolders.push(playerId);
  game.ladyResult = { viewerId: playerId, targetId, side: target.side };
  game.ladyHolderId = targetId;
  game.phase = "lady-result";
  emit(game, "lady-result", "湖水映出忠诚", `${nameOf(game, playerId)}已经秘密看见${target.playerName}的阵营，湖中仙女标记随即交给被查验者。`);
}
function ackLady(room, playerId) {
  const { game } = requirePlaying(room, playerId);
  if (game.phase !== "lady-result" || game.ladyResult?.viewerId !== playerId) throw new Error("没有需要你确认的湖中仙女结果");
  game.ladyResult = null;
  beginProposal(game, true);
}

function assassinate(room, playerId, payload = {}) {
  const { game } = requirePlaying(room, playerId);
  requirePhase(game, "assassination", playerId);
  const targetId = String(payload.targetId || "");
  if (targetId === playerId) throw new Error("刺客不能选择自己");
  const target = seat(game, targetId);
  game.assassinationTargetId = targetId;
  if (target.role.id === "merlin") finish(game, "evil", "梅林倒在暗影之中", `${target.playerName}正是梅林。刺客完成了最后一击，邪恶阵营逆转获胜。`);
  else finish(game, "good", "梅林安然走出迷雾", `${target.playerName}并不是梅林。三项任务已经完成，亚瑟忠臣守住了阿瓦隆。`);
}

function tick(room) {
  const game = room.game;
  if (!game || game.status !== "playing" || !["vote-result", "quest-result"].includes(game.phase)) return false;
  if (!connectedAckIds(room).every((id) => game.eventAcks.includes(id))) return false;
  continueAfterEvent(game);
  return true;
}

function publicRoom(room, viewerId) {
  const base = { code: room.code, hostId: room.hostId, players: room.players.map(({ token, ...player }) => player), settings: room.settings, game: null };
  if (!room.game) return base;
  const source = room.game;
  const viewer = source.seats.find((item) => item.playerId === viewerId);
  const currentProposal = source.proposalHistory[source.proposalHistory.length - 1];
  const game = {
    status: source.status, phase: source.phase, preset: source.preset, questIndex: source.questIndex, startedAt: source.startedAt,
    questSizes: [...source.questSizes], currentTeamSize: source.questSizes[source.questIndex] || 0,
    goodScore: source.goodScore, evilScore: source.evilScore, leaderId: source.seats[source.leaderIndex]?.playerId || null,
    actorId: source.actorId, selectedTeam: [...source.selectedTeam], proposedTeam: [...source.proposedTeam],
    rejectTrack: source.rejectTrack, eventSeq: source.eventSeq, lastEvent: clone(source.lastEvent), eventAcks: [...source.eventAcks],
    proposalHistory: clone(source.proposalHistory), questHistory: clone(source.questHistory),
    lastVoteResult: source.phase === "vote-result" ? clone(currentProposal) : null,
    ladyEnabled: source.ladyEnabled, ladyHolderId: source.ladyHolderId, log: [...source.log], winner: clone(source.winner),
    seats: source.seats.map((item) => ({
      playerId: item.playerId, playerName: item.playerName,
      leader: item.playerId === source.seats[source.leaderIndex]?.playerId,
      selected: source.selectedTeam.includes(item.playerId), onQuest: source.proposedTeam.includes(item.playerId),
      voteSubmitted: Boolean(source.votes[item.playerId]), questSubmitted: Boolean(source.questCards[item.playerId]),
      lady: item.playerId === source.ladyHolderId,
      ladyEligible: source.phase === "lady" && item.playerId !== source.ladyHolderId && !source.ladyPastHolders.includes(item.playerId)
    }))
  };
  if (viewer) game.you = {
    playerId: viewer.playerId, playerName: viewer.playerName, role: clone(viewer.role), side: viewer.side,
    knowledge: knowledgeFor(source, viewer), voteChoice: source.votes[viewerId] || null,
    questChoice: source.questCards[viewerId] || null,
    ladyResult: source.phase === "lady-result" && source.ladyResult?.viewerId === viewerId ? clone(source.ladyResult) : null
  };
  game.finalReveals = source.status === "finished" ? source.seats.map((item) => ({
    playerId: item.playerId, playerName: item.playerName, role: clone(item.role), side: item.side
  })) : [];
  return { ...base, game };
}

module.exports = {
  defaults, configure, createGame, toggleTeam, proposeTeam, vote, questCard, ackEvent,
  ladyInspect, ackLady, assassinate, tick, publicRoom, PLAYER_COUNTS, ROLES, PRESETS, roleIdsFor
};
