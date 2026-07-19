const socket = io();
const $ = (id) => document.getElementById(id);
const COLORS = ["red", "blue", "green", "yellow", "purple"];
const ALL_CAMELS = [...COLORS, "black", "white"];
const BET_VALUES = [5, 3, 3, 2, 1];
const COLOR_NAMES = { red: "红驼", blue: "蓝驼", green: "绿驼", yellow: "黄驼", purple: "紫驼", black: "黑色疯狂骆驼", white: "白色疯狂骆驼", gray: "疯狂骆驼灰骰" };
let identity = JSON.parse(localStorage.getItem("camelIdentity") || "null");
let myId = null;
let state = null;
let feedbackTimer = null;
let resultTimer = null;

function show(id) { ["landing", "lobby", "game"].forEach((key) => $(key).classList.toggle("hidden", key !== id)); }
function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(el.timer); el.timer = setTimeout(() => el.classList.remove("show"), 2600); }
function roomFromUrl() { return location.pathname.match(/^\/room\/([A-Z0-9]+)/i)?.[1]?.toUpperCase(); }
function name() { return $("nameInput").value.trim() || localStorage.getItem("camelName") || "沙漠旅人"; }
function saveIdentity(result) { identity = { code: result.code, playerToken: result.playerToken }; myId = result.playerId; localStorage.setItem("camelIdentity", JSON.stringify(identity)); localStorage.setItem("camelName", name()); }
function roomUrl(code) { return `${location.origin}/room/${code}`; }
function join(code) { socket.emit("room:join", { code, name: name(), playerToken: identity?.code === code ? identity.playerToken : null }, (result) => { if (result?.ok) { saveIdentity(result); history.replaceState({}, "", `/room/${result.code}`); } }); }

$("createButton").onclick = () => socket.emit("room:create", { name: name(), playerToken: crypto.randomUUID() }, (result) => { if (result?.ok) { saveIdentity(result); history.replaceState({}, "", `/room/${result.code}`); } });
$("joinButton").onclick = () => { const code = $("codeInput").value.trim().toUpperCase(); if (code.length !== 6) return toast("请输入 6 位房间码"); join(code); };
$("codeInput").addEventListener("keydown", (event) => { if (event.key === "Enter") $("joinButton").click(); });
$("startButton").onclick = () => socket.emit("game:start");
$("rollButton").onclick = () => socket.emit("game:roll");
document.querySelectorAll("[data-tile]").forEach((button) => button.onclick = () => socket.emit("game:tile", { space: $("tileSpace").value, type: button.dataset.tile }));
document.querySelectorAll("[data-predict]").forEach((button) => button.onclick = () => socket.emit("game:predict", { color: $("predictionColor").value, type: button.dataset.predict }));
$("rulesButton").onclick = () => $("rulesDialog").showModal();
$("gameRulesButton").onclick = () => $("rulesDialog").showModal();
$("closeRules").onclick = () => $("rulesDialog").close();

async function copyInvite() { if (!state) return; try { await navigator.clipboard.writeText(roomUrl(state.code)); toast("邀请链接已复制"); } catch { toast("请从地址栏复制链接"); } }
$("copyButton").onclick = copyInvite; $("gameCopyButton").onclick = copyInvite;

function renderLobby(room) {
  show("lobby"); $("shareUrl").textContent = roomUrl(room.code); $("roomCode").textContent = room.code;
  $("lobbyPlayers").innerHTML = room.players.map((player) => `<div class="lobby-player ${player.connected ? "" : "offline"}">${player.id === room.hostId ? "👑 " : ""}${escapeHtml(player.name)}${player.id === myId ? "（你）" : ""}</div>`).join("");
  $("startButton").classList.toggle("hidden", room.hostId !== myId);
  $("hostHint").textContent = room.hostId === myId ? `已有 ${room.players.length} 人，随时可以开始。` : "等待房主开始比赛…";
}

function escapeHtml(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML; }
function renderGame(room) {
  show("game"); const game = room.game; const current = room.players[game.turn % room.players.length]; const myTurn = current?.id === myId && game.status === "playing";
  $("gameCode").textContent = room.code; $("legTitle").textContent = game.status === "finished" ? "比赛结束" : `第 ${game.leg} 赛段`;
  $("turnBadge").textContent = game.status === "finished" ? "已完成" : myTurn ? "轮到你行动" : `等待 ${current.name}`;
  $("playerList").innerHTML = room.players.slice().sort((a,b) => b.coins-a.coins).map((player) => `<div class="player-card ${player.id === current?.id && game.status === "playing" ? "active" : ""}"><div class="player-line"><span>${player.id === myId ? "你 · " : ""}${escapeHtml(player.name)}</span><span>${player.coins} 🪙</span></div><div class="player-status">${player.connected ? "在线" : "暂时离线"}${player.id === room.hostId ? " · 房主" : ""}</div></div>`).join("");
  renderTrack(game, room); $("diceLeft").innerHTML = game.dice.map((color) => `<i class="mini-die ${color}" title="${COLOR_NAMES[color]}">${color === "gray" ? "↶" : ""}</i>`).join("");
  $("gameLog").innerHTML = game.log.slice(0, 30).map((line) => `<div class="log-item">${translateLog(escapeHtml(line))}</div>`).join("");
  $("rollButton").disabled = !myTurn;
  $("betButtons").innerHTML = COLORS.map((color) => {
    const remaining = game.bets[color]?.length || 0;
    const taken = BET_VALUES.length - remaining;
    return `<button class="bet-stack ${color}" data-color="${color}" aria-label="投注${COLOR_NAMES[color]}，下一张 ${game.bets[color]?.[0] || 0} 金币" ${!myTurn || !remaining ? "disabled" : ""}>
      <span class="bet-camel"><i class="dot ${color}"></i>${COLOR_NAMES[color]}</span>
      <span class="bet-values">${BET_VALUES.map((value, index) => `<b class="${index < taken ? "taken" : ""}">${index < taken ? "×" : value}</b>`).join("")}</span>
    </button>`;
  }).join("");
  document.querySelectorAll("[data-color]").forEach((button) => button.onclick = () => socket.emit("game:bet", { color: button.dataset.color }));
  document.querySelectorAll("[data-tile]").forEach((button) => button.disabled = !myTurn);
  const mine = game.predictions.filter((item) => item.playerId === myId && !item.secret);
  const usedColors = mine.map((item) => item.color);
  const colorsLeft = COLORS.filter((color) => !usedColors.includes(color));
  $("predictionColor").innerHTML = COLORS.map((color) => `<option value="${color}" ${usedColors.includes(color) ? "disabled" : ""}>${COLOR_NAMES[color]}${usedColors.includes(color) ? " · 已使用" : ""}</option>`).join("");
  if (colorsLeft.length) $("predictionColor").value = colorsLeft[0];
  $("predictionColor").disabled = !colorsLeft.length || game.status !== "playing";
  document.querySelectorAll("[data-predict]").forEach((button) => button.disabled = game.status !== "playing" || !colorsLeft.length);
  $("predictionCards").innerHTML = mine.length ? mine.map((item) => `<span class="prediction-card ${item.color}"><i class="dot ${item.color}"></i>${COLOR_NAMES[item.color]} · ${item.type === "winner" ? "冠军" : "末名"}</span>`).join("") : `<small>每种颜色卡只能使用一次；还可使用 ${colorsLeft.length} 张</small>`;
  if (game.status === "finished") { const best = room.players.slice().sort((a,b) => b.coins-a.coins)[0]; $("finishBanner").classList.remove("hidden"); $("finishBanner").innerHTML = `${COLOR_NAMES[game.winner]}率先冲线 · <strong>${escapeHtml(best.name)}</strong> 以 ${best.coins} 金币赢得本局！${room.hostId === myId ? `<button id="restartButton" class="restart-button">再来一局 ↻</button>` : `<small>等待房主开启下一局</small>`}`; $("restartButton")?.addEventListener("click", () => socket.emit("game:restart")); }
  else $("finishBanner").classList.add("hidden");
}

function renderTrack(game, room) {
  const track = $("track");
  const floatingControls = [$("diceZone"), $("actions")].filter(Boolean);
  const tiles = Object.fromEntries(game.tiles.map((tile) => [tile.space, tile]));
  let html = `<div class="desert-center"><div class="pyramid">△</div><strong>撒哈拉竞速场</strong><small>疯狂骆驼会逆向奔跑</small></div>
    <div id="rollFeedback" class="roll-feedback"><div class="roll-die"><span></span></div><div class="roll-copy"></div></div>
    <div id="startAnnouncement" class="start-announcement"><strong>起跑位置抽签</strong><small>骆驼正在进入随机起跑位…</small></div>
    <div class="palm-real palm-a"><i class="trunk"></i><span class="fronds"><b></b><b></b><b></b><b></b><b></b><b></b></span></div>
    <div class="palm-real palm-b"><i class="trunk"></i><span class="fronds"><b></b><b></b><b></b><b></b><b></b><b></b></span></div>
    <div class="desert-tent"><i></i><b></b></div><div class="cactus-real"><i></i><b></b><em></em></div>
    <div class="desert-rocks rocks-a"><i></i><b></b><em></em></div><div class="desert-rocks rocks-b"><i></i><b></b></div>
    <div class="desert-shrub shrub-a"></div><div class="desert-shrub shrub-b"></div>`;
  for (let space = 1; space <= 16; space += 1) {
    const stack = game.stacks[space] || []; const tile = tiles[space]; const owner = room.players.find((player) => player.id === tile?.playerId); const ownerIndex = room.players.findIndex((player) => player.id === tile?.playerId);
    const angle = (130 + (space - 1) * 22.5) * Math.PI / 180;
    const left = 50 + 43 * Math.cos(angle); const top = 50 + 40 * Math.sin(angle);
    html += `<div class="space ${space === 16 ? "finish" : ""}" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%"><span class="space-number">${space}${space === 16 ? " · 终点" : ""}</span>${tile ? `<span class="track-tile ${tile.type}" style="--owner-color:${playerMarkerColor(ownerIndex)}" title="${escapeHtml(owner?.name || "玩家")}的${tile.type === "oasis" ? "绿洲" : "幻境"}"><b>${tile.type === "oasis" ? "+1" : "−1"}</b><em>${escapeHtml((owner?.name || "玩").slice(0, 1))}</em></span>` : ""}<div class="camel-stack">${stack.map((color) => `<div class="camel ${color} ${["black","white"].includes(color) ? "crazy" : ""}" data-camel="${color}" title="${COLOR_NAMES[color]}">${["black","white"].includes(color) ? "↶" : ""}</div>`).join("")}</div></div>`;
  }
  track.innerHTML = html;
  floatingControls.forEach((control) => track.appendChild(control));
}
function translateLog(line) { return ALL_CAMELS.reduce((text, color) => text.replaceAll(color, COLOR_NAMES[color]), line); }
function playerMarkerColor(index) { return ["#e4573f", "#3186ad", "#7c57a5", "#378a5b", "#d08b25", "#b84578", "#49616f", "#73542f"][Math.max(0, index) % 8]; }

function captureCamelRects() {
  const trackRect = $("track")?.getBoundingClientRect();
  if (!trackRect) return {};
  return Object.fromEntries([...document.querySelectorAll("[data-camel]")].map((camel) => {
    const rect = camel.getBoundingClientRect();
    return [camel.dataset.camel, { left: rect.left - trackRect.left, top: rect.top - trackRect.top }];
  }));
}

function animateCamelMove(previousRects, event) {
  const trackRect = $("track")?.getBoundingClientRect();
  if (!trackRect) return;
  Object.keys(previousRects).forEach((color) => {
    const camel = document.querySelector(`[data-camel="${color}"]`);
    const before = previousRects[color];
    if (!camel || !before) return;
    const after = camel.getBoundingClientRect();
    const dx = before.left - (after.left - trackRect.left);
    const dy = before.top - (after.top - trackRect.top);
    if (Math.hypot(dx, dy) < 1) return;
    const visualScale = after.width / camel.offsetWidth || 1;
    const tx = dx / visualScale; const ty = dy / visualScale;
    const movingIndex = event.moving.indexOf(color);
    const isMoving = movingIndex >= 0;
    const keyframes = isMoving ? [
      { transform: `translate(${tx}px, ${ty}px) rotate(0deg)`, zIndex: 20 },
      { transform: `translate(${tx * .5}px, ${ty * .5 - 28}px) rotate(${event.direction > 0 ? 4 : -4}deg)`, zIndex: 20, offset: .52 },
      { transform: "translate(0, 0) rotate(0deg)", zIndex: 20 }
    ] : [
      { transform: `translate(${tx}px, ${ty}px)` },
      { transform: "translate(0, 0)" }
    ];
    camel.animate(keyframes, { duration: isMoving ? 1050 : 620, delay: 900 + Math.max(0, movingIndex) * 35, easing: "cubic-bezier(.22,.72,.25,1)", fill: "both" });
  });
}

function showRollFeedback(event) {
  const feedback = $("rollFeedback");
  if (!feedback) return;
  clearTimeout(feedbackTimer); clearTimeout(resultTimer);
  const die = feedback.querySelector(".roll-die");
  die.className = `roll-die ${event.die}`;
  die.querySelector("span").textContent = event.amount;
  const rolledName = event.die === "gray" ? `${COLOR_NAMES[event.color]}（灰骰）` : COLOR_NAMES[event.color];
  feedback.querySelector(".roll-copy").innerHTML = `<strong>${escapeHtml(event.playerName)} 掷出了 ${event.amount} 点</strong><small>${rolledName}${event.direction < 0 ? " · 逆向移动" : " · 向前移动"}</small>`;
  feedback.className = "roll-feedback";
  void feedback.offsetWidth;
  feedback.classList.add("showing");
  feedbackTimer = setTimeout(() => feedback.classList.remove("showing"), event.legEnd ? 2050 : 2200);
  if (event.legEnd) resultTimer = setTimeout(() => showLegWinner(event.legEnd), 2150);
}

function animateStartingPositions() {
  const track = $("track"); const announcement = $("startAnnouncement");
  if (!track || !announcement) return;
  announcement.classList.add("showing");
  const trackRect = track.getBoundingClientRect();
  const centerX = trackRect.left + trackRect.width / 2;
  const centerY = trackRect.top + trackRect.height / 2;
  [...document.querySelectorAll("[data-camel]")].forEach((camel, index) => {
    const target = camel.getBoundingClientRect();
    const dx = centerX - (target.left + target.width / 2);
    const dy = centerY - (target.top + target.height / 2);
    camel.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.35) rotate(-12deg)`, opacity: 0 },
      { transform: `translate(${dx * .25}px, ${dy * .25 - 25}px) scale(1.08) rotate(4deg)`, opacity: 1, offset: .72 },
      { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 }
    ], { duration: 1050, delay: 500 + index * 240, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" });
  });
  setTimeout(() => announcement.classList.remove("showing"), 2900);
}

function showLegWinner(result) {
  const feedback = $("rollFeedback");
  const winner = document.querySelector(`[data-camel="${result.first}"]`);
  if (!feedback) return;
  feedback.querySelector(".roll-die").className = `roll-die winner-medal ${result.first}`;
  feedback.querySelector(".roll-die span").textContent = "★";
  feedback.querySelector(".roll-copy").innerHTML = `<strong>第 ${result.leg} 赛段冠军</strong><small>${COLOR_NAMES[result.first]} 暂列第一</small>`;
  feedback.className = "roll-feedback leg-result showing";
  winner?.classList.add("leg-winner");
  feedbackTimer = setTimeout(() => { feedback.classList.remove("showing"); winner?.classList.remove("leg-winner"); }, 2800);
}

socket.on("room:update", (room) => {
  const hadGame = Boolean(state?.game);
  const wasLobby = Boolean(state && !state.game);
  const previousEventId = state?.game?.lastEvent?.id ?? null;
  const previousRects = hadGame ? captureCamelRects() : {};
  state = room;
  if (!myId && identity?.code === room.code) myId = room.players.find((p) => p.token === identity.playerToken)?.id;
  room.game ? renderGame(room) : renderLobby(room);
  const event = room.game?.lastEvent;
  if (hadGame && event?.type === "roll" && event.id !== previousEventId) requestAnimationFrame(() => {
    animateCamelMove(previousRects, event);
    showRollFeedback(event);
  });
  if (wasLobby && room.game) requestAnimationFrame(animateStartingPositions);
});
socket.on("game:error", (message) => toast(message));
socket.on("connect", () => { const code = roomFromUrl(); if (code) { $("entryHint").textContent = `正在加入房间 ${code}…`; join(code); } else show("landing"); });
socket.on("disconnect", () => toast("连接中断，正在尝试重连…"));
