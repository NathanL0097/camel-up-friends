const socket = io();
if (["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("quality-check")) {
  const probe = document.createElement("script"); probe.src = "/quality-probe.js"; document.head.appendChild(probe);
}
const $ = (id) => document.getElementById(id);
const roomIdentities = window.createRoomIdentityStore(localStorage);
let identity = roomIdentities.latest();
let myId = null;
let state = null;
let selectedGameId = "camel-race";
let accessToken = localStorage.getItem("tabletopAccessToken") || "";
let accessExpiresAt = Number(localStorage.getItem("tabletopAccessExpiresAt") || 0);
let accessRole = localStorage.getItem("tabletopAccessRole") || "tester";
let accessReady = false;
let reconnecting = false;
const gameClients = new Map();
const gameCatalog = new Map([["camel-race", { id: "camel-race", clientScript: "/games/camel-race.js" }]]);
const GAME_GLYPHS = {
  "camel-race": "骆", "market-opening": "趋", "draw-and-guess": "画", "poker-night": "♠",
  "seven-duel": "VII", "sky-landing": "航", "eldritch-files": "案", "liars-tavern": "诈",
  "quiz-arena": "问", "las-vegas-royale": "骰", "witch-town": "巫", avalon: "冠", "colt-express": "列",
};
const GAME_MARKS={"camel-race":"camel",avalon:"chalice","colt-express":"train","witch-town":"candle","las-vegas-royale":"chip"};
const gameMark=id=>GAME_MARKS[id]?window.GameArt.icon(GAME_MARKS[id]):escapeHtml(GAME_GLYPHS[id]||"游");

const savedName = localStorage.getItem("tabletopName") || localStorage.getItem("camelName");
if (savedName) $("nameInput").value = savedName;

function show(id) {
  ["landing", "lobby", "game"].forEach((key) => $(key).classList.toggle("hidden", key !== id));
  document.body.dataset.screen = id;
  if (id === "game" && !$("game").dataset.entered) {
    $("game").dataset.entered = "true";
    window.scrollTo(0, 0);
  }
  if (id !== "game") delete $("game").dataset.entered;
}
function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(el.timer); el.timer = setTimeout(() => el.classList.remove("show"), 2600); }
function setButtonBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.idleLabel = button.textContent;
    button.textContent = label;
    button.classList.add("is-busy");
    button.setAttribute("aria-busy", "true");
  } else {
    button.textContent = button.dataset.idleLabel || button.textContent;
    button.classList.remove("is-busy");
    button.removeAttribute("aria-busy");
    delete button.dataset.idleLabel;
  }
  button.disabled = busy;
}
function escapeHtml(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML; }
function roomFromUrl() { return location.pathname.match(/^\/room\/([A-Z0-9]+)/i)?.[1]?.toUpperCase(); }
function name() { return $("nameInput").value.trim() || localStorage.getItem("tabletopName") || localStorage.getItem("camelName") || "桌游旅人"; }
function roomUrl(code) { return `${location.origin}/room/${code}`; }
function formatAccessExpiry(expiresAt) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(expiresAt));
}
function setAccessState(active, expiresAt = null, role = accessRole) {
  accessReady = active;
  accessRole = role || "tester";
  if (active && expiresAt) {
    accessExpiresAt = expiresAt;
    localStorage.setItem("tabletopAccessExpiresAt", String(expiresAt));
  }
  if (active) localStorage.setItem("tabletopAccessRole", accessRole);
  const panel = $("activationPanel");
  const status = $("activationStatus");
  const create = $("createButton");
  const join = $("joinButton");
  const admin = $("adminButton");
  if (panel) panel.classList.toggle("active", active);
  if (status) status.textContent = active ? (accessRole === "admin" ? "管理员权限永久有效" : `测试权限有效至 ${formatAccessExpiry(accessExpiresAt)}`) : "请输入激活码后开始使用";
  if (create) create.disabled = false;
  if (join) join.disabled = false;
  if (admin) admin.classList.toggle("hidden", !(active && accessRole === "admin"));
}
function checkAccess() {
  return new Promise((resolve) => socket.emit("access:status", { token: accessToken }, (result = {}) => {
    if (!result.active) {
      accessToken = "";
      accessExpiresAt = 0;
      localStorage.removeItem("tabletopAccessToken");
      localStorage.removeItem("tabletopAccessExpiresAt");
      localStorage.removeItem("tabletopAccessRole");
      setAccessState(false);
      resolve(false);
      return;
    }
    setAccessState(true, result.expiresAt, result.role);
    resolve(true);
  }));
}
function redeemAccessCode() {
  const input = $("activationCode");
  const code = input?.value.trim().toUpperCase();
  if (!code) return toast("请输入内部激活码");
  $("activateButton").disabled = true;
  socket.emit("access:redeem", { code }, (result = {}) => {
    $("activateButton").disabled = false;
    if (!result.ok) return toast(result.error || "激活码无效");
    accessToken = result.token;
    localStorage.setItem("tabletopAccessToken", accessToken);
    setAccessState(true, result.expiresAt, result.role);
    input.value = "";
    toast("激活成功，测试权限已开启 30 小时");
  });
}
function saveIdentity(result) {
  identity = { code: result.code, playerToken: result.playerToken };
  myId = result.playerId;
  roomIdentities.save(identity);
  localStorage.setItem("tabletopName", name());
}

function setGameDrawer(open) {
  const picker = $("gamePicker");
  if (!picker) return;
  picker.classList.toggle("open", open);
  $("gamePickerToggle").setAttribute("aria-expanded", String(open));
  $("gameDrawer").setAttribute("aria-hidden", String(!open));
  $("gamePickerHint").textContent = open ? "收起游戏库" : "展开游戏库";
}

function paintSelectedGame(game) {
  if (!game) return;
  $("selectedGameIcon").innerHTML = gameMark(game.id);
  $("selectedGameTitle").textContent = game.title;
}

function loadClientScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-game-client="${src}"]`);
    if (existing?.dataset.loaded === "true") return resolve();
    if (existing) { existing.addEventListener("load", resolve, { once: true }); return; }
    const script = document.createElement("script");
    script.src = src;
    script.dataset.gameClient = src;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("游戏客户端模块加载失败"));
    document.head.appendChild(script);
  });
}

async function getGameClient(gameId, clientScript = gameCatalog.get(gameId)?.clientScript) {
  if (!gameClients.has(gameId)) {
    if (!window.GameClientFactories?.[gameId] && clientScript) await loadClientScript(clientScript);
    const factory = window.GameClientFactories?.[gameId];
    if (!factory) throw new Error("这款游戏的客户端模块尚未加载");
    gameClients.set(gameId, factory({ socket, $, show, escapeHtml, getMyId: () => myId, copyInvite }));
  }
  return gameClients.get(gameId);
}

async function loadGameCatalog() {
  try {
    const response = await fetch("/api/games");
    const { games } = await response.json();
    games.forEach((game) => gameCatalog.set(game.id, game));
    $("gameCatalog").innerHTML = games.map((game) => `<button class="game-choice ${game.id === selectedGameId ? "selected" : ""}" data-game-id="${game.id}"><span>${gameMark(game.id)}</span><b>${escapeHtml(game.title)}</b><small>${game.minPlayers}–${game.maxPlayers}人 · ${game.status === "prototype" ? "技术演示" : "已开放"}</small></button>`).join("");
    paintSelectedGame(gameCatalog.get(selectedGameId));
    document.querySelectorAll("[data-game-id]").forEach((button) => button.onclick = () => {
      selectedGameId = button.dataset.gameId;
      document.querySelectorAll("[data-game-id]").forEach((choice) => choice.classList.toggle("selected", choice === button));
      paintSelectedGame(gameCatalog.get(selectedGameId));
      setGameDrawer(false);
    });
  } catch {
    // 保留HTML内的默认游戏卡，临时网络故障不会阻止创建房间。
  }
}

$("gamePickerToggle").onclick = () => setGameDrawer(!$("gamePicker").classList.contains("open"));
$("closeGameDrawer").onclick = () => setGameDrawer(false);
document.addEventListener("click", (event) => { if ($("gamePicker")?.classList.contains("open") && !$("gamePicker").contains(event.target)) setGameDrawer(false); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") setGameDrawer(false); });

function join(code, restored = false) {
  identity = roomIdentities.load(code) || (identity?.code === code ? identity : null);
  setButtonBusy($("joinButton"), true, "连接中");
  socket.emit("room:join", { code, name: name(), roomPassword: $("joinPasswordInput").value, playerToken: identity?.code === code ? identity.playerToken : null }, (result) => {
    setButtonBusy($("joinButton"), false);
    if (result?.ok) {
      saveIdentity(result);
      history.replaceState({}, "", `/room/${result.code}`);
      $("entryHint").textContent = "已连接到好友房。";
      if (restored) showSystemCue("已重新连接到牌桌");
    } else {
      prepareInviteJoin(code);
      $("entryHint").textContent = result?.error || "未能加入房间，请检查房间码后重试。";
    }
  });
}

function prepareInviteJoin(code) {
  show("landing");
  $("codeInput").value = code;
  $("codeInput").readOnly = true;
  $("roomPasswordInput").classList.add("hidden");
  $("roomPasswordInput").previousElementSibling?.classList.add("hidden");
  $("createButton").classList.add("hidden");
  document.querySelector(".divider").classList.add("hidden");
  document.querySelector(".entry-card").classList.add("invite-mode");
  setGameDrawer(false);
  $("joinButton").textContent = "确认昵称并加入";
  $("entryHint").textContent = `你将加入好友房 ${code}，请先确认或修改昵称。`;
  $("nameInput").focus();
}

function renderLobby(room, gameClient) {
  show("lobby");
  $("shareUrl").textContent = roomUrl(room.code);
  $("roomCode").textContent = room.code;
  $("lobbyGameTitle").textContent = room.gameInfo?.title || "好友桌游";
  $("lobbyHeadline").textContent = ({"camel-race":"赛场即将开幕",avalon:"圆桌等待你的誓言","colt-express":"下一班，驶向荒野","witch-town":"夜幕将至，等待镇民","las-vegas-royale":"今晚，筹码为你入席","sky-landing":"机组集合，准备进近","seven-duel":"两座城，一段新纪元"})[room.gameId]||"好友入席，好戏将至";
  $("lobbyPlayers").innerHTML = room.players.map((player) => {
    const role = `${player.id === room.hostId ? "房主 · " : ""}${player.connected ? "在线" : "已断开"}${player.id === myId ? " · 你" : ""}`;
    return `<div class="lobby-player ${player.connected ? "" : "offline"}"><span class="lobby-avatar">${escapeHtml(player.name.slice(0, 1) || "玩")}</span><span><b>${escapeHtml(player.name)}</b><small>${role}</small></span></div>`;
  }).join("");
  $("startButton").classList.toggle("hidden", room.hostId !== myId);
  $("hostHint").textContent = room.hostId === myId ? `已有 ${room.players.length} 人；本房间最多 ${room.gameInfo?.maxPlayers || 8} 人。${room.roomPasswordRequired ? " 已设置房间密码。" : " 未设置房间密码。"}` : `等待房主开始比赛…${room.roomPasswordRequired ? " 加入时需要房间密码。" : ""}`;
  $("gameLobbySettings").innerHTML = "";
  gameClient?.renderLobby?.(room);
}

async function copyInvite() {
  if (!state) return;
  try { await navigator.clipboard.writeText(roomUrl(state.code)); toast("邀请链接已复制"); }
  catch { toast("请从地址栏复制链接"); }
}

$("activateButton").onclick = redeemAccessCode;
$("activationCode").addEventListener("keydown", (event) => { if (event.key === "Enter") redeemAccessCode(); });
$("adminButton").onclick = () => { location.href = "/admin"; };
$("createButton").onclick = () => {
  setButtonBusy($("createButton"), true, "正在布置牌桌");
  socket.emit("room:create", { name: name(), roomPassword: $("roomPasswordInput").value, playerToken: crypto.randomUUID(), gameId: selectedGameId }, (result) => {
  setButtonBusy($("createButton"), false);
  if (result?.ok) {
    saveIdentity(result);
    history.replaceState({}, "", `/room/${result.code}`);
  } else if (result?.error) toast(result.error);
  });
};
$("joinButton").onclick = () => { const code = $("codeInput").value.trim().toUpperCase(); if (code.length !== 6) return toast("请输入 6 位房间码"); join(code); };
$("codeInput").addEventListener("keydown", (event) => { if (event.key === "Enter") $("joinButton").click(); });
$("startButton").onclick = () => { setButtonBusy($("startButton"), true, "正在开桌"); socket.emit("game:start"); setTimeout(() => setButtonBusy($("startButton"), false), 1800); };
$("rulesButton").onclick = async () => { await getGameClient(state?.gameId || selectedGameId, state?.gameInfo?.clientScript); $("rulesDialog").showModal(); };
$("closeRules").onclick = () => $("rulesDialog").close();
$("copyButton").onclick = copyInvite;

socket.on("room:update", async (room) => {
  let gameClient;
  let transition;
  try {
    gameClient = await getGameClient(room.gameId, room.gameInfo?.clientScript);
    transition = gameClient.prepare(state);
  } catch (error) {
    return toast(error.message);
  }
  const previousState = state;
  state = room;
  document.body.dataset.gameId = room.gameId;
  room.game ? gameClient.render(room, transition) : renderLobby(room, gameClient);
  requestAnimationFrame(() => animateRoomUpdate(previousState, room));
});
socket.on("game:error", (message) => { window.TableAudio?.play("invalid"); toast(message); });
socket.on("connect", () => {
  const restored = reconnecting;
  reconnecting = false;
  document.getElementById("connectionBanner")?.remove();
  const code = roomFromUrl();
  if (!code) return show("landing");
  identity = roomIdentities.load(code) || (identity?.code === code ? identity : null);
  if (identity?.code === code) {
    $("entryHint").textContent = `正在重新连接房间 ${code}…`;
    join(code, restored);
  } else prepareInviteJoin(code);
});
socket.on("disconnect", () => {
  reconnecting = true;
  let banner = document.getElementById("connectionBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "connectionBanner";
    banner.setAttribute("role", "status");
    banner.innerHTML = `<i></i><span><b>与牌桌的连接暂时中断</b><small>正在自动恢复，你的房间身份会被保留</small></span>`;
    document.body.appendChild(banner);
  }
});

setAccessState(true, accessExpiresAt || null, accessRole);
show("landing");
loadGameCatalog();

function currentActorId(room) {
  const game = room?.game;
  if (!game) return null;
  if (game.actorId || game.activePlayerId || game.currentPlayerId || game.turnPlayerId || game.currentTurnId || game.leaderId || game.artistId || game.draftCurrentPlayerId) {
    return game.actorId || game.activePlayerId || game.currentPlayerId || game.turnPlayerId || game.currentTurnId || game.leaderId || game.artistId || game.draftCurrentPlayerId;
  }
  if (Number.isInteger(game.currentIndex)) return game.players?.[game.currentIndex]?.playerId || game.seats?.[game.currentIndex]?.playerId || game.investigators?.[game.currentIndex]?.playerId || null;
  if (Number.isInteger(game.turn) && room.players?.length) return room.players[game.turn % room.players.length]?.id || null;
  return null;
}

function roomMoment(room) {
  const game = room?.game;
  if (!game) return "lobby";
  return [game.status, game.phase, game.round, game.leg, game.turnNumber, game.questIndex, game.executionIndex, game.eventSeq, game.lastEvent?.id, game.lastEvent?.seq, game.winnerId, game.championId].filter((value) => value !== undefined).join(":");
}

function showSystemCue(message) {
  let cue = $("systemCue");
  if (!cue) {
    cue = document.createElement("div");
    cue.id = "systemCue";
    cue.setAttribute("role", "status");
    cue.setAttribute("aria-live", "polite");
    document.body.appendChild(cue);
  }
  cue.textContent = message;
  cue.classList.remove("show");
  void cue.offsetWidth;
  cue.classList.add("show");
}

function animateRoomUpdate(previous, room) {
  const mount = $("gameMount");
  if (!mount || !room.game) return;
  const previousActor = currentActorId(previous);
  const nextActor = currentActorId(room);
  if (previous?.game && nextActor && previousActor !== nextActor) {
    if(nextActor === myId) window.TableAudio?.play("turn", {cooldown:1200});
    const player = room.players.find((entry) => entry.id === nextActor);
    showSystemCue(nextActor === myId ? "轮到你了" : `${player?.name || "下一位玩家"}的回合`);
  }
  if (previous?.game?.status !== "finished" && room.game.status === "finished") {
    showSystemCue("对局结束 · 战绩已公布");
  }
}
